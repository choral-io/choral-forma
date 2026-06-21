use std::collections::{BTreeMap, BTreeSet};
use std::process::Command;

use chrono::{DateTime, SecondsFormat, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use serde_yml::{Number, Value};

use crate::config::{
    CreateInput, RuntimeValueProvider, SemanticType, SpaceDefinition, WorkspaceConfig,
};
use crate::diagnostics::{Diagnostic, DiagnosticLocation};
use crate::path::{FORMA_CONFIG_PATH, slugify_path_segment};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SchemaNode {
    Object {
        #[serde(default)]
        fields: BTreeMap<String, SchemaNode>,
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    String {
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    Number {
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    Integer {
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    Boolean {
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    Date {
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    #[serde(rename = "datetime")]
    DateTime {
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    Const {
        value: Value,
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    Enum {
        #[serde(rename = "enum")]
        enum_type: String,
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    Ref {
        target: Option<String>,
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
    List {
        items: Box<SchemaNode>,
        #[serde(default)]
        required: bool,
        #[serde(default)]
        readonly: bool,
        #[serde(default)]
        hidden: bool,
        #[serde(default)]
        label: Option<String>,
    },
}

impl SchemaNode {
    pub fn is_required(&self) -> bool {
        match self {
            Self::Object { required, .. }
            | Self::String { required, .. }
            | Self::Number { required, .. }
            | Self::Integer { required, .. }
            | Self::Boolean { required, .. }
            | Self::Date { required, .. }
            | Self::DateTime { required, .. }
            | Self::Const { required, .. }
            | Self::Enum { required, .. }
            | Self::Ref { required, .. }
            | Self::List { required, .. } => *required,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Transform {
    Slugify,
}

impl Transform {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "slugify" => Ok(Self::Slugify),
            other => Err(other.to_string()),
        }
    }

    fn apply(self, value: String) -> Result<String, String> {
        match self {
            Self::Slugify => slugify_path_segment(&value).map_err(|error| error.to_string()),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RuntimeValues {
    values: BTreeMap<String, Value>,
    pub diagnostics: Vec<Diagnostic>,
}

impl RuntimeValues {
    pub fn get(&self, name: &str) -> Option<&Value> {
        self.values.get(name)
    }

    pub fn get_string(&self, name: &str) -> Option<String> {
        self.get(name).and_then(value_to_string)
    }

    pub fn as_map(&self) -> &BTreeMap<String, Value> {
        &self.values
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedCreateInputs {
    pub values: BTreeMap<String, Value>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PlaceholderContext {
    pub input: BTreeMap<String, Value>,
    pub runtime_values: BTreeMap<String, Value>,
}

pub fn render_placeholder_template(
    template: &str,
    context: &PlaceholderContext,
) -> RenderedTemplate {
    let mut renderer = PlaceholderRenderer {
        context,
        diagnostics: Vec::new(),
    };
    let rendered = renderer.render_template(template);
    RenderedTemplate {
        value: rendered,
        diagnostics: renderer.diagnostics,
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct RenderedTemplate {
    pub value: Option<String>,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn validate_space_schemas(config: &WorkspaceConfig) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();

    for (space_id, space) in &config.spaces {
        let field_path = format!("spaces.{space_id}.schema");
        match parse_space_schema(space) {
            Ok(schema) => validate_schema_node(
                config,
                &schema,
                FORMA_CONFIG_PATH,
                &field_path,
                &mut diagnostics,
            ),
            Err(error) => diagnostics.push(
                Diagnostic::error("schema.invalid", "Space schema is invalid.")
                    .with_path(FORMA_CONFIG_PATH)
                    .with_location(DiagnosticLocation::Config { field: field_path })
                    .with_actual(error),
            ),
        }
    }

    diagnostics
}

pub fn parse_space_schema(space: &SpaceDefinition) -> Result<SchemaNode, String> {
    serde_yml::from_value(space.schema.clone()).map_err(|error| error.to_string())
}

pub fn validate_schema_value(
    config: &WorkspaceConfig,
    schema: &SchemaNode,
    value: &Value,
    path: impl Into<String>,
) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    validate_value_node(config, schema, value, path.into(), "$", &mut diagnostics);
    diagnostics
}

pub fn resolve_runtime_values(config: &WorkspaceConfig, workspace_root: &str) -> RuntimeValues {
    let mut values = BTreeMap::new();
    let mut diagnostics = Vec::new();

    for (name, provider) in &config.runtime.values {
        match resolve_runtime_provider(provider, workspace_root, &config.workspace.timezone) {
            Some(Ok(value)) => {
                values.insert(name.clone(), value);
            }
            Some(Err(message)) => diagnostics.push(
                Diagnostic::warning(
                    "runtime.value.unresolved",
                    format!("Runtime value `{name}` could not be resolved."),
                )
                .with_path(FORMA_CONFIG_PATH)
                .with_location(DiagnosticLocation::Config {
                    field: format!("runtime.values.{name}"),
                })
                .with_actual(message),
            ),
            None => {
                if runtime_provider_required(provider) {
                    diagnostics.push(
                        Diagnostic::warning(
                            "runtime.value.unresolved",
                            format!("Required runtime value `{name}` could not be resolved."),
                        )
                        .with_path(FORMA_CONFIG_PATH)
                        .with_location(DiagnosticLocation::Config {
                            field: format!("runtime.values.{name}"),
                        }),
                    );
                }
            }
        }
    }

    RuntimeValues {
        values,
        diagnostics,
    }
}

pub fn resolve_create_inputs(
    create_inputs: &BTreeMap<String, CreateInput>,
    provided: &BTreeMap<String, Value>,
    runtime_values: &RuntimeValues,
) -> ResolvedCreateInputs {
    let mut resolver = TemplateValueResolver {
        create_inputs,
        provided,
        runtime_values,
        values: BTreeMap::new(),
        resolving: BTreeSet::new(),
        diagnostics: Vec::new(),
    };

    for name in create_inputs.keys() {
        resolver.resolve_input(name);
    }

    ResolvedCreateInputs {
        values: resolver.values,
        diagnostics: resolver.diagnostics,
    }
}

#[derive(Debug)]
pub struct TemplateValueResolver<'a> {
    create_inputs: &'a BTreeMap<String, CreateInput>,
    provided: &'a BTreeMap<String, Value>,
    runtime_values: &'a RuntimeValues,
    values: BTreeMap<String, Value>,
    resolving: BTreeSet<String>,
    diagnostics: Vec<Diagnostic>,
}

impl TemplateValueResolver<'_> {
    fn resolve_input(&mut self, name: &str) -> Option<Value> {
        if let Some(value) = self.values.get(name) {
            return Some(value.clone());
        }
        if let Some(value) = self.provided.get(name) {
            let value = self.apply_input_transform(name, value.clone())?;
            self.values.insert(name.to_string(), value.clone());
            return Some(value);
        }
        if !self.resolving.insert(name.to_string()) {
            self.diagnostics.push(Diagnostic::error(
                "placeholder.cycle",
                format!("Input `{name}` has a cyclic default dependency."),
            ));
            return None;
        }

        let Some(input) = self.create_inputs.get(name) else {
            self.resolving.remove(name);
            return None;
        };

        let resolved = input.default.clone().and_then(|default| {
            let value = match default {
                Value::String(default) => self.render_template(&default).map(Value::String)?,
                value => value,
            };
            self.apply_input_transform(name, value)
        });

        self.resolving.remove(name);

        if let Some(value) = resolved.clone() {
            self.values.insert(name.to_string(), value);
        } else if input.required {
            self.diagnostics.push(Diagnostic::error(
                "input.required",
                format!("Required input `{name}` has no provided value or resolvable default."),
            ));
        }

        resolved
    }

    fn apply_input_transform(&mut self, name: &str, value: Value) -> Option<Value> {
        let Some(transform) = self
            .create_inputs
            .get(name)
            .and_then(|input| input.transform.as_deref())
        else {
            return Some(value);
        };

        let Some(value) = value_to_string(&value) else {
            self.diagnostics.push(Diagnostic::error(
                "transform.invalidInput",
                format!("Input `{name}` transform `{transform}` requires a scalar value."),
            ));
            return None;
        };

        match Transform::parse(transform).and_then(|transform| transform.apply(value)) {
            Ok(value) => Some(Value::String(value)),
            Err(message) => {
                self.diagnostics.push(Diagnostic::error(
                    "transform.failed",
                    format!("Input `{name}` transform `{transform}` failed: {message}."),
                ));
                None
            }
        }
    }

    fn render_template(&mut self, template: &str) -> Option<String> {
        let mut output = String::new();
        let mut cursor = 0;

        while let Some(start_relative) = template[cursor..].find("{{") {
            let start = cursor + start_relative;
            output.push_str(&template[cursor..start]);
            let expression_start = start + 2;
            let Some(end_relative) = template[expression_start..].find("}}") else {
                self.diagnostics.push(Diagnostic::error(
                    "placeholder.unclosed",
                    "Placeholder is missing a closing `}}`.",
                ));
                return None;
            };
            let end = expression_start + end_relative;
            let expression = template[expression_start..end].trim();
            let Some(value) = self.resolve_placeholder(expression) else {
                self.diagnostics.push(Diagnostic::error(
                    "placeholder.unresolved",
                    format!("Placeholder `{{{{ {expression} }}}}` could not be resolved."),
                ));
                return None;
            };
            output.push_str(&value);
            cursor = end + 2;
        }

        output.push_str(&template[cursor..]);
        Some(output)
    }

    fn resolve_placeholder(&mut self, expression: &str) -> Option<String> {
        if let Some(name) = expression.strip_prefix("input.") {
            return self
                .resolve_input(name)
                .and_then(|value| value_to_string(&value));
        }
        if let Some(name) = expression.strip_prefix("runtime.values.") {
            return self.runtime_values.get(name).and_then(value_to_string);
        }
        None
    }
}

struct PlaceholderRenderer<'a> {
    context: &'a PlaceholderContext,
    diagnostics: Vec<Diagnostic>,
}

impl PlaceholderRenderer<'_> {
    fn render_template(&mut self, template: &str) -> Option<String> {
        render_template_with(
            template,
            &mut self.diagnostics,
            |expression, diagnostics| {
                let value = if let Some(name) = expression.strip_prefix("input.") {
                    self.context.input.get(name)
                } else if let Some(name) = expression.strip_prefix("runtime.values.") {
                    self.context.runtime_values.get(name)
                } else {
                    None
                };

                value.and_then(value_to_string).or_else(|| {
                    diagnostics.push(Diagnostic::error(
                        "placeholder.unresolved",
                        format!("Placeholder `{{{{ {expression} }}}}` could not be resolved."),
                    ));
                    None
                })
            },
        )
    }
}

fn render_template_with(
    template: &str,
    diagnostics: &mut Vec<Diagnostic>,
    mut resolve: impl FnMut(&str, &mut Vec<Diagnostic>) -> Option<String>,
) -> Option<String> {
    let mut output = String::new();
    let mut cursor = 0;

    while let Some(start_relative) = template[cursor..].find("{{") {
        let start = cursor + start_relative;
        output.push_str(&template[cursor..start]);
        let expression_start = start + 2;
        let Some(end_relative) = template[expression_start..].find("}}") else {
            diagnostics.push(Diagnostic::error(
                "placeholder.unclosed",
                "Placeholder is missing a closing `}}`.",
            ));
            return None;
        };
        let end = expression_start + end_relative;
        let expression = template[expression_start..end].trim();
        let value = resolve(expression, diagnostics)?;
        output.push_str(&value);
        cursor = end + 2;
    }

    output.push_str(&template[cursor..]);
    Some(output)
}

fn validate_schema_node(
    config: &WorkspaceConfig,
    schema: &SchemaNode,
    path: &str,
    field: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    match schema {
        SchemaNode::Object { fields, .. } => {
            for (field_name, field_schema) in fields {
                validate_schema_node(
                    config,
                    field_schema,
                    path,
                    &format!("{field}.fields.{field_name}"),
                    diagnostics,
                );
            }
        }
        SchemaNode::Enum { enum_type, .. } => {
            if !matches!(config.types.get(enum_type), Some(SemanticType::Enum { .. })) {
                diagnostics.push(
                    Diagnostic::error(
                        "schema.enum.invalid",
                        format!("Enum type `{enum_type}` is not defined."),
                    )
                    .with_path(path)
                    .with_location(DiagnosticLocation::Config {
                        field: field.to_string(),
                    }),
                );
            }
        }
        SchemaNode::Ref { target, .. } => {
            if let Some(target) = target {
                if !matches!(config.types.get(target), Some(SemanticType::Space { .. })) {
                    diagnostics.push(
                        Diagnostic::error(
                            "schema.ref.invalid",
                            format!("Reference target `{target}` is not a space semantic type."),
                        )
                        .with_path(path)
                        .with_location(DiagnosticLocation::Config {
                            field: field.to_string(),
                        }),
                    );
                }
            }
        }
        SchemaNode::List { items, .. } => {
            validate_schema_node(config, items, path, field, diagnostics);
        }
        SchemaNode::String { .. }
        | SchemaNode::Number { .. }
        | SchemaNode::Integer { .. }
        | SchemaNode::Boolean { .. }
        | SchemaNode::Date { .. }
        | SchemaNode::DateTime { .. }
        | SchemaNode::Const { .. } => {}
    }
}

fn validate_value_node(
    config: &WorkspaceConfig,
    schema: &SchemaNode,
    value: &Value,
    path: String,
    field: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    if matches!(value, Value::Null) {
        if schema.is_required() {
            diagnostics.push(
                Diagnostic::error(
                    "schema.required",
                    format!("Required field `{field}` is missing."),
                )
                .with_path(path)
                .with_location(frontmatter_field_location(field))
                .with_expected("required field"),
            );
        }
        return;
    }

    match schema {
        SchemaNode::Object { fields, .. } => {
            let Some(mapping) = value.as_mapping() else {
                diagnostics.push(type_error(path, field, "object", value));
                return;
            };
            for (field_name, field_schema) in fields {
                let field_value = mapping
                    .get(Value::String(field_name.clone()))
                    .unwrap_or(&Value::Null);
                validate_value_node(
                    config,
                    field_schema,
                    field_value,
                    path.clone(),
                    field_name,
                    diagnostics,
                );
            }
        }
        SchemaNode::String { .. } => {
            if !value.is_string() {
                diagnostics.push(type_error(path, field, "string", value));
            }
        }
        SchemaNode::Number { .. } => {
            if !matches!(value, Value::Number(_)) {
                diagnostics.push(type_error(path, field, "number", value));
            }
        }
        SchemaNode::Integer { .. } => {
            if !matches!(value, Value::Number(number) if number.as_i64().is_some()) {
                diagnostics.push(type_error(path, field, "integer", value));
            }
        }
        SchemaNode::Boolean { .. } => {
            if !value.is_bool() {
                diagnostics.push(type_error(path, field, "boolean", value));
            }
        }
        SchemaNode::Date { .. } => validate_date_like(value, path, field, "date", diagnostics),
        SchemaNode::DateTime { .. } => {
            validate_date_like(value, path, field, "datetime", diagnostics);
        }
        SchemaNode::Const {
            value: expected, ..
        } => {
            if value != expected {
                diagnostics.push(
                    Diagnostic::error(
                        "schema.const.invalid",
                        format!("Field `{field}` does not match required const value."),
                    )
                    .with_path(path)
                    .with_location(frontmatter_field_location(field))
                    .with_actual(format!("{value:?}"))
                    .with_expected(format!("{expected:?}")),
                );
            }
        }
        SchemaNode::Enum { enum_type, .. } => {
            let Some(actual) = value.as_str() else {
                diagnostics.push(type_error(path, field, "enum string", value));
                return;
            };
            let Some(SemanticType::Enum { values }) = config.types.get(enum_type) else {
                diagnostics.push(
                    Diagnostic::error(
                        "schema.enum.invalid",
                        format!("Enum type `{enum_type}` is not defined."),
                    )
                    .with_path(path)
                    .with_location(frontmatter_field_location(field))
                    .with_expected(format!("defined enum type `{enum_type}`")),
                );
                return;
            };
            if !values.iter().any(|value| value == actual) {
                diagnostics.push(
                    Diagnostic::error(
                        "schema.enum.valueInvalid",
                        format!("Field `{field}` has an invalid enum value."),
                    )
                    .with_path(path)
                    .with_location(frontmatter_field_location(field))
                    .with_actual(actual.to_string())
                    .with_expected(values.join(", ")),
                );
            }
        }
        SchemaNode::Ref { target, .. } => {
            if !value.is_string() {
                diagnostics.push(type_error(path.clone(), field, "reference string", value));
            }
            if let Some(target) = target {
                if !matches!(config.types.get(target), Some(SemanticType::Space { .. })) {
                    diagnostics.push(
                        Diagnostic::error(
                            "schema.ref.invalid",
                            format!("Reference target `{target}` is not a space semantic type."),
                        )
                        .with_path(path)
                        .with_location(frontmatter_field_location(field))
                        .with_expected(format!("space semantic type `{target}`")),
                    );
                }
            }
        }
        SchemaNode::List { items, .. } => {
            let Some(sequence) = value.as_sequence() else {
                diagnostics.push(type_error(path, field, "list", value));
                return;
            };
            for item in sequence {
                validate_value_node(config, items, item, path.clone(), field, diagnostics);
            }
        }
    }
}

fn validate_date_like(
    value: &Value,
    path: String,
    field: &str,
    expected: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(value) = value.as_str() else {
        diagnostics.push(type_error(path, field, expected, value));
        return;
    };
    let valid = match expected {
        "date" => is_iso_date(value),
        "datetime" => is_iso_datetime(value),
        _ => false,
    };
    if !valid {
        diagnostics.push(
            Diagnostic::error(
                "schema.format.invalid",
                format!("Field `{field}` is not a valid {expected}."),
            )
            .with_path(path)
            .with_location(frontmatter_field_location(field))
            .with_actual(value.to_string())
            .with_expected(expected.to_string()),
        );
    }
}

fn type_error(path: String, field: &str, expected: &str, actual: &Value) -> Diagnostic {
    Diagnostic::error(
        "schema.type.invalid",
        format!("Field `{field}` must be {expected}."),
    )
    .with_path(path)
    .with_location(frontmatter_field_location(field))
    .with_actual(format!("{actual:?}"))
    .with_expected(expected.to_string())
}

fn frontmatter_field_location(field: &str) -> DiagnosticLocation {
    DiagnosticLocation::Frontmatter {
        field: field.to_string(),
        index: None,
    }
}

fn resolve_runtime_provider(
    provider: &RuntimeValueProvider,
    workspace_root: &str,
    timezone: &str,
) -> Option<Result<Value, String>> {
    let resolved = match provider {
        RuntimeValueProvider::Const { value, .. } => Some(Ok(value.clone())),
        RuntimeValueProvider::GitConfig { key, .. } => {
            git_config_value(key).map(|value| Ok(Value::String(value)))
        }
        RuntimeValueProvider::CurrentDate => Some(current_date(timezone).map(Value::String)),
        RuntimeValueProvider::CurrentDateTime => {
            Some(current_datetime(timezone).map(Value::String))
        }
        RuntimeValueProvider::WorkspaceRoot => Some(Ok(Value::String(workspace_root.to_string()))),
    }?;

    Some(resolved.and_then(|value| apply_runtime_transform(provider, value)))
}

fn runtime_provider_required(provider: &RuntimeValueProvider) -> bool {
    match provider {
        RuntimeValueProvider::Const { required, .. }
        | RuntimeValueProvider::GitConfig { required, .. } => *required,
        RuntimeValueProvider::CurrentDate
        | RuntimeValueProvider::CurrentDateTime
        | RuntimeValueProvider::WorkspaceRoot => false,
    }
}

fn apply_runtime_transform(provider: &RuntimeValueProvider, value: Value) -> Result<Value, String> {
    let transform = match provider {
        RuntimeValueProvider::Const { transform, .. }
        | RuntimeValueProvider::GitConfig { transform, .. } => transform.as_deref(),
        RuntimeValueProvider::CurrentDate
        | RuntimeValueProvider::CurrentDateTime
        | RuntimeValueProvider::WorkspaceRoot => None,
    };
    let Some(transform) = transform else {
        return Ok(value);
    };
    let value =
        value_to_string(&value).ok_or_else(|| "transform requires a scalar value".to_string())?;
    Transform::parse(transform)
        .and_then(|transform| transform.apply(value))
        .map(Value::String)
}

fn git_config_value(key: &str) -> Option<String> {
    let output = Command::new("git").args(["config", key]).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8(output.stdout).ok()?.trim().to_string();
    if value.is_empty() { None } else { Some(value) }
}

fn current_date(timezone: &str) -> Result<String, String> {
    let timezone = parse_timezone(timezone)?;
    Ok(Utc::now()
        .with_timezone(&timezone)
        .format("%Y-%m-%d")
        .to_string())
}

fn current_datetime(timezone: &str) -> Result<String, String> {
    let timezone = parse_timezone(timezone)?;
    Ok(Utc::now()
        .with_timezone(&timezone)
        .to_rfc3339_opts(SecondsFormat::Secs, true))
}

fn parse_timezone(timezone: &str) -> Result<Tz, String> {
    timezone
        .parse::<Tz>()
        .map_err(|_| format!("invalid IANA timezone `{timezone}`"))
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => Some(value.clone()),
        Value::Number(value) => Some(number_to_string(value)),
        Value::Bool(value) => Some(value.to_string()),
        Value::Null | Value::Sequence(_) | Value::Mapping(_) | Value::Tagged(_) => None,
    }
}

fn number_to_string(value: &Number) -> String {
    if let Some(value) = value.as_i64() {
        value.to_string()
    } else if let Some(value) = value.as_u64() {
        value.to_string()
    } else if let Some(value) = value.as_f64() {
        value.to_string()
    } else {
        format!("{value:?}")
    }
}

fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[8..10].iter().all(u8::is_ascii_digit)
}

fn is_iso_datetime(value: &str) -> bool {
    DateTime::parse_from_rfc3339(value).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{RuntimeConfig, SpaceConventions, TypeInput, WorkspaceSettings};
    use crate::path::FORMA_TEMPLATES_DIR;

    fn config_with_task_schema(schema: &str) -> WorkspaceConfig {
        let schema: Value = serde_yml::from_str(schema).unwrap();
        WorkspaceConfig {
            schema_version: 1,
            workspace: WorkspaceSettings {
                name: "Acme".to_string(),
                logo: None,
                canonical_language: "en".to_string(),
                supported_languages: vec!["en".to_string()],
                timezone: "UTC".to_string(),
            },
            runtime: RuntimeConfig::default(),
            guidelines: Vec::new(),
            dashboard: BTreeMap::new(),
            taxonomies: BTreeMap::new(),
            types: BTreeMap::from([
                (
                    "taskStatus".to_string(),
                    SemanticType::Enum {
                        values: vec![
                            "backlog".to_string(),
                            "doing".to_string(),
                            "done".to_string(),
                        ],
                    },
                ),
                (
                    "member".to_string(),
                    SemanticType::Space {
                        space: "members".to_string(),
                        input: TypeInput {
                            transform: Some("slugify".to_string()),
                        },
                    },
                ),
            ]),
            spaces: BTreeMap::from([(
                "tasks".to_string(),
                SpaceDefinition {
                    title: "Tasks".to_string(),
                    display: crate::config::DisplayOptions::default(),
                    description: None,
                    include: "tasks/**/*.md".to_string(),
                    include_patterns: vec!["tasks/**/*.md".to_string()],
                    template: format!("{FORMA_TEMPLATES_DIR}/task.md"),
                    create: None,
                    conventions: SpaceConventions::default(),
                    guidelines: Vec::new(),
                    schema,
                },
            )]),
        }
    }

    #[test]
    fn parses_and_validates_valid_starter_schema() {
        let config = config_with_task_schema(
            r#"
type: object
fields:
  kind:
    type: const
    value: task
    required: true
  title:
    type: string
    required: true
  status:
    type: enum
    enum: taskStatus
    required: true
  assignees:
    type: list
    items:
      type: ref
      target: member
"#,
        );

        assert!(validate_space_schemas(&config).is_empty());
    }

    #[test]
    fn reports_invalid_enum_and_ref_targets() {
        let config = config_with_task_schema(
            r#"
type: object
fields:
  status:
    type: enum
    enum: missingStatus
  assignee:
    type: ref
    target: missingUser
"#,
        );

        let diagnostics = validate_space_schemas(&config);
        assert_eq!(diagnostics.len(), 2);
        assert!(
            diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "schema.enum.invalid")
        );
        assert!(
            diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "schema.ref.invalid")
        );
    }

    #[test]
    fn validates_required_type_const_enum_and_list_values() {
        let config = config_with_task_schema(
            r#"
type: object
fields:
  kind:
    type: const
    value: task
    required: true
  title:
    type: string
    required: true
  status:
    type: enum
    enum: taskStatus
    required: true
  assignees:
    type: list
    items:
      type: ref
      target: member
"#,
        );
        let schema = parse_space_schema(&config.spaces["tasks"]).unwrap();
        let value = serde_yml::from_str(
            r#"
kind: note
status: later
assignees: tiscs
"#,
        )
        .unwrap();

        let diagnostics = validate_schema_value(&config, &schema, &value, "tasks/foo.md");

        let required = diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code == "schema.required")
            .expect("missing required diagnostic");
        assert_eq!(
            required.location,
            Some(DiagnosticLocation::Frontmatter {
                field: "title".to_string(),
                index: None,
            })
        );
        assert_eq!(required.expected.as_deref(), Some("required field"));
        assert!(
            diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "schema.const.invalid")
        );
        assert!(
            diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "schema.enum.valueInvalid")
        );
        let type_error = diagnostics
            .iter()
            .find(|diagnostic| diagnostic.code == "schema.type.invalid")
            .expect("missing type diagnostic");
        assert_eq!(
            type_error.location,
            Some(DiagnosticLocation::Frontmatter {
                field: "assignees".to_string(),
                index: None,
            })
        );
        assert_eq!(type_error.expected.as_deref(), Some("list"));
    }

    #[test]
    fn reports_unknown_schema_node_type() {
        let config = config_with_task_schema(
            r#"
type: object
fields:
  title:
    type: unknownType
"#,
        );

        let diagnostics = validate_space_schemas(&config);

        assert_eq!(diagnostics.len(), 1);
        assert_eq!(diagnostics[0].code, "schema.invalid");
    }

    #[test]
    fn validates_scalar_date_and_datetime_values() {
        let config = config_with_task_schema(
            r#"
type: object
fields:
  estimate:
    type: number
  count:
    type: integer
  active:
    type: boolean
  dueDate:
    type: date
  createdAt:
    type: datetime
  scheduledAt:
    type: datetime
"#,
        );
        let schema = parse_space_schema(&config.spaces["tasks"]).unwrap();
        let valid = serde_yml::from_str(
            r#"
estimate: 1.5
count: 3
active: true
dueDate: "2026-05-19"
createdAt: "2026-05-19T10:30:00+08:00"
scheduledAt: "2026-05-19T02:30:00Z"
"#,
        )
        .unwrap();
        let invalid = serde_yml::from_str(
            r#"
estimate: high
count: 1.5
active: yes
dueDate: "2026/05/19"
createdAt: "2026-05-19 10:30"
scheduledAt: "2026-05-19T10:30:00"
"#,
        )
        .unwrap();

        assert!(validate_schema_value(&config, &schema, &valid, "tasks/valid.md").is_empty());

        let diagnostics = validate_schema_value(&config, &schema, &invalid, "tasks/invalid.md");

        assert_eq!(diagnostics.len(), 6);
        assert_eq!(
            diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "schema.type.invalid")
                .count(),
            3
        );
        assert_eq!(
            diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "schema.format.invalid")
                .count(),
            3
        );
    }

    #[test]
    fn resolves_runtime_values_from_const_and_workspace_root() {
        let mut config = config_with_task_schema("type: object\nfields: {}\n");
        config.runtime.values.insert(
            "currentUserId".to_string(),
            RuntimeValueProvider::Const {
                value: Value::String("Tiscs User".to_string()),
                required: true,
                transform: Some("slugify".to_string()),
            },
        );
        config.runtime.values.insert(
            "workspaceRoot".to_string(),
            RuntimeValueProvider::WorkspaceRoot,
        );

        let runtime = resolve_runtime_values(&config, ".");

        assert!(runtime.diagnostics.is_empty());
        assert_eq!(
            runtime.get_string("currentUserId").as_deref(),
            Some("tiscs-user")
        );
        assert_eq!(runtime.get_string("workspaceRoot").as_deref(), Some("."));
    }

    #[test]
    fn warns_for_unresolved_required_runtime_values() {
        let mut config = config_with_task_schema("type: object\nfields: {}\n");
        config.runtime.values.insert(
            "currentUserId".to_string(),
            RuntimeValueProvider::GitConfig {
                key: "forma.missing-key-for-test".to_string(),
                required: true,
                transform: Some("slugify".to_string()),
            },
        );

        let runtime = resolve_runtime_values(&config, ".");

        assert_eq!(runtime.diagnostics.len(), 1);
        assert_eq!(runtime.diagnostics[0].code, "runtime.value.unresolved");
    }

    #[test]
    fn resolves_current_date_and_datetime_with_workspace_timezone() {
        let mut config = config_with_task_schema("type: object\nfields: {}\n");
        config.workspace.timezone = "Asia/Shanghai".to_string();
        config
            .runtime
            .values
            .insert("currentDate".to_string(), RuntimeValueProvider::CurrentDate);
        config.runtime.values.insert(
            "currentDateTime".to_string(),
            RuntimeValueProvider::CurrentDateTime,
        );

        let runtime = resolve_runtime_values(&config, ".");
        let date = runtime.get_string("currentDate").unwrap();
        let datetime = runtime.get_string("currentDateTime").unwrap();

        assert!(runtime.diagnostics.is_empty());
        assert_eq!(date.len(), 10);
        assert!(datetime.ends_with("+08:00"));
    }

    #[test]
    fn reports_invalid_workspace_timezone_for_time_runtime_values() {
        let mut config = config_with_task_schema("type: object\nfields: {}\n");
        config.workspace.timezone = "Not/AZone".to_string();
        config
            .runtime
            .values
            .insert("currentDate".to_string(), RuntimeValueProvider::CurrentDate);

        let runtime = resolve_runtime_values(&config, ".");

        assert_eq!(runtime.diagnostics.len(), 1);
        assert_eq!(runtime.diagnostics[0].code, "runtime.value.unresolved");
    }

    #[test]
    fn resolves_create_input_defaults_dependency_graph_and_transform() {
        let inputs = BTreeMap::from([
            (
                "title".to_string(),
                CreateInput {
                    required: true,
                    ..CreateInput::default()
                },
            ),
            (
                "slug".to_string(),
                CreateInput {
                    default: Some(Value::String("{{ input.title }}".to_string())),
                    transform: Some("slugify".to_string()),
                    ..CreateInput::default()
                },
            ),
            (
                "filename".to_string(),
                CreateInput {
                    default: Some(Value::String("{{ input.slug }}.md".to_string())),
                    ..CreateInput::default()
                },
            ),
            (
                "createdAt".to_string(),
                CreateInput {
                    default: Some(Value::String(
                        "{{ runtime.values.currentDateTime }}".to_string(),
                    )),
                    ..CreateInput::default()
                },
            ),
        ]);
        let provided = BTreeMap::from([(
            "title".to_string(),
            Value::String("User Registration".to_string()),
        )]);
        let runtime = RuntimeValues {
            values: BTreeMap::from([(
                "currentDateTime".to_string(),
                Value::String("2026-05-19T00:00:00Z".to_string()),
            )]),
            diagnostics: Vec::new(),
        };

        let resolved = resolve_create_inputs(&inputs, &provided, &runtime);

        assert!(resolved.diagnostics.is_empty());
        assert_eq!(
            resolved.values["slug"],
            Value::String("user-registration".to_string())
        );
        assert_eq!(
            resolved.values["filename"],
            Value::String("user-registration.md".to_string())
        );
        assert_eq!(
            resolved.values["createdAt"],
            Value::String("2026-05-19T00:00:00Z".to_string())
        );
    }

    #[test]
    fn detects_placeholder_cycles() {
        let inputs = BTreeMap::from([
            (
                "a".to_string(),
                CreateInput {
                    default: Some(Value::String("{{ input.b }}".to_string())),
                    required: true,
                    ..CreateInput::default()
                },
            ),
            (
                "b".to_string(),
                CreateInput {
                    default: Some(Value::String("{{ input.a }}".to_string())),
                    required: true,
                    ..CreateInput::default()
                },
            ),
        ]);
        let runtime = RuntimeValues {
            values: BTreeMap::new(),
            diagnostics: Vec::new(),
        };

        let resolved = resolve_create_inputs(&inputs, &BTreeMap::new(), &runtime);

        assert!(
            resolved
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "placeholder.cycle")
        );
    }

    #[test]
    fn reports_missing_required_create_input() {
        let inputs = BTreeMap::from([(
            "title".to_string(),
            CreateInput {
                required: true,
                ..CreateInput::default()
            },
        )]);
        let runtime = RuntimeValues {
            values: BTreeMap::new(),
            diagnostics: Vec::new(),
        };

        let resolved = resolve_create_inputs(&inputs, &BTreeMap::new(), &runtime);

        assert!(resolved.values.is_empty());
        assert_eq!(resolved.diagnostics.len(), 1);
        assert_eq!(resolved.diagnostics[0].code, "input.required");
    }

    #[test]
    fn reports_unknown_transform() {
        let inputs = BTreeMap::from([(
            "slug".to_string(),
            CreateInput {
                default: Some(Value::String("User Registration".to_string())),
                transform: Some("unknownTransform".to_string()),
                ..CreateInput::default()
            },
        )]);
        let runtime = RuntimeValues {
            values: BTreeMap::new(),
            diagnostics: Vec::new(),
        };

        let resolved = resolve_create_inputs(&inputs, &BTreeMap::new(), &runtime);

        assert!(resolved.values.is_empty());
        assert_eq!(resolved.diagnostics.len(), 1);
        assert_eq!(resolved.diagnostics[0].code, "transform.failed");
    }

    #[test]
    fn reports_unclosed_and_unresolved_placeholders() {
        let unclosed_inputs = BTreeMap::from([(
            "title".to_string(),
            CreateInput {
                default: Some(Value::String("{{ input.slug".to_string())),
                ..CreateInput::default()
            },
        )]);
        let unresolved_inputs = BTreeMap::from([
            (
                "title".to_string(),
                CreateInput {
                    default: Some(Value::String("{{ config.title }}".to_string())),
                    ..CreateInput::default()
                },
            ),
            (
                "summary".to_string(),
                CreateInput {
                    default: Some(Value::String("{{ runtime.values.missing }}".to_string())),
                    ..CreateInput::default()
                },
            ),
        ]);
        let runtime = RuntimeValues {
            values: BTreeMap::new(),
            diagnostics: Vec::new(),
        };

        let unclosed = resolve_create_inputs(&unclosed_inputs, &BTreeMap::new(), &runtime);
        let unresolved = resolve_create_inputs(&unresolved_inputs, &BTreeMap::new(), &runtime);

        assert!(
            unclosed
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "placeholder.unclosed")
        );
        assert_eq!(
            unresolved
                .diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "placeholder.unresolved")
                .count(),
            2
        );
    }

    #[test]
    fn does_not_render_null_input_as_string_null() {
        let inputs = BTreeMap::from([(
            "summaryLine".to_string(),
            CreateInput {
                default: Some(Value::String("Summary: {{ input.summary }}".to_string())),
                ..CreateInput::default()
            },
        )]);
        let provided = BTreeMap::from([("summary".to_string(), Value::Null)]);
        let runtime = RuntimeValues {
            values: BTreeMap::new(),
            diagnostics: Vec::new(),
        };

        let resolved = resolve_create_inputs(&inputs, &provided, &runtime);

        assert!(!resolved.values.values().any(|value| {
            value
                .as_str()
                .is_some_and(|value| value.contains("null") || value.contains("Null"))
        }));
        assert!(
            resolved
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "placeholder.unresolved")
        );
    }

    #[test]
    fn does_not_render_null_runtime_value_as_string_null() {
        let inputs = BTreeMap::from([(
            "ownerLine".to_string(),
            CreateInput {
                default: Some(Value::String(
                    "Owner: {{ runtime.values.owner }}".to_string(),
                )),
                ..CreateInput::default()
            },
        )]);
        let runtime = RuntimeValues {
            values: BTreeMap::from([("owner".to_string(), Value::Null)]),
            diagnostics: Vec::new(),
        };

        let resolved = resolve_create_inputs(&inputs, &BTreeMap::new(), &runtime);

        assert!(!resolved.values.values().any(|value| {
            value
                .as_str()
                .is_some_and(|value| value.contains("null") || value.contains("Null"))
        }));
        assert!(
            resolved
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "placeholder.unresolved")
        );
    }
}
