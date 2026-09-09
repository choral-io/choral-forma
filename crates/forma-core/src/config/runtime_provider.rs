//! One declaration owns the public provider shape and its payload parser.
//!
//! The public format remains internally tagged. Parsing uses an externally
//! tagged intermediate so serde_path_to_error can track payload fields instead
//! of losing them inside serde's internally tagged enum buffer.

use serde::{Deserialize, Serialize};
use serde_yml::Value;

macro_rules! runtime_providers {
    (
        payloads { $( $variant:ident { $( $(#[$attr:meta])* $field:ident: $ty:ty ),* $(,)? } ),* $(,)? }
        units { $( $unit:ident ),* $(,)? }
    ) => {
        #[derive(Debug, Clone, PartialEq, Serialize)]
        #[serde(tag = "kind", rename_all = "camelCase")]
        pub enum RuntimeValueProvider {
            $( $variant { $( $(#[$attr])* $field: $ty ),* }, )*
            $( $unit, )*
        }

        // Preserve serde's exact internally tagged acceptance semantics. The
        // external representation below is only used to refine a real failure.
        #[derive(Debug, Deserialize)]
        #[cfg_attr(test, derive(Serialize))]
        #[serde(tag = "kind", rename_all = "camelCase")]
        enum ProviderInput {
            $( $variant { $( $(#[$attr])* $field: $ty ),* }, )*
            $( $unit, )*
        }

        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        enum ProviderPayload {
            $( $variant { $( $(#[$attr])* $field: $ty ),* }, )*
            $( $unit, )*
        }

        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        enum ProviderKind { $( $variant, )* $( $unit, )* }

        impl ProviderKind {
            fn is_unit(&self) -> bool {
                match self {
                    $( Self::$variant => false, )*
                    $( Self::$unit => true, )*
                }
            }
        }

        impl From<ProviderInput> for RuntimeValueProvider {
            fn from(input: ProviderInput) -> Self {
                match input {
                    $( ProviderInput::$variant { $( $field ),* } => Self::$variant { $( $field ),* }, )*
                    $( ProviderInput::$unit => Self::$unit, )*
                }
            }
        }

        impl From<ProviderPayload> for RuntimeValueProvider {
            fn from(payload: ProviderPayload) -> Self {
                match payload {
                    $( ProviderPayload::$variant { $( $field ),* } => Self::$variant { $( $field ),* }, )*
                    $( ProviderPayload::$unit => Self::$unit, )*
                }
            }
        }
    };
}

runtime_providers! {
    payloads {
        Const {
            value: Value,
            #[serde(default)]
            required: bool,
            #[serde(skip_serializing_if = "Option::is_none")]
            transform: Option<String>,
        },
        GitConfig {
            key: String,
            #[serde(default)]
            required: bool,
            #[serde(skip_serializing_if = "Option::is_none")]
            transform: Option<String>,
        },
    }
    units { CurrentDate, CurrentDateTime, WorkspaceRoot }
}

#[derive(Deserialize)]
struct ProviderTag {
    kind: ProviderKind,
}

#[derive(Debug)]
pub(super) struct ProviderParseError {
    pub path: Vec<String>,
    pub source: serde_yml::Error,
}

impl ProviderParseError {
    fn from_tracked(error: serde_path_to_error::Error<serde_yml::Error>) -> Self {
        let mut path = error
            .path()
            .iter()
            .filter_map(|segment| match segment {
                serde_path_to_error::Segment::Map { key } => Some(key.clone()),
                serde_path_to_error::Segment::Seq { index } => Some(index.to_string()),
                // The external enum tag is an adapter detail, not a nested key.
                serde_path_to_error::Segment::Enum { .. }
                | serde_path_to_error::Segment::Unknown => None,
            })
            .collect::<Vec<_>>();
        // A missing payload field is caused by the selected variant or a whole
        // provider replacement; there is no existing field value to blame.
        if path.is_empty() {
            path.push("kind".to_string());
        }
        Self {
            path,
            source: error.into_inner(),
        }
    }
}

pub(super) fn parse(value: Value) -> Result<RuntimeValueProvider, ProviderParseError> {
    let original_error = match serde_yml::from_value::<ProviderInput>(value.clone()) {
        Ok(input) => return Ok(input.into()),
        Err(error) => error,
    };
    let tag: ProviderTag =
        serde_path_to_error::deserialize(&value).map_err(ProviderParseError::from_tracked)?;
    // The tag probe can unwrap YAML tags; its success does not prove the
    // original value is a mapping or kind is a plain string. Only refine the
    // supported representation, retaining the original error otherwise.
    let Value::Mapping(mut fields) = value else {
        return Err(ProviderParseError {
            path: Vec::new(),
            source: original_error,
        });
    };
    let Some(Value::String(kind)) = fields.remove(Value::String("kind".to_string())) else {
        return Err(ProviderParseError {
            path: Vec::new(),
            source: original_error,
        });
    };
    let payload = if tag.kind.is_unit() {
        Value::Null
    } else {
        Value::Mapping(fields)
    };
    let external = Value::Tagged(Box::new(serde_yml::value::TaggedValue {
        tag: serde_yml::value::Tag::new(kind),
        value: payload,
    }));
    match serde_path_to_error::deserialize::<_, ProviderPayload>(external) {
        Err(error) => Err(ProviderParseError::from_tracked(error)),
        // Internal tagging has additional format restrictions (notably nested
        // YAML tags). Never turn such an original failure into a success.
        Ok(_) => Err(ProviderParseError {
            path: Vec::new(),
            source: original_error,
        }),
    }
}

impl<'de> Deserialize<'de> for RuntimeValueProvider {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let value = Value::deserialize(deserializer)?;
        parse(value).map_err(|error| serde::de::Error::custom(error.source))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Deliberately exhaustive, including fields. Changing the schema forces a
    // compile-time review of the compatibility matrix rather than silently
    // leaving a new variant or field untested.
    fn assert_covered_schema(provider: &RuntimeValueProvider) {
        match provider {
            RuntimeValueProvider::Const {
                value: _,
                required: _,
                transform: _,
            }
            | RuntimeValueProvider::GitConfig {
                key: _,
                required: _,
                transform: _,
            }
            | RuntimeValueProvider::CurrentDate
            | RuntimeValueProvider::CurrentDateTime
            | RuntimeValueProvider::WorkspaceRoot => {}
        }
    }

    #[test]
    fn parser_preserves_the_derived_provider_contract() {
        let mut inputs = Vec::new();
        for kind in [
            "const",
            "gitConfig",
            "currentDate",
            "currentDateTime",
            "workspaceRoot",
        ] {
            let base: Value =
                serde_yml::from_str(&format!("kind: {kind}\nkey: user.name\nvalue: 42")).unwrap();
            inputs.push(base.clone());
            for field in ["kind", "key", "value", "required", "transform", "unknown"] {
                let mut missing = base.clone();
                missing
                    .as_mapping_mut()
                    .unwrap()
                    .remove(Value::String(field.into()));
                inputs.push(missing);
                for yaml in [
                    "null",
                    "true",
                    "42",
                    "''",
                    "word",
                    "[]",
                    "[a, b]",
                    "{}",
                    "{a: b}",
                    "!custom {a: b}",
                ] {
                    let mut changed = base.clone();
                    changed.as_mapping_mut().unwrap().insert(
                        Value::String(field.into()),
                        serde_yml::from_str(yaml).unwrap(),
                    );
                    inputs.push(changed);
                }
            }
        }
        for yaml in ["null", "[]", "plain", "42", "{}"] {
            inputs.push(serde_yml::from_str(yaml).unwrap());
        }
        // The struct tag probe accepts YAML wrappers that the internally tagged
        // enum rejects. Exercise those wrappers around every payload and kind.
        let tagged = inputs
            .iter()
            .cloned()
            .map(|value| {
                Value::Tagged(Box::new(serde_yml::value::TaggedValue {
                    tag: serde_yml::value::Tag::new("outer"),
                    value,
                }))
            })
            .collect::<Vec<_>>();
        inputs.extend(tagged);
        for yaml in [
            "{kind: !const null, value: 42}",
            "{kind: !currentDate null}",
            "!outer {kind: const, value: !inner foo}",
        ] {
            inputs.push(serde_yml::from_str(yaml).unwrap());
        }
        for input in inputs {
            let old = serde_yml::from_value::<ProviderInput>(input.clone());
            let new = serde_yml::from_value::<RuntimeValueProvider>(input.clone());
            assert_eq!(
                old.is_ok(),
                new.is_ok(),
                "acceptance changed for {input:?}: old={old:?}, new={new:?}"
            );
            if let (Ok(old), Ok(new)) = (old, new) {
                assert_covered_schema(&new);
                assert_eq!(
                    serde_yml::to_value(old).unwrap(),
                    serde_yml::to_value(new).unwrap(),
                    "value changed for {input:?}"
                );
            }
        }
    }

    #[test]
    fn payload_errors_keep_their_field_paths() {
        for (yaml, field) in [
            ("kind: gitConfig\nkey: []", "key"),
            ("kind: gitConfig\nkey: ok\nrequired: []", "required"),
            ("kind: const\nvalue: null\nrequired: []", "required"),
            ("kind: const\nvalue: {a: b}\ntransform: []", "transform"),
            ("kind: gitConfig\nkey: ok\ntransform: []", "transform"),
            ("kind: unknown", "kind"),
            ("kind: gitConfig", "kind"),
        ] {
            let error = parse(serde_yml::from_str(yaml).unwrap()).unwrap_err();
            assert_eq!(error.path, [field], "{yaml}");
        }
    }
}
