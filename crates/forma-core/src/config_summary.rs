use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{
    CreateDefinition, CreateInput, DisplayOptions, RuntimeValueProvider, SemanticType,
};
use crate::diagnostics::{Diagnostic, DiagnosticSummary, OperationStatus};
use crate::index::{IndexView, IndexViewSource, discover_loaded_workspace};
use crate::load_workspace;
use crate::model::{ConfigProjection, ResolvedWorkspaceModel};
use crate::operations::{ConfigSource, OperationError, WorkspaceSummary};
use crate::schema::{SchemaNode, parse_space_schema};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSummaryResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub overview: ConfigSummaryOverview,
    pub content_groups: Vec<ContentGroupSummary>,
    pub taxonomies: Vec<TaxonomySummary>,
    pub semantic_types: Vec<SemanticTypeSummary>,
    pub views: Vec<ConfigViewSummary>,
    pub guidelines: Vec<String>,
    pub runtime_values: Vec<RuntimeValueSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<ConfigSource>>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSummaryOverview {
    pub content_groups: usize,
    pub taxonomies: usize,
    pub taxonomy_terms: usize,
    pub semantic_types: usize,
    pub views: usize,
    pub guidelines: usize,
    pub runtime_values: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentGroupSummary {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub include_patterns: Vec<String>,
    pub schema_fields: Vec<SchemaFieldSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create: Option<CreateSummary>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub guidelines: Vec<String>,
    pub entry_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSummary {
    pub directory: String,
    pub filename: String,
    pub template: String,
    pub inputs: Vec<CreateInputSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInputSummary {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub value_type: Option<String>,
    pub required: bool,
    pub has_default: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaFieldSummary {
    pub path: String,
    #[serde(rename = "type")]
    pub type_name: String,
    pub required: bool,
    pub readonly: bool,
    pub hidden: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxonomySummary {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projection: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
    pub terms: Vec<TaxonomyTermSummary>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxonomyTermSummary {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SemanticTypeSummary {
    pub id: String,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub values: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_content_group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeValueSummary {
    pub id: String,
    pub provider: String,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigViewSummary {
    pub id: String,
    pub surface: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<IndexViewSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "DisplayOptions::is_empty")]
    pub display: DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_path: Option<String>,
}

pub fn summarize_config(
    root: impl AsRef<Path>,
    group: Option<&str>,
    include_sources: bool,
) -> Result<ConfigSummaryResult, OperationError> {
    let workspace = load_workspace(root.as_ref())?;
    let discovery = discover_loaded_workspace(&workspace);
    let model = &workspace.model;

    if let Some(group) = group
        && model.content_group(group).is_none()
    {
        return Err(OperationError::ContentGroupNotFound(group.to_string()));
    }

    let entry_counts = discovery
        .index
        .spaces
        .iter()
        .map(|space| (space.id.as_str(), space.entry_count))
        .collect::<BTreeMap<_, _>>();
    let content_groups = model
        .content_groups()
        .iter()
        .filter(|(id, _)| group.is_none_or(|group| id.as_str() == group))
        .map(|(id, definition)| {
            let source_path = content_group_source_path(model, id.as_str())
                .unwrap_or_else(|| model.config_graph().root().source_path());
            let schema_fields = parse_space_schema(definition)
                .map(|schema| summarize_schema_fields(&schema))
                .unwrap_or_default();
            ContentGroupSummary {
                id: id.as_str().to_string(),
                title: definition.title.clone(),
                description: definition.description.clone(),
                include_patterns: definition.include_patterns.clone(),
                schema_fields,
                create: definition
                    .create
                    .as_ref()
                    .map(|create| summarize_create(create, &definition.template)),
                guidelines: definition.guidelines.clone(),
                entry_count: entry_counts.get(id.as_str()).copied().unwrap_or(0),
                source_path: include_sources.then(|| source_path.to_string()),
            }
        })
        .collect::<Vec<_>>();

    let taxonomies = model
        .config_graph()
        .taxonomies()
        .iter()
        .map(|(id, node)| {
            let terms = model
                .config_graph()
                .terms()
                .iter()
                .filter(|(term_id, _)| term_id.taxonomy() == id)
                .map(|(term_id, term_node)| {
                    let content_group = model
                        .content_group_term_ids()
                        .find(|(candidate, _)| *candidate == term_id)
                        .map(|(_, group_id)| group_id.as_str().to_string());
                    let title = workspace
                        .config
                        .terms
                        .get(id.as_str())
                        .and_then(|terms| terms.get(term_id.term().as_str()))
                        .map(|term| term.title.clone())
                        .unwrap_or_else(|| term_id.term().as_str().to_string());
                    TaxonomyTermSummary {
                        id: term_id.term().as_str().to_string(),
                        title,
                        content_group,
                        source_path: include_sources
                            .then(|| term_node.provenance().source_path().to_string()),
                    }
                })
                .collect();
            TaxonomySummary {
                id: id.as_str().to_string(),
                title: config_value_string(&workspace.config.taxonomies[id.as_str()], "title")
                    .unwrap_or_else(|| id.as_str().to_string()),
                projection: node.projection().map(projection_name).map(str::to_string),
                source_path: include_sources.then(|| node.provenance().source_path().to_string()),
                terms,
            }
        })
        .collect::<Vec<_>>();

    let semantic_types = workspace
        .config
        .types
        .iter()
        .map(|(id, semantic_type)| {
            let (kind, values) = match semantic_type {
                SemanticType::EntryRef { .. } => ("entryRef".to_string(), Vec::new()),
                SemanticType::Enum { values } => ("enum".to_string(), values.clone()),
            };
            let source_path = model
                .config_graph()
                .semantic_types()
                .get(&crate::model::SemanticTypeId::new(id))
                .map(|node| node.provenance().source_path())
                .unwrap_or_else(|| model.config_graph().root().source_path());
            SemanticTypeSummary {
                id: id.clone(),
                kind,
                values,
                target_content_group: model
                    .semantic_type_target(id)
                    .map(|target| target.as_str().to_string()),
                source_path: include_sources.then(|| source_path.to_string()),
            }
        })
        .collect::<Vec<_>>();

    let runtime_values = workspace
        .config
        .runtime
        .values
        .iter()
        .map(|(id, provider)| summarize_runtime_value(id, provider))
        .collect::<Vec<_>>();
    let views = discovery
        .index
        .views
        .iter()
        .map(|view| summarize_view(view, include_sources))
        .collect::<Vec<_>>();

    let mut diagnostics = discovery.diagnostics;
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let overview = ConfigSummaryOverview {
        content_groups: content_groups.len(),
        taxonomies: model.config_graph().taxonomies().len(),
        taxonomy_terms: model.config_graph().terms().len(),
        semantic_types: model.config_graph().semantic_types().len(),
        views: views.len(),
        guidelines: workspace.config.guidelines.len(),
        runtime_values: workspace.config.runtime.values.len(),
    };

    Ok(ConfigSummaryResult {
        schema_version: 1,
        operation: "config.summary".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name.clone(),
            logo: None,
        },
        overview,
        content_groups,
        taxonomies,
        semantic_types,
        views,
        guidelines: workspace.config.guidelines,
        runtime_values,
        sources: include_sources.then(|| {
            workspace
                .config_sources
                .into_iter()
                .map(|source| ConfigSource {
                    path: source.path,
                    present: source.present,
                })
                .collect()
        }),
        summary,
        diagnostics,
    })
}

fn summarize_view(view: &IndexView, include_sources: bool) -> ConfigViewSummary {
    ConfigViewSummary {
        id: view.id.clone(),
        surface: view.surface.clone(),
        mode: view.mode.clone(),
        space: view.space.clone(),
        source: view.source.clone(),
        title: view.title.clone(),
        display: view.display.clone(),
        source_path: include_sources.then(|| view.path.clone()),
    }
}

fn content_group_source_path<'a>(
    model: &'a ResolvedWorkspaceModel,
    group_id: &str,
) -> Option<&'a str> {
    let term_id = model
        .content_group_term_ids()
        .find(|(_, content_group_id)| content_group_id.as_str() == group_id)
        .map(|(term_id, _)| term_id)?;
    model
        .config_graph()
        .terms()
        .get(term_id)
        .map(|node| node.provenance().source_path())
}

fn summarize_create(create: &CreateDefinition, template: &str) -> CreateSummary {
    CreateSummary {
        directory: create.directory.clone(),
        filename: create.filename.clone(),
        template: template.to_string(),
        inputs: create
            .inputs
            .iter()
            .map(|(name, input)| summarize_create_input(name, input))
            .collect(),
    }
}

fn summarize_create_input(name: &str, input: &CreateInput) -> CreateInputSummary {
    CreateInputSummary {
        name: name.to_string(),
        field: input.field.clone(),
        label: input.label.clone(),
        value_type: input.value_type.clone(),
        required: input.required,
        has_default: input.default.is_some(),
        transform: input.transform.clone(),
    }
}

fn summarize_schema_fields(schema: &SchemaNode) -> Vec<SchemaFieldSummary> {
    let mut fields = Vec::new();
    if let SchemaNode::Object {
        fields: root_fields,
        ..
    } = schema
    {
        for (name, field) in root_fields {
            push_schema_field(&mut fields, name, field);
        }
    }
    fields
}

fn push_schema_field(fields: &mut Vec<SchemaFieldSummary>, path: &str, schema: &SchemaNode) {
    let summary = schema_field_summary(path, schema);
    fields.push(summary);
    if let SchemaNode::Object {
        fields: nested_fields,
        ..
    } = schema
    {
        for (name, field) in nested_fields {
            push_schema_field(fields, &format!("{path}.{name}"), field);
        }
    }
}

fn schema_field_summary(path: &str, schema: &SchemaNode) -> SchemaFieldSummary {
    let (type_name, required, readonly, hidden, label, semantic_type, target, item_type) =
        match schema {
            SchemaNode::Object {
                required,
                readonly,
                hidden,
                label,
                ..
            } => (
                "object", required, readonly, hidden, label, None, None, None,
            ),
            SchemaNode::String {
                required,
                readonly,
                hidden,
                label,
            } => (
                "string", required, readonly, hidden, label, None, None, None,
            ),
            SchemaNode::Number {
                required,
                readonly,
                hidden,
                label,
            } => (
                "number", required, readonly, hidden, label, None, None, None,
            ),
            SchemaNode::Integer {
                required,
                readonly,
                hidden,
                label,
            } => (
                "integer", required, readonly, hidden, label, None, None, None,
            ),
            SchemaNode::Boolean {
                required,
                readonly,
                hidden,
                label,
            } => (
                "boolean", required, readonly, hidden, label, None, None, None,
            ),
            SchemaNode::Date {
                required,
                readonly,
                hidden,
                label,
            } => ("date", required, readonly, hidden, label, None, None, None),
            SchemaNode::DateTime {
                required,
                readonly,
                hidden,
                label,
            } => (
                "datetime", required, readonly, hidden, label, None, None, None,
            ),
            SchemaNode::Const {
                required,
                readonly,
                hidden,
                label,
                ..
            } => ("const", required, readonly, hidden, label, None, None, None),
            SchemaNode::Enum {
                enum_type,
                required,
                readonly,
                hidden,
                label,
            } => (
                "enum",
                required,
                readonly,
                hidden,
                label,
                Some(enum_type.clone()),
                None,
                None,
            ),
            SchemaNode::Named {
                name,
                required,
                readonly,
                hidden,
                label,
            } => (
                "named",
                required,
                readonly,
                hidden,
                label,
                Some(name.clone()),
                None,
                None,
            ),
            SchemaNode::EntryRef {
                target,
                required,
                readonly,
                hidden,
                label,
            } => (
                "entryRef",
                required,
                readonly,
                hidden,
                label,
                None,
                target.clone(),
                None,
            ),
            SchemaNode::List {
                items,
                required,
                readonly,
                hidden,
                label,
            } => (
                "list",
                required,
                readonly,
                hidden,
                label,
                None,
                None,
                Some(schema_type_name(items).to_string()),
            ),
        };
    SchemaFieldSummary {
        path: path.to_string(),
        type_name: type_name.to_string(),
        required: *required,
        readonly: *readonly,
        hidden: *hidden,
        label: label.clone(),
        semantic_type,
        target,
        item_type,
    }
}

fn schema_type_name(schema: &SchemaNode) -> &'static str {
    match schema {
        SchemaNode::Object { .. } => "object",
        SchemaNode::String { .. } => "string",
        SchemaNode::Number { .. } => "number",
        SchemaNode::Integer { .. } => "integer",
        SchemaNode::Boolean { .. } => "boolean",
        SchemaNode::Date { .. } => "date",
        SchemaNode::DateTime { .. } => "datetime",
        SchemaNode::Const { .. } => "const",
        SchemaNode::Enum { .. } => "enum",
        SchemaNode::Named { .. } => "named",
        SchemaNode::EntryRef { .. } => "entryRef",
        SchemaNode::List { .. } => "list",
    }
}

fn summarize_runtime_value(id: &str, provider: &RuntimeValueProvider) -> RuntimeValueSummary {
    let (provider_name, required, transform) = match provider {
        RuntimeValueProvider::Const {
            required,
            transform,
            ..
        } => ("const", *required, transform.clone()),
        RuntimeValueProvider::GitConfig {
            required,
            transform,
            ..
        } => ("gitConfig", *required, transform.clone()),
        RuntimeValueProvider::CurrentDate => ("currentDate", false, None),
        RuntimeValueProvider::CurrentDateTime => ("currentDateTime", false, None),
        RuntimeValueProvider::WorkspaceRoot => ("workspaceRoot", false, None),
    };
    RuntimeValueSummary {
        id: id.to_string(),
        provider: provider_name.to_string(),
        required,
        transform,
    }
}

fn projection_name(projection: ConfigProjection) -> &'static str {
    match projection {
        ConfigProjection::ContentGroups => "contentGroups",
    }
}

fn config_value_string(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::summarize_config;
    use crate::OperationError;

    #[test]
    fn summarizes_resolved_content_groups_with_stable_provenance() {
        let fixture = Fixture::new("resolved");
        write_workspace(&fixture.root);

        let result = summarize_config(&fixture.root, None, true).unwrap();

        assert_eq!(
            result
                .content_groups
                .iter()
                .map(|group| group.id.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha", "zeta"]
        );
        assert_eq!(
            result.content_groups[0].source_path.as_deref(),
            Some("config/alpha.md")
        );
        assert_eq!(result.content_groups[0].schema_fields[0].path, "title");
        assert_eq!(result.runtime_values[0].id, "clock");
        assert_eq!(result.runtime_values[0].provider, "currentDateTime");
        assert!(result.content_groups[0].create.as_ref().unwrap().inputs[0].has_default);
        assert_eq!(
            result
                .taxonomies
                .iter()
                .map(|taxonomy| taxonomy.id.as_str())
                .collect::<Vec<_>>(),
            vec!["groups"]
        );
        assert_eq!(
            result.taxonomies[0]
                .terms
                .iter()
                .map(|term| term.id.as_str())
                .collect::<Vec<_>>(),
            vec!["alpha", "zeta"]
        );
        assert!(result.sources.is_some());
        let json = serde_json::to_string(&result).unwrap();
        assert!(!json.contains("TEMPLATE_BODY_SENTINEL"));
        assert!(!json.contains("INPUT_DEFAULT_SENTINEL"));
        assert!(!json.contains("RUNTIME_CONST_SENTINEL"));
    }

    #[test]
    fn filters_one_content_group_and_includes_sources_only_when_requested() {
        let fixture = Fixture::new("filter");
        write_workspace(&fixture.root);

        let result = summarize_config(&fixture.root, Some("zeta"), true).unwrap();

        assert_eq!(result.content_groups.len(), 1);
        assert_eq!(result.overview.content_groups, 1);
        assert_eq!(result.content_groups[0].id, "zeta");
        assert_eq!(result.taxonomies.len(), 1);
        assert_eq!(result.taxonomies[0].terms.len(), 2);
        assert!(
            result.sources.as_ref().is_some_and(|sources| sources
                .iter()
                .any(|source| source.path == "config/zeta.md"))
        );
    }

    #[test]
    fn omits_all_config_source_provenance_by_default() {
        let fixture = Fixture::new("source-default");
        write_workspace(&fixture.root);

        let result = summarize_config(&fixture.root, None, false).unwrap();
        let json = serde_json::to_value(result).unwrap();

        assert!(json.get("sources").is_none());
        assert!(json["contentGroups"][0].get("sourcePath").is_none());
        assert!(json["taxonomies"][0].get("sourcePath").is_none());
        assert!(
            json["taxonomies"][0]["terms"][0]
                .get("sourcePath")
                .is_none()
        );
        assert!(json["views"][0].get("sourcePath").is_none());
    }

    #[test]
    fn missing_content_group_returns_a_typed_error() {
        let fixture = Fixture::new("missing");
        write_workspace(&fixture.root);

        assert!(matches!(
            summarize_config(&fixture.root, Some("missing"), false),
            Err(OperationError::ContentGroupNotFound(id)) if id == "missing"
        ));
    }

    fn write_workspace(root: &Path) {
        write(
            root,
            ".forma.md",
            "---\nschemaVersion: 1\nworkspace:\n  name: Summary Fixture\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nruntime:\n  values:\n    clock:\n      kind: currentDateTime\n    hiddenConst:\n      kind: const\n      value: RUNTIME_CONST_SENTINEL\nimports:\n  - config/*.md\n---\n",
        );
        write(
            root,
            "config/groups.md",
            "---\nschemaVersion: 1\nkind: taxonomy\nid: groups\nprojection: contentGroups\ntitle: Groups\n---\n",
        );
        write(
            root,
            "config/summary-view.md",
            "---\nschemaVersion: 1\nkind: view\ntitle: Summary View\nmode: table\nsource:\n  type: pages\n---\n",
        );
        for (id, title) in [("zeta", "Zeta"), ("alpha", "Alpha")] {
            write(
                root,
                &format!("config/{id}.md"),
                &format!(
                    "---\nschemaVersion: 1\nkind: term\ntaxonomy: groups\ntitle: {title}\ninclude:\n  - content/{id}/**/*.md\ncreate:\n  directory: content/{id}\n  filename: \"{{{{ input.slug }}}}.md\"\n  template: templates/{id}.md\n  inputs:\n    slug:\n      required: true\n      default: INPUT_DEFAULT_SENTINEL\nschema:\n  type: object\n  fields:\n    title:\n      type: string\n      required: true\n---\n"
                ),
            );
            write(
                root,
                &format!("templates/{id}.md"),
                "---\ntitle: \"{{ input.slug }}\"\n---\nTEMPLATE_BODY_SENTINEL\n",
            );
        }
    }

    fn write(root: &Path, path: &str, source: &str) {
        let path = root.join(path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, source).unwrap();
    }

    struct Fixture {
        root: PathBuf,
    }

    impl Fixture {
        fn new(name: &str) -> Self {
            static NEXT_ID: AtomicU64 = AtomicU64::new(0);
            let root = std::env::temp_dir().join(format!(
                "forma-config-summary-{name}-{}-{}",
                std::process::id(),
                NEXT_ID.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&root).unwrap();
            Self { root }
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }
}
