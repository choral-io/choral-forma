use std::collections::BTreeSet;

use serde_json::{Value, json};

use crate::{
    Binding, Contracts, Dependency, ErrorStage, Operation, Result, Roots, Step, definition,
};

/// One directly observed output and one addressed local submission, gated by that source.
pub(super) struct Watcher<'a> {
    pub local: &'a str,
    pub local_need: Dependency<'a>,
    observed: &'a str,
    pub input_schema: Option<&'a Value>,
    local_output: Binding,
    local_schema: Option<&'a Value>,
    cases: Vec<Case<'a>>,
}

struct Case<'a> {
    exit: &'a str,
    when: Option<Binding>,
    output: Binding,
}

impl<'a> Watcher<'a> {
    pub fn exits(&self) -> impl Iterator<Item = &'a str> + '_ {
        self.cases.iter().map(|case| case.exit)
    }

    pub fn compile_step(raw: &'a Value, id: &'a str) -> Result<Step<'a>> {
        let unsupported = || definition("unsupported_watch");
        let watch = &raw["watch"];
        let observations = watch["observe"].as_object().ok_or_else(unsupported)?;
        if observations.len() != 2 || raw["output"].get("bind").is_some() {
            return Err(unsupported());
        }
        let (observed, connection) = observations
            .iter()
            .find(|(_, v)| v.get("from").is_some())
            .ok_or_else(unsupported)?;
        let from = connection["from"].as_str().ok_or_else(unsupported)?;
        let (local, step) = observations
            .iter()
            .find(|(k, _)| *k != observed)
            .ok_or_else(unsupported)?;
        let needs = step["needs"].as_object().ok_or_else(unsupported)?;
        let Some((alias, gate)) = needs.iter().next() else {
            return Err(unsupported());
        };
        if connection.get("collect").is_some()
            || needs.len() != 1
            || ["call", "flow", "remaining"]
                .iter()
                .any(|k| step.get(k).is_some())
            || step["input"].get("bind").is_some()
            || gate["from"] != from
            || gate["require"] != "success"
            || gate.get("exit").is_some()
        {
            return Err(unsupported());
        }
        let roots = BTreeSet::from([observed.as_str(), local.as_str()]);
        let raw_cases = watch["cases"].as_array().ok_or_else(unsupported)?;
        let mut cases = Vec::new();
        let mut exits = BTreeSet::new();
        for (i, case) in raw_cases.iter().enumerate() {
            if case["on"] != local.as_str()
                || (case.get("otherwise").is_some() && i + 1 != raw_cases.len())
            {
                return Err(unsupported());
            }
            let exit = case["exit"].as_str().ok_or_else(unsupported)?;
            if !exits.insert(exit) {
                return Err(definition("duplicate_exit"));
            }
            cases.push(Case {
                exit,
                when: case
                    .get("when")
                    .map(|v| Binding::compile(v, &roots))
                    .transpose()?,
                output: Binding::compile(
                    case["output"].get("bind").ok_or_else(unsupported)?,
                    &roots,
                )?,
            });
        }
        let watcher = Self {
            local,
            local_need: Dependency {
                alias,
                from,
                require: "success",
                exits: Vec::new(),
            },
            observed,
            input_schema: step["input"].get("schema"),
            local_schema: step["output"].get("schema"),
            local_output: Binding::compile(
                step["output"].get("bind").ok_or_else(unsupported)?,
                &BTreeSet::from(["$input"]),
            )?,
            cases,
        };
        Ok(Step {
            id,
            needs: vec![Dependency {
                alias: observed,
                from,
                require: "output",
                exits: Vec::new(),
            }],
            input_schema: None,
            input: None,
            output_schema: raw["output"].get("schema"),
            output: None,
            publishes: true,
            operation: Operation::Watch(Box::new(watcher)),
        })
    }

    pub fn position(&self, owner: &str) -> String {
        format!("{owner}/{}", self.local)
    }

    pub fn schemas(&self, id: &str) -> [Option<(String, &'a Value)>; 2] {
        [
            self.input_schema
                .map(|s| (crate::external_input::submission_key(id), s)),
            self.local_schema.map(|s| (format!("local-output-{id}"), s)),
        ]
    }

    pub fn adopt(&self, id: &str, value: &Value, contracts: &Contracts) -> Result<Value> {
        let roots = Roots::from([("$input", (value, self.input_schema))]);
        let output = self
            .local_output
            .evaluate(&roots, contracts, ErrorStage::Output)?;
        if self.local_schema.is_some() {
            contracts.check(&format!("local-output-{id}"), &output, ErrorStage::Output)?;
        }
        Ok(output)
    }

    pub fn select(
        &self,
        submissions: &[Value],
        observed: (&Value, Option<&Value>),
        contracts: &Contracts,
    ) -> Result<Option<(&'a str, Value)>> {
        fn view_schema(item: Option<&Value>) -> Value {
            json!({"properties":{"count":{"type":"integer"},"results":{"items":item.unwrap_or(&Value::Bool(true))}}})
        }
        let source_schema = view_schema(observed.1);
        let local_schema = view_schema(self.local_schema);
        let source = json!({"known":true, "count":1, "results":[observed.0]});
        let local = json!({"known":true, "count":submissions.len(),"results":submissions});
        let roots = Roots::from([
            (self.observed, (&source, Some(&source_schema))),
            (self.local, (&local, Some(&local_schema))),
        ]);
        for case in &self.cases {
            if let Some(when) = &case.when {
                let decision = when.evaluate(&roots, contracts, ErrorStage::Expression)?;
                if !decision
                    .as_bool()
                    .ok_or_else(|| crate::DefinitionError::new(ErrorStage::Expression, "boolean"))?
                {
                    continue;
                }
            }
            return Ok(Some((
                case.exit,
                case.output
                    .evaluate(&roots, contracts, ErrorStage::Output)?,
            )));
        }
        Ok(None)
    }
}
