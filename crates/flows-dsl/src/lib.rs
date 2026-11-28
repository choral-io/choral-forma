#![doc = include_str!("../README.md")]

mod bindings;
mod contracts;
mod error;
mod execution;
mod external_input;
mod topology;
mod values;
mod watcher;

pub use execution::{replay_execution, validate_execution};
pub use external_input::{execution_input_schema, validate_execution_input};
pub use topology::execution_topology;
use watcher::Watcher;

use std::collections::{BTreeMap, BTreeSet};

use bindings::{Binding, Roots};
use contracts::{Contracts, GRAMMAR};
use error::{Result, definition};
use serde_json::{Value, json};
use values::{MAX_BYTES, ValueBudget, parse};

pub use error::{DefinitionError, ErrorStage};

/// The Definition document profile accepted by this release.
pub const DEFINITION_PROFILE: &str = "choral/flows-v1-beta.2";
/// The JSON preview shape version, independent of the profile and the crate version.
pub const PREVIEW_VERSION: u32 = 1;

const MAX_STEPS: usize = 256;

#[derive(serde::Serialize)]
struct Dependency<'a> {
    alias: &'a str,
    from: &'a str,
    require: &'a str,
    #[serde(rename = "exit", skip_serializing_if = "Vec::is_empty")]
    exits: Vec<&'a str>,
}

impl Dependency<'_> {
    fn admits(&self, exit: &str) -> bool {
        self.exits.is_empty() || self.exits.contains(&exit)
    }
}

struct Step<'a> {
    id: &'a str,
    needs: Vec<Dependency<'a>>,
    input_schema: Option<&'a Value>,
    output_schema: Option<&'a Value>,
    input: Option<Binding>,
    output: Option<Binding>,
    publishes: bool,
    operation: Operation<'a>,
}

enum Operation<'a> {
    Pure,
    Call {
        target: &'a str,
        argument: Option<Binding>,
        tolerate: bool,
    },
    Watch(Box<Watcher<'a>>),
}

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Pure,
    Replay,
}

impl<'a> Step<'a> {
    fn compile(raw: &'a Value, mode: Mode) -> Result<Self> {
        if ["flow", "each", "repeat", "judge", "continue"]
            .iter()
            .any(|key| raw.get(key).is_some())
            || raw
                .get("remaining")
                .is_some_and(|policy| mode == Mode::Pure || policy != "retain")
            || (mode == Mode::Pure && (raw.get("watch").is_some() || raw.get("call").is_some()))
        {
            return Err(definition("unsupported_step"));
        }
        let id = raw["id"].as_str().ok_or_else(|| definition("step_id"))?;
        if raw.get("watch").is_some() {
            return Watcher::compile_step(raw, id);
        }
        let input = raw.get("input").ok_or_else(|| definition("step_input"))?;
        let output = raw.get("output");
        let mut output_roots = BTreeSet::from(["$input"]);
        let operation = if let Some(call) = raw.get("call") {
            let argument = call
                .get("input")
                .map(|bind| Binding::compile(bind, &output_roots))
                .transpose()?;
            output_roots.insert("$result");
            Operation::Call {
                target: call["target"].as_str().ok_or_else(|| definition("call"))?,
                argument,
                tolerate: call.get("onFailure").is_some(),
            }
        } else {
            Operation::Pure
        };
        let needs = raw["needs"]
            .as_object()
            .into_iter()
            .flatten()
            .map(|(alias, edge)| {
                let from = edge["from"]
                    .as_str()
                    .filter(|from| *from != "$context")
                    .filter(|_| mode == Mode::Replay || edge.get("exit").is_none())
                    .ok_or_else(|| definition("dependency"))?;
                let require = edge["require"]
                    .as_str()
                    .ok_or_else(|| definition("dependency"))?;
                // The document grammar has already checked name syntax, nonempty lists and uniqueness.
                let exits = match edge.get("exit") {
                    None => Vec::new(),
                    Some(Value::String(name)) => vec![name.as_str()],
                    Some(Value::Array(names)) => names
                        .iter()
                        .map(|v| v.as_str().ok_or_else(|| definition("dependency")))
                        .collect::<Result<_>>()?,
                    _ => return Err(definition("dependency")),
                };
                Ok(Dependency {
                    exits,
                    alias,
                    from,
                    require,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        let input_binding = input.get("bind");
        if needs.is_empty() == input_binding.is_some() {
            return Err(definition("entry_binding"));
        }
        let readable = needs
            .iter()
            .filter(|dependency| dependency.require == "output")
            .map(|dependency| dependency.alias)
            .collect();
        Ok(Self {
            id,
            needs,
            input_schema: input.get("schema"),
            output_schema: output.and_then(|v| v.get("schema")),
            input: input_binding
                .map(|binding| Binding::compile(binding, &readable))
                .transpose()?,
            output: output
                .and_then(|v| v.get("bind"))
                .map(|bind| Binding::compile(bind, &output_roots))
                .transpose()?,
            publishes: output.is_some(),
            operation,
        })
    }
}

struct Plan<'a> {
    id: &'a str,
    steps: Vec<Step<'a>>,
    order: Vec<usize>,
    deliveries: Vec<usize>,
    contracts: Contracts,
}

impl<'a> Plan<'a> {
    fn entry(&self) -> &Step<'a> {
        &self.steps[self.order[0]]
    }
}

fn parse_document(source: &str) -> Result<Value> {
    let document = parse(source, ErrorStage::Definition)?;
    if document["dsl"] != DEFINITION_PROFILE || !GRAMMAR.is_valid(&document) {
        return Err(definition("schema"));
    }
    if document.get("imports").is_some() {
        return Err(definition("unsupported_imports"));
    }
    Ok(document)
}

fn compile(document: &Value, mode: Mode) -> Result<Option<Plan<'_>>> {
    let named = document["schemas"].as_object();
    let Some(definition) = document.get("definition") else {
        Contracts::compile(named, [])?;
        return Ok(None);
    };
    compile_definition(definition, named, mode).map(Some)
}

fn compile_execution(document: &Value) -> Result<Plan<'_>> {
    compile(document, Mode::Replay)?.ok_or_else(|| definition("schemas_only"))
}

fn compile_definition<'a>(
    raw: &'a Value,
    named: Option<&serde_json::Map<String, Value>>,
    mode: Mode,
) -> Result<Plan<'a>> {
    if raw.get("context").is_some() || raw.get("definitions").is_some() {
        return Err(definition("unsupported_definition"));
    }
    let id = raw["id"]
        .as_str()
        .ok_or_else(|| definition("definition_id"))?;
    let raw_steps = raw["steps"]
        .as_array()
        .filter(|steps| steps.len() <= MAX_STEPS)
        .ok_or_else(|| definition("steps"))?;
    let steps = raw_steps
        .iter()
        .map(|raw| Step::compile(raw, mode))
        .collect::<Result<Vec<_>>>()?;
    let (order, deliveries) = order_steps(&steps)?;
    let schemas = steps.iter().flat_map(|step| {
        let local = match &step.operation {
            Operation::Watch(watch) => watch.schemas(step.id),
            _ => [None, None],
        };
        [
            step.input_schema.map(|schema| (input_key(step.id), schema)),
            step.output_schema
                .map(|schema| (output_key(step.id), schema)),
        ]
        .into_iter()
        .chain(local)
        .flatten()
    });
    let contracts = Contracts::compile(named, schemas)?;
    Ok(Plan {
        id,
        steps,
        order,
        deliveries,
        contracts,
    })
}

fn order_steps(steps: &[Step<'_>]) -> Result<(Vec<usize>, Vec<usize>)> {
    let by_name: BTreeMap<_, _> = steps
        .iter()
        .enumerate()
        .map(|(index, step)| (step.id, index))
        .collect();
    if by_name.len() != steps.len() {
        return Err(definition("duplicate_step"));
    }
    let mut routing_watcher = None;
    let mut dependents = vec![Vec::new(); steps.len()];
    let mut remaining = Vec::new();
    for (index, step) in steps.iter().enumerate() {
        for dependency in &step.needs {
            let from = by_name
                .get(dependency.from)
                .copied()
                .ok_or_else(|| definition("dependency"))?;
            if dependency.require == "output" && !steps[from].publishes {
                return Err(definition("dependency"));
            }
            if !dependency.exits.is_empty() {
                let Operation::Watch(watcher) = &steps[from].operation else {
                    return Err(definition("dependency"));
                };
                if dependency
                    .exits
                    .iter()
                    .any(|name| !watcher.exits().any(|exit| exit == *name))
                {
                    return Err(definition("dependency"));
                }
                if routing_watcher.is_some_and(|(previous, _)| previous != from) {
                    return Err(definition("unsupported_exit_routing"));
                }
                routing_watcher = Some((from, watcher));
            }
            dependents[from].push(index);
        }
        remaining.push(step.needs.len());
    }
    let mut ready: BTreeSet<_> = remaining
        .iter()
        .enumerate()
        .filter_map(|(index, count)| (*count == 0).then_some((steps[index].id, index)))
        .collect();
    let terminals: Vec<_> = (0..steps.len())
        .filter(|&i| dependents[i].is_empty() && steps[i].publishes)
        .collect();
    if ready.len() != 1
        || (routing_watcher.is_none() && terminals.len() > 1)
        || terminals
            .iter()
            .any(|&i| matches!(steps[i].operation, Operation::Watch(_)))
    {
        return Err(definition("entry_or_delivery"));
    }
    let mut order = Vec::new();
    // The authored step order is for presentation. Use IDs to order ready steps.
    while let Some((_, index)) = ready.pop_first() {
        order.push(index);
        for &dependent in &dependents[index] {
            remaining[dependent] -= 1;
            if remaining[dependent] == 0 {
                ready.insert((steps[dependent].id, dependent));
            }
        }
    }
    if order.len() != steps.len() {
        return Err(definition("cycle"));
    }
    let deliveries = if let Some((_, watcher)) = routing_watcher {
        routed_deliveries(steps, &order, &by_name, &terminals, watcher)?
    } else {
        terminals
    };
    Ok((order, deliveries))
}

fn routed_deliveries(
    steps: &[Step<'_>],
    order: &[usize],
    by_name: &BTreeMap<&str, usize>,
    terminals: &[usize],
    watcher: &Watcher<'_>,
) -> Result<Vec<usize>> {
    let mut candidates = BTreeSet::new();
    // One routing Watcher gives a finite list of paths even when it has many descendants.
    for exit in watcher.exits() {
        let mut active = vec![false; steps.len()];
        for &i in order {
            active[i] = steps[i]
                .needs
                .iter()
                .all(|n| active[by_name[n.from]] && n.admits(exit));
            if !active[i] && matches!(steps[i].operation, Operation::Watch(_)) {
                // An observation cannot exclude its owning Watcher. Conditional Watcher
                // scopes need an explicit child or an independently releasable wait.
                return Err(definition("unsupported_watch"));
            }
        }
        let mut reachable = terminals.iter().copied().filter(|&i| active[i]);
        let delivery = reachable.next();
        if reachable.next().is_some() || (delivery.is_none() && !terminals.is_empty()) {
            return Err(definition("entry_or_delivery"));
        }
        candidates.extend(delivery);
    }
    Ok(order
        .iter()
        .copied()
        .filter(|i| candidates.contains(i))
        .collect())
}

fn input_key(id: &str) -> String {
    format!("input-{id}")
}

fn output_key(id: &str) -> String {
    format!("output-{id}")
}

fn encoded_size(value: &str, stage: ErrorStage) -> Result<()> {
    if value.len() > MAX_BYTES {
        return Err(DefinitionError::new(stage, "size"));
    }
    Ok(())
}

/// Validate a Definition or Schema resource document and return a JSON preview.
///
/// The preview includes `kind`, `profile`, and `version`. A runnable Definition
/// also includes `id`, `entry`, `delivery`, and dependency-ordered `steps`.
pub fn validate_definition(source: &str) -> std::result::Result<String, DefinitionError> {
    let document = parse_document(source)?;
    let Some(plan) = compile(&document, Mode::Pure)? else {
        return Ok(json!({
            "kind": "schemas",
            "profile": DEFINITION_PROFILE,
            "version": PREVIEW_VERSION,
        })
        .to_string());
    };
    Ok(json!({
        "kind": "definition",
        "profile": DEFINITION_PROFILE,
        "version": PREVIEW_VERSION,
        "id": plan.id,
        "entry": plan.order.first().map(|index| plan.steps[*index].id),
        "delivery": plan.order.last().map(|index| plan.steps[*index].id),
        "steps": plan.order.iter().map(|&index| {
            let step = &plan.steps[index];
            json!({
                "id": step.id,
                "needs": step.needs.iter().map(|need| json!({
                    "alias": need.alias,
                    "from": need.from,
                    "require": need.require,
                })).collect::<Vec<_>>(),
            })
        }).collect::<Vec<_>>(),
    })
    .to_string())
}

/// Run a bounded Definition with an authored JSON input and return the exact JSON delivery.
///
/// A host should preserve this string across handoff and storage rather than
/// decoding its numbers through an IEEE-754-only representation.
pub fn run_definition(
    source: &str,
    input_json: &str,
) -> std::result::Result<String, DefinitionError> {
    let document = parse_document(source)?;
    let plan = compile(&document, Mode::Pure)?.ok_or_else(|| definition("schemas_only"))?;
    let input = parse(input_json, ErrorStage::Input)?;
    ValueBudget::default().charge(&input, 0, ErrorStage::Input)?;
    let mut initial = Some(input);
    let mut outputs = BTreeMap::<&str, (Value, Option<&Value>)>::new();
    let mut uses = BTreeMap::<&str, usize>::new();
    for step in &plan.steps {
        for dependency in &step.needs {
            if dependency.require == "output" {
                *uses.entry(dependency.from).or_default() += 1;
            }
        }
    }
    for &index in &plan.order {
        let step = &plan.steps[index];
        let input = if let Some(binding) = &step.input {
            let mut roots = Roots::new();
            for dependency in &step.needs {
                if dependency.require == "output" {
                    let (value, schema) = outputs
                        .get(dependency.from)
                        .ok_or_else(|| DefinitionError::new(ErrorStage::Binding, "dependency"))?;
                    roots.insert(dependency.alias, (value, *schema));
                }
            }
            binding.evaluate(&roots, &plan.contracts, ErrorStage::Input)?
        } else {
            initial.take().ok_or_else(|| definition("entry_binding"))?
        };
        for dependency in &step.needs {
            if dependency.require == "output"
                && let Some(remaining) = uses.get_mut(dependency.from)
            {
                *remaining -= 1;
                if *remaining == 0 {
                    outputs.remove(dependency.from);
                }
            }
        }
        encoded_size(&input.to_string(), ErrorStage::Input)?;
        if step.input_schema.is_some() {
            plan.contracts
                .check(&input_key(step.id), &input, ErrorStage::Input)?;
        }
        let roots = Roots::from([("$input", (&input, step.input_schema))]);
        let value = step
            .output
            .as_ref()
            .ok_or_else(|| definition("step_output"))?
            .evaluate(&roots, &plan.contracts, ErrorStage::Output)?;
        if step.output_schema.is_some() {
            plan.contracts
                .check(&output_key(step.id), &value, ErrorStage::Output)?;
        }
        let encoded = value.to_string();
        encoded_size(&encoded, ErrorStage::Output)?;
        if plan.order.last() == Some(&index) {
            return Ok(encoded);
        }
        if uses.contains_key(step.id) {
            outputs.insert(step.id, (value, step.output_schema));
        }
    }
    Err(DefinitionError::new(ErrorStage::Output, "no_delivery"))
}
