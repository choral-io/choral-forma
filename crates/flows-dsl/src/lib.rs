#![doc = include_str!("../README.md")]

mod bindings;
mod contracts;
mod error;
mod values;

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

struct Dependency<'a> {
    alias: &'a str,
    from: &'a str,
    require: &'a str,
}

struct Step<'a> {
    id: &'a str,
    needs: Vec<Dependency<'a>>,
    input_schema: Option<&'a Value>,
    output_schema: Option<&'a Value>,
    input: Option<Binding>,
    output: Binding,
}

impl<'a> Step<'a> {
    fn compile(raw: &'a Value) -> Result<Self> {
        if [
            "call",
            "flow",
            "watch",
            "each",
            "repeat",
            "judge",
            "continue",
            "remaining",
        ]
        .iter()
        .any(|key| raw.get(key).is_some())
        {
            return Err(definition("unsupported_step"));
        }
        let id = raw["id"].as_str().ok_or_else(|| definition("step_id"))?;
        let input = raw.get("input").ok_or_else(|| definition("step_input"))?;
        let output = raw.get("output").ok_or_else(|| definition("step_output"))?;
        let output_binding = output
            .get("bind")
            .ok_or_else(|| definition("step_output"))?;
        let needs = raw["needs"]
            .as_object()
            .into_iter()
            .flatten()
            .map(|(alias, edge)| {
                let from = edge["from"]
                    .as_str()
                    .filter(|from| *from != "$context")
                    .filter(|_| edge.get("exit").is_none())
                    .ok_or_else(|| definition("dependency"))?;
                let require = edge["require"]
                    .as_str()
                    .ok_or_else(|| definition("dependency"))?;
                Ok(Dependency {
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
            output_schema: output.get("schema"),
            input: input_binding
                .map(|binding| Binding::compile(binding, &readable))
                .transpose()?,
            output: Binding::compile(output_binding, &BTreeSet::from(["$input"]))?,
        })
    }
}

struct Plan<'a> {
    id: &'a str,
    steps: Vec<Step<'a>>,
    order: Vec<usize>,
    contracts: Contracts,
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

fn compile(document: &Value) -> Result<Option<Plan<'_>>> {
    let named = document["schemas"].as_object();
    let Some(definition) = document.get("definition") else {
        Contracts::compile(named, [])?;
        return Ok(None);
    };
    compile_definition(definition, named).map(Some)
}

fn compile_definition<'a>(
    raw: &'a Value,
    named: Option<&serde_json::Map<String, Value>>,
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
        .map(Step::compile)
        .collect::<Result<Vec<_>>>()?;
    let order = order_steps(&steps)?;
    let schemas = steps.iter().flat_map(|step| {
        [
            step.input_schema.map(|schema| (input_key(step.id), schema)),
            step.output_schema
                .map(|schema| (output_key(step.id), schema)),
        ]
        .into_iter()
        .flatten()
    });
    let contracts = Contracts::compile(named, schemas)?;
    Ok(Plan {
        id,
        steps,
        order,
        contracts,
    })
}

fn order_steps(steps: &[Step<'_>]) -> Result<Vec<usize>> {
    let by_name: BTreeMap<_, _> = steps
        .iter()
        .enumerate()
        .map(|(index, step)| (step.id, index))
        .collect();
    if by_name.len() != steps.len() {
        return Err(definition("duplicate_step"));
    }
    let mut dependents = vec![Vec::new(); steps.len()];
    let mut remaining = Vec::new();
    for (index, step) in steps.iter().enumerate() {
        for dependency in &step.needs {
            let from = by_name
                .get(dependency.from)
                .copied()
                .ok_or_else(|| definition("dependency"))?;
            dependents[from].push(index);
        }
        remaining.push(step.needs.len());
    }
    let mut ready: BTreeSet<_> = remaining
        .iter()
        .enumerate()
        .filter_map(|(index, count)| (*count == 0).then_some((steps[index].id, index)))
        .collect();
    if ready.len() != 1 || dependents.iter().filter(|items| items.is_empty()).count() != 1 {
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
    Ok(order)
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
    let Some(plan) = compile(&document)? else {
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
    let plan = compile(&document)?.ok_or_else(|| definition("schemas_only"))?;
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
