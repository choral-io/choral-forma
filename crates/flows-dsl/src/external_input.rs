//! Static business contracts for the externally supplied inputs in a replay plan.
use serde_json::Value;

use crate::{
    Contracts, DefinitionError, ErrorStage, Operation, Plan, Result, Step, ValueBudget, Watcher,
    compile_execution, encoded_size, input_key, parse, parse_document,
};

pub(super) fn submission_key(watcher: &str) -> String {
    format!("local-input-{watcher}")
}

pub(super) struct InputContract<'a> {
    schema: Option<&'a Value>,
    key: String,
}

impl<'a> Step<'a> {
    pub(super) fn entry_input(&self) -> InputContract<'a> {
        InputContract {
            schema: self.input_schema,
            key: input_key(self.id),
        }
    }
}

impl<'a> Watcher<'a> {
    pub(super) fn submission_input(&self, id: &str) -> InputContract<'a> {
        InputContract {
            schema: self.input_schema,
            key: submission_key(id),
        }
    }
}

impl<'a> Plan<'a> {
    fn external_input_at(&self, position: &str) -> Result<InputContract<'a>> {
        let entry = self.entry();
        if position == entry.id {
            return Ok(entry.entry_input());
        }
        if let Some((owner, local)) = position.split_once('/')
            && let Some(step) = self.steps.iter().find(|s| s.id == owner)
            && let Operation::Watch(watcher) = &step.operation
            && local == watcher.local
        {
            return Ok(watcher.submission_input(owner));
        }
        Err(DefinitionError::new(ErrorStage::Execution, "position"))
    }
}

impl InputContract<'_> {
    pub(super) fn parse(&self, input_json: &str, contracts: &Contracts) -> Result<Value> {
        let input = parse(input_json, ErrorStage::Input)?;
        self.check(&input, contracts)?;
        Ok(input)
    }

    pub(super) fn check(&self, value: &Value, contracts: &Contracts) -> Result<()> {
        ValueBudget::default().charge(value, 0, ErrorStage::Input)?;
        if self.schema.is_some() {
            contracts.check(&self.key, value, ErrorStage::Input)?;
        }
        Ok(())
    }
}

/// Return the standalone Draft 2020-12 business Schema for an inventory entry or submission
/// position, including its transitive local references. An omitted Schema returns JSON true.
pub fn execution_input_schema(source: &str, position: &str) -> Result<String> {
    let document = parse_document(source)?;
    let plan = compile_execution(&document)?;
    let input = plan.external_input_at(position)?;
    Ok(plan.contracts.standalone(input.schema)?.to_string())
}

/// Check exact JSON text against the same value limits and input contract used at admission.
/// This checks the position's static contract without starting an execution or adopting a fact.
pub fn validate_execution_input(source: &str, position: &str, input_json: &str) -> Result<()> {
    let document = parse_document(source)?;
    let plan = compile_execution(&document)?;
    let input = plan.external_input_at(position)?;
    let value = input.parse(input_json, &plan.contracts)?;
    if position == plan.entry().id {
        // Entry activation also bounds the encoded fixed step input. Number normalization
        // can make it larger than the original text even when the wire budget passed.
        encoded_size(&value.to_string(), ErrorStage::Input)?;
    }
    Ok(())
}
