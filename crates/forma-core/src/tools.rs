//! Built-in, read-only governance tools.
//!
//! The tool registry intentionally lives in Core so the CLI, RPC adapter, and
//! future clients expose the same operations and diagnostics.  Tools operate on
//! explicit workspace-relative paths; they never discover or mutate arbitrary
//! files implicitly.

use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use jsonschema::{Draft, Retrieve, Uri};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_yml::Value as YamlValue;
use url::Url;

use crate::boundary::WorkspaceBoundary;
use crate::diagnostics::{Diagnostic, DiagnosticLocation, DiagnosticSummary, OperationStatus};
use crate::operations::OperationError;
use crate::path::WorkspacePath;

const SCHEMA_VERSION: u16 = 1;
const SCHEMA_VALIDATE_OPERATION: &str = "tools.schema.validate";

/// A structured-data input format supported by `schema.validate`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StructuredFormat {
    Auto,
    Json,
    Yaml,
    Jsonl,
}

impl StructuredFormat {
    fn resolve(self, path: &str) -> Result<Self, String> {
        if self != Self::Auto {
            return Ok(self);
        }

        let lower = path.to_ascii_lowercase();
        if lower.ends_with(".json") {
            Ok(Self::Json)
        } else if lower.ends_with(".yaml") || lower.ends_with(".yml") {
            Ok(Self::Yaml)
        } else if lower.ends_with(".jsonl") || lower.ends_with(".ndjson") {
            Ok(Self::Jsonl)
        } else {
            Err(format!(
                "Could not infer a structured-data format from `{path}`; pass `json`, `yaml`, or `jsonl`."
            ))
        }
    }

    fn for_schema_path(path: &str) -> Self {
        let lower = path.to_ascii_lowercase();
        if lower.ends_with(".yaml") || lower.ends_with(".yml") {
            Self::Yaml
        } else {
            // JSON is the conservative default for schema files such as
            // `entry.schema` whose extension does not identify a format.
            Self::Json
        }
    }
}

impl FromStr for StructuredFormat {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "auto" => Ok(Self::Auto),
            "json" => Ok(Self::Json),
            "yaml" | "yml" => Ok(Self::Yaml),
            "jsonl" | "ndjson" => Ok(Self::Jsonl),
            _ => Err(format!(
                "Unsupported structured-data format `{value}`; expected `auto`, `json`, `yaml`, or `jsonl`."
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDescriptor {
    pub id: String,
    pub title: String,
    pub description: String,
    pub read_only: bool,
    pub workspace_required: bool,
    pub input_formats: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsListResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub tools: Vec<ToolDescriptor>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolsDescribeResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool: Option<ToolDescriptor>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaValidateResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub path: String,
    pub schema: String,
    pub format: StructuredFormat,
    pub documents: usize,
    pub valid_documents: usize,
    pub valid: bool,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

/// Return the compiled-in governance-tool registry.
pub fn list_tools() -> ToolsListResult {
    let diagnostics = Vec::new();
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    ToolsListResult {
        schema_version: SCHEMA_VERSION,
        operation: "tools.list".to_string(),
        status: summary.status(),
        tools: vec![schema_validate_descriptor()],
        summary,
        diagnostics,
    }
}

/// Describe one compiled-in governance tool.
pub fn describe_tool(id: &str) -> ToolsDescribeResult {
    let canonical_id = id.strip_prefix("tools.").unwrap_or(id);
    let tool = (canonical_id == "schema.validate").then(schema_validate_descriptor);
    let diagnostics = if tool.is_some() {
        Vec::new()
    } else {
        vec![
            Diagnostic::error("tools.notFound", "Built-in tool was not found.")
                .with_actual(id.to_string()),
        ]
    };
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    ToolsDescribeResult {
        schema_version: SCHEMA_VERSION,
        operation: "tools.describe".to_string(),
        status: summary.status(),
        tool,
        summary,
        diagnostics,
    }
}

/// Validate one explicit JSON, YAML, or JSONL file against one JSON Schema.
///
/// The operation is deliberately read-only.  Data and schema paths are
/// workspace-relative and are resolved through `WorkspaceBoundary`; external
/// schema references are limited to files inside that same boundary.
pub fn validate_structured_data(
    root: &Path,
    data_path: &str,
    schema_path: &str,
    requested_format: Option<&str>,
) -> Result<SchemaValidateResult, OperationError> {
    let data_path = WorkspacePath::parse_cli(data_path)?;
    let schema_path = WorkspacePath::parse_cli(schema_path)?;
    let boundary = WorkspaceBoundary::new(root)?;
    let data_absolute = boundary.resolve_existing_file(&data_path)?;
    let schema_absolute = boundary.resolve_existing_file(&schema_path)?;
    let data_bytes = fs::read(&data_absolute).map_err(|source| OperationError::Io {
        path: data_path.to_string(),
        source,
    })?;
    let schema_bytes = fs::read(&schema_absolute).map_err(|source| OperationError::Io {
        path: schema_path.to_string(),
        source,
    })?;

    let requested_format = requested_format.unwrap_or("auto");
    let format = requested_format
        .parse::<StructuredFormat>()
        .map_err(OperationError::InvalidInput)?
        .resolve(data_path.as_str())
        .map_err(OperationError::InvalidInput)?;

    let mut diagnostics = Vec::new();
    let schema = match parse_schema_document(&schema_bytes, &schema_path) {
        Ok(schema) => schema,
        Err(diagnostic) => {
            diagnostics.push(diagnostic);
            return Ok(schema_validate_result(
                data_path.as_str(),
                schema_path.as_str(),
                format,
                0,
                0,
                diagnostics,
            ));
        }
    };

    if let Some(diagnostic) = schema_policy_diagnostic(&schema, schema_path.as_str()) {
        diagnostics.push(diagnostic);
        return Ok(schema_validate_result(
            data_path.as_str(),
            schema_path.as_str(),
            format,
            0,
            0,
            diagnostics,
        ));
    }

    let base_uri = Url::from_file_path(&schema_absolute)
        .map_err(|_| OperationError::InvalidInput("schema path could not form a file URI".into()))?
        .to_string();
    let validator = match jsonschema::options()
        .with_draft(Draft::Draft202012)
        .with_base_uri(base_uri)
        .with_retriever(WorkspaceSchemaRetriever {
            root: boundary.root().to_path_buf(),
        })
        .build(&schema)
    {
        Ok(validator) => validator,
        Err(error) => {
            diagnostics.push(
                Diagnostic::error(
                    "tools.schema.invalid",
                    "The JSON Schema could not be compiled for Draft 2020-12.",
                )
                .with_path(schema_path.to_string())
                .with_actual(error.masked().to_string()),
            );
            return Ok(schema_validate_result(
                data_path.as_str(),
                schema_path.as_str(),
                format,
                0,
                0,
                diagnostics,
            ));
        }
    };

    let documents = parse_data_documents(&data_bytes, format, data_path.as_str(), &mut diagnostics);
    let document_count = documents.total_count;
    let mut valid_documents = 0;
    for document in documents.documents {
        let errors = validator.iter_errors(&document.value).collect::<Vec<_>>();
        if errors.is_empty() {
            valid_documents += 1;
            continue;
        }
        for error in errors {
            let mut diagnostic =
                Diagnostic::error("tools.schema.validationFailed", error.masked().to_string())
                    .with_path(data_path.to_string())
                    .with_instance_path(error.instance_path().to_string())
                    .with_schema_path(error.schema_path().to_string())
                    .with_keyword(error.kind().keyword().to_string());
            if let Some(line) = document.line {
                diagnostic = diagnostic.with_location(DiagnosticLocation::Body {
                    line: Some(line),
                    column: document.column,
                });
            }
            diagnostics.push(diagnostic);
        }
    }

    Ok(schema_validate_result(
        data_path.as_str(),
        schema_path.as_str(),
        format,
        document_count,
        valid_documents,
        diagnostics,
    ))
}

fn schema_validate_descriptor() -> ToolDescriptor {
    ToolDescriptor {
        id: "schema.validate".to_string(),
        title: "Validate structured data".to_string(),
        description: "Validate an explicit JSON, YAML, or JSONL file against a JSON Schema without modifying the workspace.".to_string(),
        read_only: true,
        workspace_required: true,
        input_formats: vec!["json".to_string(), "yaml".to_string(), "jsonl".to_string()],
    }
}

fn schema_validate_result(
    path: &str,
    schema: &str,
    format: StructuredFormat,
    documents: usize,
    valid_documents: usize,
    diagnostics: Vec<Diagnostic>,
) -> SchemaValidateResult {
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let status = summary.status();
    SchemaValidateResult {
        schema_version: SCHEMA_VERSION,
        operation: SCHEMA_VALIDATE_OPERATION.to_string(),
        status,
        path: path.to_string(),
        schema: schema.to_string(),
        format,
        documents,
        valid_documents,
        valid: status == OperationStatus::Passed,
        summary,
        diagnostics,
    }
}

#[derive(Debug)]
struct InputDocument {
    value: Value,
    line: Option<usize>,
    column: Option<usize>,
}

#[derive(Debug, Default)]
struct ParsedDocuments {
    total_count: usize,
    documents: Vec<InputDocument>,
}

fn parse_data_documents(
    bytes: &[u8],
    format: StructuredFormat,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> ParsedDocuments {
    match format {
        StructuredFormat::Json => match serde_json::from_slice::<Value>(bytes) {
            Ok(value) => ParsedDocuments {
                total_count: 1,
                documents: vec![InputDocument {
                    value,
                    line: None,
                    column: None,
                }],
            },
            Err(error) => {
                diagnostics.push(
                    Diagnostic::error(
                        "tools.data.parseFailed",
                        "The JSON document could not be parsed.",
                    )
                    .with_path(path.to_string())
                    .with_actual(error.to_string())
                    .with_location(DiagnosticLocation::Body {
                        line: nonzero(error.line()),
                        column: nonzero(error.column()),
                    }),
                );
                ParsedDocuments::default()
            }
        },
        StructuredFormat::Yaml => {
            let values = parse_yaml_documents(bytes);
            match values {
                Ok(values) if values.len() == 1 => {
                    match yaml_to_json(values.into_iter().next().expect("one YAML document")) {
                        Ok(value) => ParsedDocuments {
                            total_count: 1,
                            documents: vec![InputDocument {
                                value,
                                line: None,
                                column: None,
                            }],
                        },
                        Err(error) => {
                            diagnostics.push(
                            Diagnostic::error(
                                "tools.data.notJsonCompatible",
                                "The YAML document contains a value that cannot be represented as JSON.",
                            )
                            .with_path(path.to_string())
                            .with_actual(error),
                        );
                            ParsedDocuments::default()
                        }
                    }
                }
                Ok(values) if values.is_empty() => {
                    diagnostics.push(
                        Diagnostic::error("tools.data.parseFailed", "The YAML document is empty.")
                            .with_path(path.to_string()),
                    );
                    ParsedDocuments::default()
                }
                Ok(values) => {
                    diagnostics.push(
                        Diagnostic::error(
                            "tools.data.multipleDocuments",
                            "YAML input must contain exactly one document; use JSONL for multiple records.",
                        )
                        .with_path(path.to_string())
                        .with_actual(values.len().to_string()),
                    );
                    ParsedDocuments::default()
                }
                Err(error) => {
                    diagnostics.push(
                        Diagnostic::error(
                            "tools.data.parseFailed",
                            "The YAML document could not be parsed.",
                        )
                        .with_path(path.to_string())
                        .with_actual(error),
                    );
                    ParsedDocuments::default()
                }
            }
        }
        StructuredFormat::Jsonl => {
            let text = String::from_utf8_lossy(bytes);
            let mut parsed = ParsedDocuments::default();
            for (index, line) in text.lines().enumerate() {
                let line_number = index + 1;
                if line.trim().is_empty() {
                    continue;
                }
                parsed.total_count += 1;
                match serde_json::from_str::<Value>(line) {
                    Ok(value) => parsed.documents.push(InputDocument {
                        value,
                        line: Some(line_number),
                        column: None,
                    }),
                    Err(error) => diagnostics.push(
                        Diagnostic::error(
                            "tools.data.parseFailed",
                            "A JSONL record could not be parsed.",
                        )
                        .with_path(path.to_string())
                        .with_actual(error.to_string())
                        .with_location(DiagnosticLocation::Body {
                            line: Some(line_number),
                            column: nonzero(error.column()),
                        }),
                    ),
                }
            }
            parsed
        }
        StructuredFormat::Auto => unreachable!("format is resolved before parsing"),
    }
}

fn parse_schema_document(bytes: &[u8], path: &WorkspacePath) -> Result<Value, Diagnostic> {
    match StructuredFormat::for_schema_path(path.as_str()) {
        StructuredFormat::Json => serde_json::from_slice::<Value>(bytes).map_err(|error| {
            Diagnostic::error(
                "tools.schema.parseFailed",
                "The JSON Schema document could not be parsed.",
            )
            .with_path(path.to_string())
            .with_actual(error.to_string())
            .with_location(DiagnosticLocation::Body {
                line: nonzero(error.line()),
                column: nonzero(error.column()),
            })
        }),
        StructuredFormat::Yaml => {
            let values = parse_yaml_documents(bytes).map_err(|error| {
                Diagnostic::error(
                    "tools.schema.parseFailed",
                    "The YAML Schema document could not be parsed.",
                )
                .with_path(path.to_string())
                .with_actual(error)
            })?;
            if values.len() != 1 {
                return Err(Diagnostic::error(
                    "tools.schema.multipleDocuments",
                    "A JSON Schema document must contain exactly one YAML document.",
                )
                .with_path(path.to_string())
                .with_actual(values.len().to_string()));
            }
            yaml_to_json(values.into_iter().next().expect("one YAML schema document")).map_err(
                |error| {
                    Diagnostic::error(
                        "tools.schema.notJsonCompatible",
                        "The YAML Schema contains a value that cannot be represented as JSON.",
                    )
                    .with_path(path.to_string())
                    .with_actual(error)
                },
            )
        }
        StructuredFormat::Jsonl | StructuredFormat::Auto => {
            unreachable!("schema format is concrete")
        }
    }
}

fn parse_yaml_documents(bytes: &[u8]) -> Result<Vec<YamlValue>, String> {
    let mut values = Vec::new();
    for document in serde_yml::Deserializer::from_slice(bytes) {
        values.push(YamlValue::deserialize(document).map_err(|error| error.to_string())?);
    }
    Ok(values)
}

fn yaml_to_json(value: YamlValue) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}

fn schema_policy_diagnostic(schema: &Value, path: &str) -> Option<Diagnostic> {
    let mut violation = None;
    inspect_schema_policy(schema, &mut violation);
    violation.map(|message| {
        Diagnostic::error(
            "tools.schema.externalRefDenied",
            "JSON Schema references must stay within the workspace; network and non-file references are disabled.",
        )
        .with_path(path.to_string())
        .with_actual(message)
    })
}

fn inspect_schema_policy(value: &Value, violation: &mut Option<String>) {
    if violation.is_some() {
        return;
    }
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                if key == "$schema" {
                    let Some(dialect) = child.as_str() else {
                        *violation = Some("`$schema` must be a string".to_string());
                        return;
                    };
                    let dialect = dialect.trim_end_matches('#');
                    if dialect != "https://json-schema.org/draft/2020-12/schema" {
                        *violation = Some(format!(
                            "`$schema` declares unsupported dialect `{dialect}`"
                        ));
                        return;
                    }
                }
                if matches!(
                    key.as_str(),
                    "$ref" | "$dynamicRef" | "$recursiveRef" | "$id"
                ) {
                    let Some(reference) = child.as_str() else {
                        *violation = Some(format!("`{key}` must be a string"));
                        return;
                    };
                    if let Ok(url) = Url::parse(reference)
                        && !matches!(url.scheme(), "file")
                    {
                        *violation =
                            Some(format!("`{key}` uses the `{}` URI scheme", url.scheme()));
                        return;
                    }
                }
                inspect_schema_policy(child, violation);
                if violation.is_some() {
                    return;
                }
            }
        }
        Value::Array(values) => {
            for child in values {
                inspect_schema_policy(child, violation);
                if violation.is_some() {
                    return;
                }
            }
        }
        _ => {}
    }
}

fn nonzero(value: usize) -> Option<usize> {
    (value > 0).then_some(value)
}

#[derive(Debug, Clone)]
struct WorkspaceSchemaRetriever {
    root: PathBuf,
}

impl Retrieve for WorkspaceSchemaRetriever {
    fn retrieve(&self, uri: &Uri<String>) -> Result<Value, Box<dyn Error + Send + Sync>> {
        let parsed = Url::parse(uri.as_str())?;
        if parsed.scheme() != "file" {
            return Err(format!(
                "schema reference URI scheme `{}` is disabled",
                parsed.scheme()
            )
            .into());
        }
        let path = parsed
            .to_file_path()
            .map_err(|_| "schema reference is not a valid file URI")?;
        let relative = path
            .strip_prefix(&self.root)
            .map_err(|_| "schema reference escaped the workspace")?;
        let relative = relative
            .to_str()
            .ok_or("schema reference path is not valid UTF-8")?;
        let workspace_path = WorkspacePath::parse_cli(relative)
            .map_err(|error| format!("schema reference path is invalid: {error}"))?;
        let boundary = WorkspaceBoundary::new(&self.root)?;
        let resolved = boundary.resolve_existing_file(&workspace_path)?;
        let bytes = fs::read(&resolved)?;
        if resolved
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| {
                extension.eq_ignore_ascii_case("yaml") || extension.eq_ignore_ascii_case("yml")
            })
        {
            let values = parse_yaml_documents(&bytes)?;
            if values.len() != 1 {
                return Err("referenced YAML schema must contain exactly one document".into());
            }
            return yaml_to_json(values.into_iter().next().expect("one referenced schema"))
                .map_err(Into::into);
        }
        serde_json::from_slice(&bytes).map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{StructuredFormat, describe_tool, list_tools, validate_structured_data};

    fn fixture_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock is available")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("forma-tools-{name}-{unique}"));
        fs::create_dir_all(&root).expect("fixture root can be created");
        root
    }

    fn write_fixture(root: &Path, data: &str, schema: &str, data_name: &str) {
        fs::write(root.join(data_name), data).expect("data can be written");
        fs::write(root.join("schema.json"), schema).expect("schema can be written");
    }

    #[test]
    fn registry_is_compiled_in_and_read_only() {
        let result = list_tools();
        assert_eq!(result.tools.len(), 1);
        assert_eq!(result.tools[0].id, "schema.validate");
        assert!(result.tools[0].read_only);
        assert_eq!(
            describe_tool("tools.schema.validate").tool,
            Some(result.tools[0].clone())
        );
    }

    #[test]
    fn validates_json_and_reports_json_pointer_metadata() {
        let root = fixture_root("json");
        write_fixture(
            &root,
            r#"{"name": 42}"#,
            r#"{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}"#,
            "entry.json",
        );

        let result = validate_structured_data(&root, "entry.json", "schema.json", None)
            .expect("operation resolves paths");
        assert_eq!(result.status, super::OperationStatus::Failed);
        assert_eq!(result.format, StructuredFormat::Json);
        assert_eq!(result.documents, 1);
        assert_eq!(result.diagnostics[0].code, "tools.schema.validationFailed");
        assert_eq!(
            result.diagnostics[0].instance_path.as_deref(),
            Some("/name")
        );
        assert_eq!(
            result.diagnostics[0].schema_path.as_deref(),
            Some("/properties/name/type")
        );
        assert_eq!(result.diagnostics[0].keyword.as_deref(), Some("type"));
        fs::remove_dir_all(root).expect("fixture root can be removed");
    }

    #[test]
    fn validates_yaml_and_jsonl_with_explicit_line_locations() {
        let root = fixture_root("yaml-jsonl");
        write_fixture(
            &root,
            "name: forma\n",
            "type: object\nrequired: [name]\nproperties:\n  name:\n    type: string\n",
            "entry.yaml",
        );
        fs::write(
            root.join("schema.yaml"),
            "type: object\nrequired: [name]\nproperties:\n  name:\n    type: string\n",
        )
        .expect("YAML schema can be written");
        let yaml = validate_structured_data(&root, "entry.yaml", "schema.yaml", Some("yaml"))
            .expect("YAML operation resolves paths");
        assert_eq!(yaml.status, super::OperationStatus::Passed);
        assert_eq!(yaml.format, StructuredFormat::Yaml);

        fs::write(
            root.join("records.jsonl"),
            "{\"name\":\"ok\"}\n{\"name\":4}\n",
        )
        .expect("JSONL can be written");
        let jsonl = validate_structured_data(&root, "records.jsonl", "schema.yaml", None)
            .expect("JSONL operation resolves paths");
        assert_eq!(jsonl.documents, 2);
        assert_eq!(
            jsonl.diagnostics[0].location,
            Some(super::DiagnosticLocation::Body {
                line: Some(2),
                column: None,
            })
        );
        fs::remove_dir_all(root).expect("fixture root can be removed");
    }

    #[test]
    fn rejects_network_schema_references_before_compilation() {
        let root = fixture_root("network-ref");
        write_fixture(
            &root,
            "{}",
            r#"{"$ref":"https://example.com/schema.json"}"#,
            "entry.json",
        );
        let result = validate_structured_data(&root, "entry.json", "schema.json", None)
            .expect("operation resolves paths");
        assert_eq!(result.diagnostics[0].code, "tools.schema.externalRefDenied");
        fs::remove_dir_all(root).expect("fixture root can be removed");
    }

    #[test]
    fn resolves_workspace_local_schema_references() {
        let root = fixture_root("local-ref");
        fs::write(root.join("entry.json"), r#"{"name":"forma"}"#).expect("data can be written");
        fs::write(
            root.join("schema.json"),
            r#"{"$ref":"defs.json#/$defs/record"}"#,
        )
        .expect("root schema can be written");
        fs::write(
            root.join("defs.json"),
            r#"{"$defs":{"record":{"type":"object","required":["name"],"properties":{"name":{"type":"string"}}}}}"#,
        )
        .expect("referenced schema can be written");

        let result = validate_structured_data(&root, "entry.json", "schema.json", None)
            .expect("operation resolves paths");
        assert_eq!(result.status, super::OperationStatus::Passed);
        assert!(result.diagnostics.is_empty());
        fs::remove_dir_all(root).expect("fixture root can be removed");
    }
}
