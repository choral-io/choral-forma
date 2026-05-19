use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use markdown::{Options, to_html_with_options};
use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{LoadMode, load_workspace};
use crate::diagnostics::{Diagnostic, DiagnosticSummary, OperationStatus};
use crate::index::{IndexEntry, IndexReference, IndexView, discover_workspace};
use crate::markdown::{FormaMarkdownDocument, FormaReferenceIntent, FormaReferenceSyntax};
use crate::operations::{OperationError, WorkspaceSummary};
use crate::path::{FORMA_VIEWS_DIR, WorkspacePath};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryRenderResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub entry: RenderedEntry,
    pub render: EntryRenderOutput,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedEntry {
    pub path: String,
    pub collection: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryRenderOutput {
    pub format: String,
    pub html: String,
    #[serde(default)]
    pub refs: Vec<IndexReference>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewRenderResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view: Option<RenderedView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub render: Option<ViewRenderOutput>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedView {
    pub id: String,
    pub path: String,
    pub surface: String,
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub collection: String,
    #[serde(default)]
    pub params: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ViewRenderOutput {
    Table {
        columns: Vec<String>,
        items: Vec<ViewRenderItem>,
    },
    Kanban {
        columns: Vec<KanbanRenderColumn>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewRenderItem {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub fields: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanbanRenderColumn {
    pub id: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub items: Vec<ViewRenderItem>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewFile {
    view: Option<ViewDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewDefinition {
    surface: String,
    mode: String,
    collection: String,
    table: Option<TableDefinition>,
    kanban: Option<KanbanDefinition>,
    #[serde(default)]
    sort: Vec<SortDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TableDefinition {
    #[serde(default)]
    columns: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SortDefinition {
    field: String,
    #[serde(default)]
    direction: SortDirection,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
enum SortDirection {
    #[default]
    Asc,
    Desc,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KanbanDefinition {
    #[serde(default)]
    columns: Vec<KanbanColumnDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KanbanColumnDefinition {
    id: String,
    label: String,
    icon: Option<String>,
    query: Option<QueryDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueryDefinition {
    #[serde(default)]
    all: Vec<QueryCondition>,
    #[serde(default)]
    any: Vec<QueryCondition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueryCondition {
    field: String,
    op: QueryOperator,
    value: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
enum QueryOperator {
    Equals,
}

#[derive(Debug, Clone)]
struct RenderCandidate {
    path: String,
    title: Option<String>,
    metadata: Value,
}

pub fn render_entry(
    root: impl AsRef<Path>,
    path: &str,
    format: &str,
) -> Result<EntryRenderResult, OperationError> {
    if format != "html" {
        return Err(OperationError::InvalidInput("format".to_string()));
    }

    let path = normalize_markdown_path(path)?;
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let index_entry = discovery
        .index
        .entries
        .iter()
        .find(|entry| entry.path == path)
        .ok_or(OperationError::EntryNotFound)?;
    let source =
        fs::read_to_string(root.as_ref().join(&path)).map_err(|source| OperationError::Io {
            path: path.clone(),
            source,
        })?;
    let document = FormaMarkdownDocument::parse(&source);
    let mut diagnostics = discovery.diagnostics;
    diagnostics.extend(
        document
            .diagnostics
            .iter()
            .cloned()
            .map(|diagnostic| diagnostic.with_path(path.clone())),
    );
    diagnostics.sort_by_key(render_diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(EntryRenderResult {
        schema_version: 1,
        operation: "entry.render".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        entry: RenderedEntry {
            path,
            collection: index_entry.collection.clone(),
            kind: index_entry.kind.clone(),
            title: index_entry.title.clone(),
        },
        render: EntryRenderOutput {
            format: format.to_string(),
            html: render_markdown_html(&document),
            refs: index_entry.refs.clone(),
        },
        summary,
        diagnostics,
    })
}

pub fn render_view(
    root: impl AsRef<Path>,
    view: &str,
    params: BTreeMap<String, Value>,
) -> Result<ViewRenderResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let index_view = discovery
        .index
        .views
        .iter()
        .find(|candidate| candidate.id == view);
    let view_path = if let Some(index_view) = index_view {
        index_view.path.clone()
    } else {
        fallback_view_path(root.as_ref(), view)?
    };

    let mut diagnostics = discovery.diagnostics;
    let source = fs::read_to_string(root.as_ref().join(&view_path)).map_err(|source| {
        OperationError::Io {
            path: view_path.clone(),
            source,
        }
    })?;
    let document = FormaMarkdownDocument::parse(&source);
    diagnostics.extend(
        document
            .diagnostics
            .iter()
            .cloned()
            .map(|diagnostic| diagnostic.with_path(view_path.clone())),
    );

    let view_definition = parse_view_definition(&document, &view_path, &mut diagnostics);
    let has_mount = document.references.iter().any(|reference| {
        reference.intent == FormaReferenceIntent::View && reference.target.is_empty()
    });
    if !has_mount {
        diagnostics.push(
            Diagnostic::error(
                "view.mountMissing",
                "View must contain a forma-view mount point.",
            )
            .with_path(view_path.clone()),
        );
    }

    let definition_is_valid = view_definition.as_ref().is_some_and(|definition| {
        definition.surface == "page"
            && workspace
                .config
                .collections
                .contains_key(&definition.collection)
    });
    if view_definition.is_some() && !definition_is_valid {
        diagnostics.push(
            Diagnostic::error("view.invalid", "View definition is invalid.")
                .with_path(view_path.clone()),
        );
    }
    let render = view_definition.as_ref().and_then(|definition| {
        if definition_is_valid {
            render_view_definition(root.as_ref(), definition, &discovery.index.entries)
        } else {
            None
        }
    });
    if definition_is_valid && render.is_none() {
        diagnostics.push(
            Diagnostic::error("view.invalid", "View definition is invalid.")
                .with_path(view_path.clone()),
        );
    }
    diagnostics.sort_by_key(render_diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(ViewRenderResult {
        schema_version: 1,
        operation: "view.render".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        view: view_definition
            .as_ref()
            .map(|definition| rendered_view(index_view, view, &view_path, definition, params)),
        render,
        summary,
        diagnostics,
    })
}

fn parse_view_definition(
    document: &FormaMarkdownDocument,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<ViewDefinition> {
    let Some(value) = document.frontmatter.value.clone() else {
        diagnostics.push(
            Diagnostic::error("view.invalid", "View must define YAML frontmatter.").with_path(path),
        );
        return None;
    };
    let Ok(file) = serde_yml::from_value::<ViewFile>(value) else {
        diagnostics
            .push(Diagnostic::error("view.invalid", "View definition is invalid.").with_path(path));
        return None;
    };
    let Some(view) = file.view else {
        diagnostics
            .push(Diagnostic::error("view.invalid", "View definition is invalid.").with_path(path));
        return None;
    };
    Some(view)
}

fn rendered_view(
    index_view: Option<&IndexView>,
    id: &str,
    path: &str,
    definition: &ViewDefinition,
    params: BTreeMap<String, Value>,
) -> RenderedView {
    RenderedView {
        id: index_view
            .map(|view| view.id.clone())
            .unwrap_or_else(|| id.to_string()),
        path: index_view
            .map(|view| view.path.clone())
            .unwrap_or_else(|| path.to_string()),
        surface: definition.surface.clone(),
        mode: definition.mode.clone(),
        title: index_view.and_then(|view| view.title.clone()),
        collection: definition.collection.clone(),
        params,
    }
}

fn render_view_definition(
    root: &Path,
    definition: &ViewDefinition,
    entries: &[IndexEntry],
) -> Option<ViewRenderOutput> {
    if definition.surface != "page" {
        return None;
    }
    let mut items = entries
        .iter()
        .filter(|entry| entry.collection == definition.collection)
        .filter_map(|entry| RenderCandidate::from_index_entry(root, entry))
        .collect::<Vec<_>>();
    apply_sort(&mut items, &definition.sort);

    match definition.mode.as_str() {
        "table" => {
            let columns = definition
                .table
                .as_ref()
                .map(|table| table.columns.clone())
                .unwrap_or_default();
            Some(ViewRenderOutput::Table {
                columns: columns.clone(),
                items: items
                    .into_iter()
                    .map(|item| item.into_view_item(&columns))
                    .collect(),
            })
        }
        "kanban" => {
            let kanban = definition.kanban.as_ref()?;
            Some(ViewRenderOutput::Kanban {
                columns: kanban
                    .columns
                    .iter()
                    .map(|column| KanbanRenderColumn {
                        id: column.id.clone(),
                        label: column.label.clone(),
                        icon: column.icon.clone(),
                        items: items
                            .iter()
                            .filter(|item| column_matches(item, column))
                            .map(|item| item.clone().into_all_fields_view_item())
                            .collect(),
                    })
                    .collect(),
            })
        }
        _ => None,
    }
}

impl RenderCandidate {
    fn from_index_entry(root: &Path, entry: &IndexEntry) -> Option<Self> {
        let metadata = read_entry_metadata(root, &entry.path)?;
        Some(Self {
            path: entry.path.clone(),
            title: entry.title.clone(),
            metadata,
        })
    }

    fn into_view_item(self, columns: &[String]) -> ViewRenderItem {
        let fields = columns
            .iter()
            .filter_map(|column| {
                value_at_path(&self.metadata, column)
                    .cloned()
                    .map(|value| (column.clone(), value))
            })
            .collect();
        ViewRenderItem {
            path: self.path,
            title: self.title,
            fields,
        }
    }

    fn into_all_fields_view_item(self) -> ViewRenderItem {
        let fields = match self.metadata {
            Value::Mapping(mapping) => mapping
                .into_iter()
                .filter_map(|(key, value)| key.as_str().map(|key| (key.to_string(), value)))
                .collect(),
            _ => BTreeMap::new(),
        };
        ViewRenderItem {
            path: self.path,
            title: self.title,
            fields,
        }
    }
}

fn read_entry_metadata(root: &Path, path: &str) -> Option<Value> {
    let source = fs::read_to_string(root.join(path)).ok()?;
    FormaMarkdownDocument::parse(&source).frontmatter.value
}

fn apply_sort(items: &mut [RenderCandidate], sort: &[SortDefinition]) {
    for sort in sort.iter().rev() {
        items.sort_by(|left, right| {
            let left_value = comparable_value(value_at_path(&left.metadata, &sort.field));
            let right_value = comparable_value(value_at_path(&right.metadata, &sort.field));
            let ordering = left_value.cmp(&right_value);
            if sort.direction == SortDirection::Desc {
                ordering.reverse()
            } else {
                ordering
            }
        });
    }
}

fn column_matches(item: &RenderCandidate, column: &KanbanColumnDefinition) -> bool {
    let Some(query) = column.query.as_ref() else {
        return true;
    };
    let all_match = query
        .all
        .iter()
        .all(|condition| condition_matches(item, condition));
    let any_match = query.any.is_empty()
        || query
            .any
            .iter()
            .any(|condition| condition_matches(item, condition));
    all_match && any_match
}

fn condition_matches(item: &RenderCandidate, condition: &QueryCondition) -> bool {
    match condition.op {
        QueryOperator::Equals => value_at_path(&item.metadata, &condition.field)
            .is_some_and(|actual| values_equal(actual, &condition.value)),
    }
}

fn values_equal(actual: &Value, expected: &Value) -> bool {
    match (actual, expected) {
        (Value::String(left), Value::String(right)) => left == right,
        _ => actual == expected,
    }
}

fn comparable_value(value: Option<&Value>) -> String {
    match value {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Number(value)) => value.to_string(),
        Some(Value::Bool(value)) => value.to_string(),
        Some(value) => serde_json::to_string(value).unwrap_or_default(),
        None => String::new(),
    }
}

fn value_at_path<'a>(value: &'a Value, field: &str) -> Option<&'a Value> {
    let mut current = value;
    for segment in field.split('.') {
        current = current
            .as_mapping()?
            .get(Value::String(segment.to_string()))?;
    }
    Some(current)
}

fn render_markdown_html(document: &FormaMarkdownDocument) -> String {
    let markdown = markdown_with_reference_fallbacks(document);
    to_html_with_options(&markdown, &Options::gfm()).expect("normal Markdown renders to HTML")
}

fn markdown_with_reference_fallbacks(document: &FormaMarkdownDocument) -> String {
    let mut output = document.body.clone();
    let mut replacements = document
        .references
        .iter()
        .filter(|reference| {
            matches!(
                reference.syntax,
                FormaReferenceSyntax::Wikilink | FormaReferenceSyntax::ObsidianEmbed
            )
        })
        .filter_map(|reference| reference.span.map(|span| (span, reference)))
        .collect::<Vec<_>>();
    replacements.sort_by_key(|(span, _)| span.start_byte);

    for (span, reference) in replacements.into_iter().rev() {
        let label = reference
            .label
            .as_deref()
            .unwrap_or(reference.target.as_str());
        let replacement = format!("[{label}]({})", reference.target);
        output.replace_range(span.start_byte..span.end_byte, &replacement);
    }
    output
}

fn normalize_markdown_path(path: &str) -> Result<String, OperationError> {
    let path = WorkspacePath::parse_cli(path)?;
    let value = path.as_str();
    if value.ends_with(".md") {
        Ok(value.to_string())
    } else {
        Ok(format!("{value}.md"))
    }
}

fn fallback_view_path(root: &Path, view: &str) -> Result<String, OperationError> {
    let view = view.strip_suffix(".md").unwrap_or(view);
    let path = WorkspacePath::parse_cli(format!("{FORMA_VIEWS_DIR}/{view}.md"))?;
    if root.join(path.as_str()).is_file() {
        Ok(path.as_str().to_string())
    } else {
        Err(OperationError::ViewNotFound(view.to_string()))
    }
}

fn render_diagnostic_sort_key(diagnostic: &Diagnostic) -> (String, String, String) {
    (
        diagnostic.path.clone().unwrap_or_default(),
        diagnostic.code.clone(),
        diagnostic.message.clone(),
    )
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_yml::Value;

    use super::{ViewRenderOutput, render_entry, render_view};
    use crate::operations::{create_entry, init_workspace};

    #[test]
    fn renders_entry_html_and_degrades_obsidian_embed_to_link() {
        let root = fixture_root("entry-render");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Source\n\nSee ![[notes/target|Target note]].\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/target.md"),
            "---\nkind: note\ntitle: Target\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Target\n",
        )
        .unwrap();

        let result = render_entry(&root, "notes/source.md", "html").unwrap();

        assert_eq!(result.operation, "entry.render");
        assert_eq!(result.status, crate::OperationStatus::Passed);
        assert!(result.render.html.contains("<h1>Source</h1>"));
        assert!(
            result
                .render
                .html
                .contains(r#"<a href="notes/target">Target note</a>"#)
        );
        assert_eq!(result.render.refs.len(), 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn entry_render_reports_unresolved_references_as_diagnostics() {
        let root = fixture_root("entry-render-unresolved-ref");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\nSee [[notes/missing]].\n",
        )
        .unwrap();

        let result = render_entry(&root, "notes/source.md", "html").unwrap();

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "ref.unresolved")
        );
        assert!(result.render.html.contains("notes/missing"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_starter_table_view_with_zero_and_fixture_entries() {
        let root = fixture_root("table-view-render");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();

        let empty = render_view(&root, "notes", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Table { columns, items }) = empty.render else {
            panic!("expected table render");
        };
        assert_eq!(columns, vec!["title", "summary", "createdAt"]);
        assert!(items.is_empty());

        create_entry(
            &root,
            "notes",
            BTreeMap::from([("title".to_string(), Value::String("Alpha Note".to_string()))]),
        )
        .unwrap();
        let filled = render_view(&root, "notes", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Table { items, .. }) = filled.render else {
            panic!("expected table render");
        };
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "notes/alpha-note.md");
        assert_eq!(items[0].fields["title"], "Alpha Note");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_kanban_view_from_query_columns() {
        let root = fixture_root("kanban-view-render");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        create_entry(
            &root,
            "todos",
            BTreeMap::from([
                (
                    "title".to_string(),
                    Value::String("Draft brief".to_string()),
                ),
                ("status".to_string(), Value::String("doing".to_string())),
            ]),
        )
        .unwrap();

        let result = render_view(&root, "todos", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Kanban { columns }) = result.render else {
            panic!("expected kanban render");
        };
        let doing = columns
            .iter()
            .find(|column| column.id == "doing")
            .expect("doing column should exist");
        assert_eq!(doing.items.len(), 1);
        assert_eq!(doing.items[0].fields["title"], "Draft brief");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_view_mount_as_diagnostic() {
        let root = fixture_root("view-missing-mount");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: notes\n  title: Notes\n  table:\n    columns:\n      - title\n---\n\n# Notes\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.mountMissing")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_invalid_view_definition_as_diagnostic() {
        let root = fixture_root("view-invalid");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: notes\n  table: broken\n---\n\n# Notes\n\n<!-- forma-view -->\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.invalid")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_unindexed_invalid_view_file_as_diagnostic() {
        let root = fixture_root("view-invalid-unindexed");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: missing\n  table:\n    columns:\n      - title\n---\n\n# Notes\n\n<!-- forma-view -->\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.invalid")
        );
        assert!(result.render.is_none());

        fs::remove_dir_all(root).unwrap();
    }

    fn fixture_root(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-render-{name}-{unique}"))
    }
}
