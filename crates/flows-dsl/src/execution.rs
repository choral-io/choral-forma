//! Pure reconstruction of a bounded, addressed execution from an ordered host journal.
use std::collections::BTreeMap;

use serde::{Deserialize, Deserializer, Serialize, de::DeserializeOwned};
use serde_json::value::RawValue;
use serde_json::{Value, json};

use crate::{
    DEFINITION_PROFILE, DefinitionError, ErrorStage, MAX_BYTES, Mode, Operation, Plan, Result,
    Roots, Step, ValueBudget, compile, definition, encoded_size, input_key, output_key, parse,
    parse_document, values::same_json,
};

const VERSION: u32 = 1;
const MAX_FACTS: usize = 256;
const MAX_JOURNAL_BYTES: usize = 4 * 1024 * 1024;
// Even a reply consisting entirely of JSON control characters fits this reservation.
// The local position consists of ASCII name characters and fits within the Definition.
const REPLY_RESERVE: usize = 6 * MAX_BYTES + MAX_BYTES + 2 * 6 * 256 + 128;

fn execution(code: &'static str) -> DefinitionError {
    DefinitionError::new(ErrorStage::Execution, code)
}

/// Validate the replay slice and list every required procedure and addressed local submission.
/// Hosts resolve the returned procedure targets before admitting an instance.
pub fn validate_execution(source: &str) -> Result<String> {
    let document = parse_document(source)?;
    let plan = compile(&document, Mode::Replay)?.ok_or_else(|| definition("schemas_only"))?;
    let mut calls = Vec::new();
    let mut submissions = Vec::new();
    for &i in &plan.order {
        let step = &plan.steps[i];
        match &step.operation {
            Operation::Call { target, .. } => {
                calls.push(json!({"position":step.id,"target":target}))
            }
            Operation::Watch(w) => submissions.push(format!("{}/{}", step.id, w.local)),
            Operation::Pure => {}
        }
    }
    Ok(json!({"version":VERSION,"profile":DEFINITION_PROFILE,"id":plan.id,"entry":plan.steps[plan.order[0]].id,
        "delivery":plan.delivery.map(|i| plan.steps[i].id),"calls":calls,"submissions":submissions}).to_string())
}

/// Replay a versioned journal against its immutable source, revision, instance and entry input.
/// Returns the current projection as JSON. Applying or replaying facts never invokes a procedure.
/// See the crate README for the journal, dispatch reservation and transaction protocol.
pub fn replay_execution(
    source: &str,
    revision: &str,
    instance: &str,
    input_json: &str,
    journal_json: &str,
) -> Result<String> {
    let document = parse_document(source)?;
    let plan = compile(&document, Mode::Replay)?.ok_or_else(|| definition("schemas_only"))?;
    if !identifier(revision) || !identifier(instance) {
        return Err(execution("address"));
    }
    if journal_json.len() > MAX_JOURNAL_BYTES {
        return Err(execution("journal_capacity"));
    }
    let journal: Journal = decode_object(journal_json)?;
    if journal.version != VERSION || journal.facts.len() > MAX_FACTS {
        return Err(execution("journal"));
    }
    let input = parse(input_json, ErrorStage::Input)?;
    ValueBudget::default().charge(&input, 0, ErrorStage::Input)?;
    let entry = &plan.steps[plan.order[0]];
    if entry.input_schema.is_some() {
        plan.contracts
            .check(&input_key(entry.id), &input, ErrorStage::Input)?;
    }
    let mut run = Run::new(&plan, revision, instance, input);
    run.advance();
    let mut used_bytes = 32; // Compact journal envelope and final delimiter.
    for (index, raw) in journal.facts.into_iter().enumerate() {
        used_bytes += raw.get().len() + 1;
        run.apply(decode_object(raw.get())?)?;
        // A successful reservation must leave room for one bounded outcome, even after
        // further submissions. Refuse the candidate prefix before a host can dispatch.
        if index + 1 + run.outstanding > MAX_FACTS
            || used_bytes + run.outstanding * REPLY_RESERVE > MAX_JOURNAL_BYTES
        {
            return Err(execution("journal_capacity"));
        }
    }
    Ok(run.projection().to_string())
}

fn identifier(s: &str) -> bool {
    !s.is_empty() && s.len() <= 256
}

fn decode_object<'de, T: Deserialize<'de>>(s: &'de str) -> Result<T> {
    if !s.trim_start().starts_with('{') {
        return Err(execution("journal"));
    }
    serde_json::from_str(s).map_err(|_| execution("journal"))
}

fn object_field<'de, D: Deserializer<'de>, T: DeserializeOwned>(
    de: D,
) -> std::result::Result<T, D::Error> {
    let raw = <&RawValue>::deserialize(de)?;
    decode_object(raw.get()).map_err(serde::de::Error::custom)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Journal<'a> {
    version: u32,
    #[serde(borrow)]
    facts: Vec<&'a RawValue>,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Address {
    revision: String,
    instance: String,
    position: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Fact {
    #[serde(deserialize_with = "object_field")]
    address: Address,
    #[serde(deserialize_with = "object_field")]
    event: Event,
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
enum Event {
    Dispatch {},
    Returned {
        #[serde(rename = "payloadJson")]
        payload: String,
    },
    ConfirmedFailure {},
    Unknown {},
    ReturnTooLarge {},
    Submission {
        id: String,
        #[serde(rename = "payloadJson")]
        payload: String,
    },
}

#[derive(Eq, Ord, PartialEq, PartialOrd)]
enum Slot {
    Dispatch,
    Outcome,
    Submission(String),
}

enum Payload {
    None,
    Json(Value),
    InvalidReturn(String, DefinitionError),
}

impl Payload {
    fn equivalent(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Json(a), Self::Json(b)) => same_json(a, b),
            (Self::InvalidReturn(a, _), Self::InvalidReturn(b, _)) => a == b,
            (Self::None, Self::None) => true,
            _ => false,
        }
    }
}

impl Event {
    fn identity(&self) -> Result<(Slot, &'static str, Payload)> {
        Ok(match self {
            Self::Dispatch {} => (Slot::Dispatch, "dispatch", Payload::None),
            Self::Returned { payload } => {
                let parsed = match parse(payload, ErrorStage::Output) {
                    Ok(value) => Payload::Json(value),
                    Err(error) => Payload::InvalidReturn(payload.clone(), error),
                };
                (Slot::Outcome, "returned", parsed)
            }
            Self::ConfirmedFailure {} => (Slot::Outcome, "confirmedFailure", Payload::None),
            Self::ReturnTooLarge {} => (Slot::Outcome, "returnTooLarge", Payload::None),
            Self::Unknown {} => (Slot::Outcome, "unknown", Payload::None),
            Self::Submission { id, payload } if identifier(id) => (
                Slot::Submission(id.clone()),
                "submission",
                Payload::Json(parse(payload, ErrorStage::Input)?),
            ),
            Self::Submission { .. } => return Err(execution("identity")),
        })
    }
}

enum State {
    Pending,
    Call {
        input: Value,
        argument: Value,
        dispatched: bool,
    },
    Open {
        results: Vec<Value>,
        budget: ValueBudget,
    },
    Succeeded {
        output: Option<Value>,
        exit: Option<String>,
    },
    Tolerated,
}

struct Run<'a, 's> {
    plan: &'a Plan<'s>,
    revision: &'a str,
    instance: &'a str,
    initial: Value,
    outstanding: usize,
    indices: BTreeMap<&'s str, usize>,
    states: Vec<State>,
    seen: BTreeMap<(String, Slot), (&'static str, Payload)>,
    failure: Option<(usize, DefinitionError)>,
}

impl<'a, 's> Run<'a, 's> {
    fn new(plan: &'a Plan<'s>, revision: &'a str, instance: &'a str, initial: Value) -> Self {
        Self {
            plan,
            revision,
            instance,
            initial,
            outstanding: 0,
            indices: plan
                .steps
                .iter()
                .enumerate()
                .map(|(i, s)| (s.id, i))
                .collect(),
            states: plan.steps.iter().map(|_| State::Pending).collect(),
            seen: BTreeMap::new(),
            failure: None,
        }
    }

    fn address(&self, position: &str) -> Address {
        Address {
            revision: self.revision.into(),
            instance: self.instance.into(),
            position: position.into(),
        }
    }

    fn advance(&mut self) {
        for &i in &self.plan.order {
            if self.failure.is_some() {
                break;
            }
            let step = &self.plan.steps[i];
            if !matches!(self.states[i], State::Pending) {
                continue;
            }
            if step
                .needs
                .iter()
                .any(|n| !matches!(self.states[self.indices[n.from]], State::Succeeded { .. }))
            {
                continue;
            }
            match self.start_step(step) {
                Ok(state) => self.states[i] = state,
                Err(e) => self.failure = Some((i, e)),
            }
        }
        // Every dependency is unconditional in this slice. A tolerated source cannot supply it.
        if self.failure.is_none()
            && !self
                .states
                .iter()
                .any(|s| matches!(s, State::Call { .. } | State::Open { .. }))
        {
            if let Some(i) = self
                .plan
                .order
                .iter()
                .copied()
                .find(|&i| matches!(self.states[i], State::Pending))
            {
                self.failure = Some((i, execution("unsatisfied_dependency")));
            } else if let Some(i) = self.plan.delivery
                && matches!(self.states[i], State::Tolerated)
            {
                self.failure = Some((i, execution("missing_delivery")));
            }
        }
    }

    fn start_step(&self, step: &Step<'_>) -> Result<State> {
        if matches!(step.operation, Operation::Watch(_)) {
            return Ok(State::Open {
                results: Vec::new(),
                budget: ValueBudget::default(),
            });
        }
        let input = if let Some(binding) = &step.input {
            let mut roots = Roots::new();
            for need in &step.needs {
                if need.require == "output" {
                    let i = self.indices[need.from];
                    let State::Succeeded {
                        output: Some(value),
                        ..
                    } = &self.states[i]
                    else {
                        return Err(execution("unsatisfied_dependency"));
                    };
                    roots.insert(need.alias, (value, self.plan.steps[i].output_schema));
                }
            }
            binding.evaluate(&roots, &self.plan.contracts, ErrorStage::Input)?
        } else {
            self.initial.clone()
        };
        encoded_size(&input.to_string(), ErrorStage::Input)?;
        if step.input_schema.is_some() {
            self.plan
                .contracts
                .check(&input_key(step.id), &input, ErrorStage::Input)?;
        }
        if let Operation::Call { argument, .. } = &step.operation {
            let roots = Roots::from([("$input", (&input, step.input_schema))]);
            let argument = match argument {
                Some(binding) => {
                    binding.evaluate(&roots, &self.plan.contracts, ErrorStage::Input)?
                }
                None => input.clone(),
            };
            encoded_size(&argument.to_string(), ErrorStage::Input)?;
            return Ok(State::Call {
                input,
                argument,
                dispatched: false,
            });
        }
        self.finish_step(step, &input, None)
    }

    fn finish_step(&self, step: &Step<'_>, input: &Value, reply: Option<&Value>) -> Result<State> {
        let mut roots = Roots::from([("$input", (input, step.input_schema))]);
        if let Some(v) = reply {
            ValueBudget::default().charge(v, 0, ErrorStage::Output)?;
            roots.insert("$result", (v, None));
        }
        let output = if let Some(bind) = &step.output {
            Some(bind.evaluate(&roots, &self.plan.contracts, ErrorStage::Output)?)
        } else if step.publishes {
            reply.cloned()
        } else {
            None
        };
        self.success(step, output, None)
    }

    fn success(
        &self,
        step: &Step<'_>,
        output: Option<Value>,
        exit: Option<String>,
    ) -> Result<State> {
        if let Some(value) = &output {
            encoded_size(&value.to_string(), ErrorStage::Output)?;
            if step.output_schema.is_some() {
                self.plan
                    .contracts
                    .check(&output_key(step.id), value, ErrorStage::Output)?;
            }
        }
        Ok(State::Succeeded { output, exit })
    }

    fn apply(&mut self, fact: Fact) -> Result<()> {
        let Fact { address, event } = fact;
        if address.instance != self.instance || address.revision != self.revision {
            return Err(execution("address"));
        }
        let (position, local) = address
            .position
            .split_once('/')
            .map_or((address.position.as_str(), None), |(s, l)| (s, Some(l)));
        let &i = self
            .indices
            .get(position)
            .ok_or_else(|| execution("address"))?;
        let step = &self.plan.steps[i];
        match (&step.operation, &event, local) {
            (Operation::Watch(w), Event::Submission { .. }, Some(l)) if w.local == l => {}
            (
                Operation::Call { .. },
                Event::Dispatch {}
                | Event::Returned { .. }
                | Event::ConfirmedFailure {}
                | Event::Unknown {}
                | Event::ReturnTooLarge {},
                None,
            ) => {}
            _ => return Err(execution("address")),
        }
        let (slot, kind, payload) = event.identity()?;
        let key = (address.position, slot);
        if let Some((previous, value)) = self.seen.get(&key) {
            return if *previous == kind && value.equivalent(&payload) {
                Ok(())
            } else {
                Err(execution("conflict"))
            };
        }
        if self.failure.is_some() {
            return Err(execution("closed"));
        }
        match event {
            Event::Dispatch {} => {
                let State::Call { dispatched, .. } = &mut self.states[i] else {
                    return Err(execution("not_ready"));
                };
                *dispatched = true;
                self.outstanding += 1;
            }
            Event::Submission { .. } => {
                let Operation::Watch(w) = &step.operation else {
                    unreachable!()
                };
                let State::Open { .. } = self.states[i] else {
                    return Err(execution("not_open"));
                };
                let Payload::Json(value) = &payload else {
                    unreachable!()
                };
                ValueBudget::default().charge(value, 0, ErrorStage::Input)?;
                if w.input_schema.is_some() {
                    self.plan.contracts.check(
                        &format!("local-input-{}", step.id),
                        value,
                        ErrorStage::Input,
                    )?;
                }
                // Admission succeeded. Any subsequent binding or decision failure is durable.
                if let Err(e) = self.submit(i, value) {
                    self.failure = Some((i, e));
                }
            }
            outcome => {
                let State::Call {
                    input,
                    dispatched: true,
                    ..
                } = &self.states[i]
                else {
                    return Err(execution("not_dispatched"));
                };
                self.outstanding -= 1;
                let next = match outcome {
                    Event::ReturnTooLarge {} => {
                        Err(DefinitionError::new(ErrorStage::Output, "size"))
                    }
                    Event::Returned { .. } => match &payload {
                        Payload::Json(value) => self.finish_step(step, input, Some(value)),
                        Payload::InvalidReturn(_, e) => Err(*e),
                        Payload::None => unreachable!(),
                    },
                    Event::ConfirmedFailure {}
                        if matches!(step.operation, Operation::Call { tolerate: true, .. }) =>
                    {
                        Ok(State::Tolerated)
                    }
                    Event::ConfirmedFailure {} => Err(execution("confirmed_failure")),
                    Event::Unknown {} => Err(execution("unknown_outcome")),
                    _ => unreachable!(),
                };
                match next {
                    Ok(state) => self.states[i] = state,
                    Err(e) => self.failure = Some((i, e)),
                }
            }
        }
        self.seen.insert(key, (kind, payload));
        self.advance();
        Ok(())
    }

    fn submit(&mut self, i: usize, value: &Value) -> Result<()> {
        let step = &self.plan.steps[i];
        let Operation::Watch(w) = &step.operation else {
            unreachable!()
        };
        let adopted = w.adopt(step.id, value, &self.plan.contracts)?;
        let State::Open { results, budget } = &mut self.states[i] else {
            unreachable!()
        };
        // The view places each admitted value inside an object and its results array.
        budget.charge(&adopted, 2, ErrorStage::Output)?;
        results.push(adopted);
        let source = self.indices[step.needs[0].from];
        let State::Succeeded {
            output: Some(observed),
            ..
        } = &self.states[source]
        else {
            unreachable!()
        };
        let State::Open { results, .. } = &self.states[i] else {
            unreachable!()
        };
        if let Some((exit, output)) = w.select(
            results,
            (observed, self.plan.steps[source].output_schema),
            &self.plan.contracts,
        )? {
            self.states[i] = self.success(step, Some(output), Some(exit.into()))?;
        }
        Ok(())
    }

    fn projection(&self) -> Value {
        let mut calls = Vec::new();
        let mut waits = Vec::new();
        let mut tolerated = Vec::new();
        let mut exits = BTreeMap::new();
        for &i in &self.plan.order {
            let step = &self.plan.steps[i];
            match (&step.operation, &self.states[i]) {
                (
                    Operation::Call { target, .. },
                    State::Call {
                        argument,
                        dispatched,
                        ..
                    },
                ) if self.failure.is_none() => {
                    calls.push(json!({"address":self.address(step.id),"target":target,
                        "state":if *dispatched {"awaitingOutcome"} else {"ready"},"inputJson":argument.to_string()}));
                }
                (Operation::Watch(w), State::Pending | State::Open { .. })
                    if self.failure.is_none() =>
                {
                    let count = match &self.states[i] {
                        State::Open { results, .. } => results.len(),
                        _ => 0,
                    };
                    waits.push(json!({"address":self.address(&format!("{}/{}",step.id,w.local)), "accepting":matches!(self.states[i],State::Open{..}),"count":count}));
                }
                (_, State::Tolerated) => tolerated.push(self.address(step.id)),
                (
                    _,
                    State::Succeeded {
                        exit: Some(exit), ..
                    },
                ) => {
                    exits.insert(step.id, exit);
                }
                _ => {}
            }
        }
        let mut result = json!({"version":VERSION,"status":if self.failure.is_some() {"failed"} else if calls.is_empty() && waits.is_empty() {"completed"} else {"waiting"},
            "calls":calls,"waits":waits,"tolerated":tolerated,"exits":exits});
        if let Some((i, e)) = self.failure {
            result["failure"] = json!({"position":self.plan.steps[i].id,"error":e.to_string()});
        }
        if let Some(i) = self.plan.delivery
            && let State::Succeeded {
                output: Some(v), ..
            } = &self.states[i]
        {
            result["deliveryJson"] = Value::String(v.to_string());
        }
        result
    }
}
