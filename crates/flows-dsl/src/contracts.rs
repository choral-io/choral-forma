use std::collections::{BTreeMap, BTreeSet};
use std::sync::LazyLock;

use jsonschema::{Retrieve, Uri, Validator, ValidatorMap};
use serde_json::{Map, Value, json};

use crate::error::{DefinitionError, ErrorStage, Result, definition};

/// Cargo features unify across consumers. Explicitly denying retrieval keeps every validator
/// offline even when another dependency enables jsonschema's default retrievers.
struct NoExternalRetrieval;

impl Retrieve for NoExternalRetrieval {
    fn retrieve(
        &self,
        _uri: &Uri<String>,
    ) -> std::result::Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        Err("External Schema retrieval is disabled".into())
    }
}

fn offline_validator() -> jsonschema::ValidationOptions<'static> {
    jsonschema::draft202012::options().with_retriever(NoExternalRetrieval)
}

pub(crate) static GRAMMAR: LazyLock<Validator> = LazyLock::new(|| {
    let schema = serde_json::from_str(include_str!("../contract/definition.schema.json"))
        .expect("the bundled Definition schema is valid JSON");
    offline_validator()
        .build(&schema)
        .expect("the bundled Definition schema compiles offline")
});

/// One validator map shares the in-document named resources across all step contracts.
pub(crate) struct Contracts {
    validators: ValidatorMap,
    named: BTreeMap<String, Value>,
}

impl Contracts {
    pub(crate) fn compile<'a>(
        named: Option<&Map<String, Value>>,
        schemas: impl IntoIterator<Item = (String, &'a Value)>,
    ) -> Result<Self> {
        let mut definitions = Map::new();
        let mut named_refs = BTreeMap::new();
        let mut original = BTreeMap::new();
        for (name, schema) in named.into_iter().flatten() {
            let mut references = BTreeSet::new();
            definitions.insert(format!("name-{name}"), normalize(schema, &mut references)?);
            named_refs.insert(name.as_str(), references);
            original.insert(name.clone(), schema.clone());
        }
        let mut validated = BTreeMap::new();
        for &name in named_refs.keys() {
            check_references(name, &named_refs, &mut BTreeSet::new(), &mut validated)?;
        }
        for (key, schema) in schemas {
            let mut references = BTreeSet::new();
            definitions.insert(key, normalize(schema, &mut references)?);
            if references.iter().any(|name| !named_refs.contains_key(name)) {
                return Err(definition("contract"));
            }
        }
        let validators = offline_validator()
            .build_map(&json!({"$defs": definitions}))
            .map_err(|_| definition("contract"))?;
        Ok(Self {
            validators,
            named: original,
        })
    }

    pub(crate) fn check(&self, key: &str, value: &Value, stage: ErrorStage) -> Result<()> {
        let validator = self
            .validators
            .get(&format!("#/$defs/{key}"))
            .ok_or_else(|| definition("contract"))?;
        if !validator.is_valid(value) {
            return Err(DefinitionError::new(stage, "contract"));
        }
        Ok(())
    }

    pub(crate) fn resolve<'a>(&'a self, schema: Option<&'a Value>) -> Option<&'a Value> {
        let mut schema = schema?;
        while let Some(reference) = schema.get("$ref").and_then(Value::as_str) {
            // Construction rejects missing and cyclic references.
            schema = self.named.get(reference)?;
        }
        Some(schema)
    }

    pub(crate) fn property<'a>(
        &'a self,
        schema: Option<&'a Value>,
        key: &str,
    ) -> Option<&'a Value> {
        let schema = self.resolve(schema)?;
        schema
            .get("properties")
            .and_then(|properties| properties.get(key))
            .or_else(|| schema.get("additionalProperties"))
    }

    pub(crate) fn items<'a>(&'a self, schema: Option<&'a Value>) -> Option<&'a Value> {
        self.resolve(schema)?.get("items")
    }

    pub(crate) fn requires_integer(&self, schema: Option<&Value>) -> bool {
        match self.resolve(schema).and_then(|schema| schema.get("type")) {
            Some(Value::String(kind)) => kind == "integer",
            Some(Value::Array(kinds)) => {
                kinds.iter().any(|kind| kind == "integer")
                    && !kinds.iter().any(|kind| kind == "number")
            }
            _ => false,
        }
    }
}

fn normalize<'a>(schema: &'a Value, references: &mut BTreeSet<&'a str>) -> Result<Value> {
    if schema.is_boolean() {
        return Ok(schema.clone());
    }
    let source = schema.as_object().ok_or_else(|| definition("contract"))?;
    if let Some(reference) = source.get("$ref") {
        let name = reference.as_str().ok_or_else(|| definition("contract"))?;
        if source.len() != 1 || !local_name(name) {
            return Err(definition("contract"));
        }
        references.insert(name);
        return Ok(json!({"$ref": format!("#/$defs/name-{name}")}));
    }
    let mut result = Map::new();
    for (key, value) in source {
        let normalized = match key.as_str() {
            "type" | "required" | "minimum" | "maximum" | "exclusiveMinimum"
            | "exclusiveMaximum" | "title" | "description" | "const" | "minLength" => value.clone(),
            "items" | "additionalProperties" => normalize(value, references)?,
            "properties" => Value::Object(
                value
                    .as_object()
                    .ok_or_else(|| definition("contract"))?
                    .iter()
                    .map(|(name, child)| Ok((name.clone(), normalize(child, references)?)))
                    .collect::<Result<_>>()?,
            ),
            _ => return Err(definition("contract")),
        };
        result.insert(key.clone(), normalized);
    }
    Ok(Value::Object(result))
}

fn local_name(name: &str) -> bool {
    let mut bytes = name.bytes();
    matches!(bytes.next(), Some(c) if c.is_ascii_alphabetic() || c == b'_')
        && bytes.all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
}

fn check_references<'a>(
    name: &'a str,
    references: &BTreeMap<&'a str, BTreeSet<&'a str>>,
    active: &mut BTreeSet<&'a str>,
    validated: &mut BTreeMap<&'a str, usize>,
) -> Result<usize> {
    if let Some(&depth) = validated.get(name) {
        return Ok(depth);
    }
    if active.len() >= 32 || !active.insert(name) {
        return Err(definition("contract"));
    }
    let mut depth = 1;
    for &target in references.get(name).ok_or_else(|| definition("contract"))? {
        depth = depth.max(1 + check_references(target, references, active, validated)?);
    }
    if depth > 32 {
        return Err(definition("contract"));
    }
    active.remove(name);
    validated.insert(name, depth);
    Ok(depth)
}

#[cfg(test)]
mod tests {
    use super::offline_validator;
    use serde_json::json;

    #[test]
    fn configured_retriever_denies_file_access() {
        // A real valid Schema would load if a consumer enabled jsonschema/resolve-file
        // and the validator accidentally used its default retriever.
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("contract/definition.schema.json");
        let schema = json!({"$ref": format!("file://{}", path.display())});
        assert!(offline_validator().build(&schema).is_err());
    }
}
