use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use globset::{Glob, GlobSetBuilder};
use markdown::{Options, to_html_with_options};
use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{LoadMode, load_workspace};
use crate::diagnostics::{Diagnostic, DiagnosticSummary, OperationStatus};
use crate::index::{
    IndexEntry, IndexReference, IndexView, ReferenceIntent, ReferenceSource, discover_workspace,
};
use crate::markdown::{FormaMarkdownDocument, FormaReferenceIntent, FormaReferenceSyntax};
use crate::operations::{
    OperationError, WorkspaceSummary, diagnostic_sort_key, diagnostics_for_workspace_path,
};
use crate::path::{FORMA_VIEWS_DIR, WorkspacePath};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRenderResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub file: RenderedFile,
    pub render: FileRenderOutput,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedFile {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRenderOutput {
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub headings: Vec<RenderedHeading>,
    #[serde(default)]
    pub refs: Vec<IndexReference>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderedHeading {
    pub id: String,
    pub level: u8,
    pub text: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<ViewSource>,
    #[serde(default)]
    pub params: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ViewRenderOutput {
    List {
        items: Vec<ViewRenderItem>,
    },
    Table {
        columns: Vec<String>,
        items: Vec<ViewRenderItem>,
    },
    Kanban {
        columns: Vec<KanbanRenderColumn>,
    },
    Graph {
        nodes: Vec<GraphRenderNode>,
        edges: Vec<GraphRenderEdge>,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRenderNode {
    pub id: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub space: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRenderEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_path: String,
    pub target_path: String,
    pub intent: ReferenceIntent,
    pub reference_source: ReferenceSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
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
    space: Option<String>,
    source: Option<ViewSource>,
    query: Option<QueryDefinition>,
    table: Option<TableDefinition>,
    kanban: Option<KanbanDefinition>,
    #[serde(default)]
    sort: Vec<SortDefinition>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewSource {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub include: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub exclude: Vec<String>,
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
    all: Vec<QueryNode>,
    #[serde(default)]
    any: Vec<QueryNode>,
    #[serde(default)]
    not: Vec<QueryNode>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct QueryNode {
    target: Option<String>,
    field: Option<String>,
    op: Option<QueryOperator>,
    value: Option<Value>,
    #[serde(default)]
    all: Vec<QueryNode>,
    #[serde(default)]
    any: Vec<QueryNode>,
    #[serde(default)]
    not: Vec<QueryNode>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
enum QueryOperator {
    Equals,
    In,
    Contains,
    Exists,
}

#[derive(Debug, Clone)]
struct RenderCandidate {
    path: String,
    space: String,
    kind: Option<String>,
    title: Option<String>,
    metadata: Value,
}

pub fn render_file(
    root: impl AsRef<Path>,
    path: &str,
    format: &str,
) -> Result<FileRenderResult, OperationError> {
    if format == "source" {
        return render_source_file(root, path);
    }
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
    let mut diagnostics = diagnostics_for_workspace_path(discovery.diagnostics, &path);
    diagnostics.extend(
        document
            .diagnostics
            .iter()
            .cloned()
            .map(|diagnostic| diagnostic.with_path(path.clone())),
    );
    diagnostics.sort_by_key(diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(FileRenderResult {
        schema_version: 1,
        operation: "file.render".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        file: RenderedFile {
            path,
            space: Some(index_entry.space.clone()),
            kind: index_entry.kind.clone(),
            title: index_entry.title.clone(),
        },
        render: FileRenderOutput {
            format: format.to_string(),
            html: Some(render_markdown_html(&document)),
            source: None,
            headings: render_headings(&document),
            refs: index_entry.refs.clone(),
        },
        summary,
        diagnostics,
    })
}

fn render_source_file(
    root: impl AsRef<Path>,
    path: &str,
) -> Result<FileRenderResult, OperationError> {
    let path = WorkspacePath::parse_cli(path)?.as_str().to_string();
    let source =
        fs::read_to_string(root.as_ref().join(&path)).map_err(|source| OperationError::Io {
            path: path.clone(),
            source,
        })?;
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let summary = DiagnosticSummary::default();

    Ok(FileRenderResult {
        schema_version: 1,
        operation: "file.render".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        file: RenderedFile {
            path,
            space: None,
            kind: None,
            title: None,
        },
        render: FileRenderOutput {
            format: "source".to_string(),
            html: None,
            source: Some(source),
            headings: Vec::new(),
            refs: Vec::new(),
        },
        summary,
        diagnostics: Vec::new(),
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
        view_definition_is_valid(
            definition,
            &workspace.config.spaces,
            &view_path,
            &mut diagnostics,
        )
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
    let render_required = view_definition.as_ref().is_some_and(|definition| {
        matches!(
            definition.mode.as_str(),
            "list" | "table" | "kanban" | "graph"
        )
    });
    if definition_is_valid && render_required && render.is_none() {
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

fn view_definition_is_valid(
    definition: &ViewDefinition,
    spaces: &BTreeMap<String, crate::config::SpaceDefinition>,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> bool {
    let mut valid = true;
    if definition.surface != "page" {
        valid = false;
    }
    if let Some(space) = &definition.space
        && !spaces.contains_key(space)
    {
        valid = false;
    }
    if let Some(source) = &definition.source
        && source.kind != "workspace"
    {
        valid = false;
    }
    if let Some(source) = &definition.source {
        valid &= view_source_is_valid(source, path, diagnostics);
    }
    if let Some(query) = &definition.query {
        valid &= query_is_valid(query, path, diagnostics);
    }
    if let Some(kanban) = &definition.kanban {
        for column in &kanban.columns {
            if let Some(query) = &column.query {
                valid &= query_is_valid(query, path, diagnostics);
            }
        }
    }
    valid
}

fn view_source_is_valid(
    source: &ViewSource,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> bool {
    let mut valid = true;
    for pattern in source.include.iter().chain(source.exclude.iter()) {
        if Glob::new(pattern).is_err() {
            diagnostics.push(
                Diagnostic::error("view.sourceInvalid", "View source glob is invalid.")
                    .with_path(path)
                    .with_actual(pattern.clone()),
            );
            valid = false;
        }
    }
    valid
}

fn query_is_valid(query: &QueryDefinition, path: &str, diagnostics: &mut Vec<Diagnostic>) -> bool {
    query
        .all
        .iter()
        .all(|node| query_node_is_valid(node, path, diagnostics))
        & query
            .any
            .iter()
            .all(|node| query_node_is_valid(node, path, diagnostics))
        & query
            .not
            .iter()
            .all(|node| query_node_is_valid(node, path, diagnostics))
}

fn query_node_is_valid(node: &QueryNode, path: &str, diagnostics: &mut Vec<Diagnostic>) -> bool {
    let has_children = !node.all.is_empty() || !node.any.is_empty() || !node.not.is_empty();
    let mut valid = true;
    valid &= node
        .all
        .iter()
        .all(|child| query_node_is_valid(child, path, diagnostics));
    valid &= node
        .any
        .iter()
        .all(|child| query_node_is_valid(child, path, diagnostics));
    valid &= node
        .not
        .iter()
        .all(|child| query_node_is_valid(child, path, diagnostics));
    if has_children {
        return valid;
    }

    if node.op.is_none() || query_node_target(node).is_none() {
        diagnostics.push(
            Diagnostic::error("view.queryInvalid", "View query predicate is invalid.")
                .with_path(path),
        );
        return false;
    }
    if let Some(target) = &node.target
        && !is_supported_target(target)
    {
        diagnostics.push(
            Diagnostic::error("view.queryInvalid", "View query target is invalid.")
                .with_path(path)
                .with_actual(target.clone()),
        );
        valid = false;
    }
    if matches!(node.op, Some(QueryOperator::Exists))
        && node.value.as_ref().is_some_and(|value| !value.is_bool())
    {
        diagnostics.push(
            Diagnostic::error(
                "view.queryInvalid",
                "View query exists value must be boolean.",
            )
            .with_path(path),
        );
        valid = false;
    }
    valid
}

fn is_supported_target(target: &str) -> bool {
    matches!(
        target,
        "entry.space" | "entry.path" | "entry.kind" | "entry.title"
    ) || target.starts_with("frontmatter.")
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
        space: definition.space.clone(),
        source: Some(definition.source.clone().unwrap_or_else(workspace_source)),
        params,
    }
}

fn workspace_source() -> ViewSource {
    ViewSource {
        kind: "workspace".to_string(),
        include: Vec::new(),
        exclude: Vec::new(),
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
        .filter_map(|entry| RenderCandidate::from_index_entry(root, entry))
        .filter(|item| view_candidate_matches(item, definition))
        .collect::<Vec<_>>();
    apply_sort(&mut items, &definition.sort);

    match definition.mode.as_str() {
        "list" => Some(ViewRenderOutput::List {
            items: items
                .into_iter()
                .map(RenderCandidate::into_all_fields_view_item)
                .collect(),
        }),
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
        "graph" => Some(render_graph_view(&items, entries)),
        _ => None,
    }
}

fn render_graph_view(items: &[RenderCandidate], entries: &[IndexEntry]) -> ViewRenderOutput {
    let included_paths = items
        .iter()
        .map(|item| item.path.as_str())
        .collect::<BTreeSet<_>>();
    let entry_by_path = entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect::<BTreeMap<_, _>>();

    let nodes = items
        .iter()
        .map(|item| GraphRenderNode {
            id: item.path.clone(),
            path: item.path.clone(),
            title: item.title.clone(),
            space: item.space.clone(),
            kind: item.kind.clone(),
        })
        .collect();

    let mut seen_edges = BTreeSet::<String>::new();
    let mut edges = Vec::new();
    for item in items {
        let Some(entry) = entry_by_path.get(item.path.as_str()) else {
            continue;
        };

        for reference in &entry.refs {
            if reference.source != ReferenceSource::Body {
                continue;
            }

            if !included_paths.contains(reference.target_path.as_str()) {
                continue;
            }

            let key = format!(
                "{}->{}:{:?}:{:?}:{}",
                entry.path,
                reference.target_path,
                reference.intent,
                reference.source,
                reference.field.as_deref().unwrap_or_default()
            );
            if !seen_edges.insert(key.clone()) {
                continue;
            }

            edges.push(GraphRenderEdge {
                id: key,
                source: entry.path.clone(),
                target: reference.target_path.clone(),
                source_path: entry.path.clone(),
                target_path: reference.target_path.clone(),
                intent: reference.intent,
                reference_source: reference.source,
                field: reference.field.clone(),
            });
        }
    }

    ViewRenderOutput::Graph { nodes, edges }
}

impl RenderCandidate {
    fn from_index_entry(root: &Path, entry: &IndexEntry) -> Option<Self> {
        let metadata = read_entry_metadata(root, &entry.path)?;
        Some(Self {
            path: entry.path.clone(),
            space: entry.space.clone(),
            kind: entry.kind.clone(),
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
    query_matches(item, query)
}

fn view_candidate_matches(item: &RenderCandidate, definition: &ViewDefinition) -> bool {
    if !source_matches(&item.path, definition.source.as_ref()) {
        return false;
    }
    if let Some(space) = &definition.space
        && item.space != *space
    {
        return false;
    }
    definition
        .query
        .as_ref()
        .is_none_or(|query| query_matches(item, query))
}

fn source_matches(path: &str, source: Option<&ViewSource>) -> bool {
    let Some(source) = source else {
        return true;
    };
    if source.kind != "workspace" {
        return false;
    }
    let include_match = source.include.is_empty() || path_matches_any(path, &source.include);
    let exclude_match = path_matches_any(path, &source.exclude);
    include_match && !exclude_match
}

fn path_matches_any(path: &str, patterns: &[String]) -> bool {
    if patterns.is_empty() {
        return false;
    }
    let mut builder = GlobSetBuilder::new();
    for pattern in patterns {
        let Ok(glob) = Glob::new(pattern) else {
            return false;
        };
        builder.add(glob);
    }
    builder.build().is_ok_and(|set| set.is_match(path))
}

fn query_matches(item: &RenderCandidate, query: &QueryDefinition) -> bool {
    let all_match = query.all.iter().all(|node| query_node_matches(item, node));
    let any_match =
        query.any.is_empty() || query.any.iter().any(|node| query_node_matches(item, node));
    let not_match = query.not.iter().all(|node| !query_node_matches(item, node));
    all_match && any_match && not_match
}

fn query_node_matches(item: &RenderCandidate, node: &QueryNode) -> bool {
    if !node.all.is_empty() || !node.any.is_empty() || !node.not.is_empty() {
        let all_match = node.all.iter().all(|child| query_node_matches(item, child));
        let any_match =
            node.any.is_empty() || node.any.iter().any(|child| query_node_matches(item, child));
        let not_match = node
            .not
            .iter()
            .all(|child| !query_node_matches(item, child));
        return all_match && any_match && not_match;
    }

    let Some(op) = node.op else {
        return false;
    };
    let target = query_node_target(node);
    let actual = target.and_then(|target| value_for_target(item, target));

    match op {
        QueryOperator::Equals => node.value.as_ref().is_some_and(|expected| {
            actual
                .as_ref()
                .is_some_and(|actual| values_equal(actual, expected))
        }),
        QueryOperator::In => node.value.as_ref().is_some_and(|expected| {
            actual.as_ref().is_some_and(|actual| match expected {
                Value::Sequence(values) => values.iter().any(|value| values_equal(actual, value)),
                _ => false,
            })
        }),
        QueryOperator::Contains => node.value.as_ref().is_some_and(|expected| {
            actual
                .as_ref()
                .is_some_and(|actual| value_contains(actual, expected))
        }),
        QueryOperator::Exists => {
            let expected = node.value.as_ref().and_then(Value::as_bool).unwrap_or(true);
            actual.is_some() == expected
        }
    }
}

fn query_node_target(node: &QueryNode) -> Option<&str> {
    node.target.as_deref().or_else(|| node.field.as_deref())
}

fn value_for_target(item: &RenderCandidate, target: &str) -> Option<Value> {
    if target == "entry.space" {
        return Some(Value::String(item.space.clone()));
    }
    if target == "entry.path" {
        return Some(Value::String(item.path.clone()));
    }
    if target == "entry.kind" {
        return item.kind.clone().map(Value::String);
    }
    if target == "entry.title" {
        return item.title.clone().map(Value::String);
    }
    target
        .strip_prefix("frontmatter.")
        .and_then(|field| value_at_path(&item.metadata, field).cloned())
        .or_else(|| value_at_path(&item.metadata, target).cloned())
}

fn value_contains(actual: &Value, expected: &Value) -> bool {
    match actual {
        Value::Sequence(values) => values.iter().any(|value| values_equal(value, expected)),
        Value::String(actual) => expected
            .as_str()
            .is_some_and(|expected| actual.contains(expected)),
        _ => false,
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

fn render_headings(document: &FormaMarkdownDocument) -> Vec<RenderedHeading> {
    let mut seen = BTreeMap::<String, usize>::new();
    document
        .headings
        .iter()
        .map(|heading| {
            let base_id = slugify_heading(&heading.text);
            let count = seen.entry(base_id.clone()).or_insert(0);
            *count += 1;
            let id = if *count == 1 {
                base_id
            } else {
                format!("{base_id}-{count}")
            };

            RenderedHeading {
                id,
                level: heading.level,
                text: heading.text.clone(),
            }
        })
        .collect()
}

fn slugify_heading(text: &str) -> String {
    let slug = text
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    if slug.is_empty() {
        "section".to_string()
    } else {
        slug
    }
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
        let href = reference_fallback_href(&reference.target);
        let replacement = format!("[{label}](<{href}>)");
        output.replace_range(span.start_byte..span.end_byte, &replacement);
    }
    output
}

fn reference_fallback_href(target: &str) -> String {
    let trimmed = target.trim();
    let (path, fragment) = trimmed.split_once('#').unwrap_or((trimmed, ""));
    let mut path = path.trim_start_matches('/').to_string();
    if !path.ends_with(".md") {
        path.push_str(".md");
    }
    if fragment.is_empty() {
        format!("./{path}")
    } else {
        format!("./{path}#{fragment}")
    }
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

    use super::{
        ReferenceIntent, ReferenceSource, RenderedHeading, ViewRenderOutput, render_file,
        render_view,
    };
    use crate::operations::{OperationError, create_entry, init_workspace};

    #[test]
    fn renders_file_html_and_degrades_obsidian_embed_to_link() {
        let root = fixture_root("file-render");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Source\n\n## Context\n\n### Details\n\n## Context\n\nSee ![[notes/target|Target note]].\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/target.md"),
            "---\nkind: note\ntitle: Target\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Target\n",
        )
        .unwrap();

        let result = render_file(&root, "notes/source.md", "html").unwrap();

        assert_eq!(result.operation, "file.render");
        assert_eq!(result.status, crate::OperationStatus::Passed);
        let html = result.render.html.as_deref().unwrap_or_default();
        assert!(html.contains("<h1>Source</h1>"));
        assert!(html.contains(r#"<a href="./notes/target.md">Target note</a>"#));
        assert_eq!(
            result.render.headings,
            vec![
                RenderedHeading {
                    id: "context".to_string(),
                    level: 2,
                    text: "Context".to_string(),
                },
                RenderedHeading {
                    id: "details".to_string(),
                    level: 3,
                    text: "Details".to_string(),
                },
                RenderedHeading {
                    id: "context-2".to_string(),
                    level: 2,
                    text: "Context".to_string(),
                },
            ],
        );
        assert_eq!(result.render.refs.len(), 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_wikilink_fallbacks_as_base_relative_markdown_paths() {
        let root = fixture_root("file-render-base-relative-wikilink");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Source\n\nOwner: [[users/tiscs|Tiscs]].\n",
        )
        .unwrap();
        fs::write(
            root.join("users/tiscs.md"),
            "---\nkind: user\nname: Tiscs\nrole: Developer\n---\n\n# Tiscs\n",
        )
        .unwrap();

        let result = render_file(&root, "notes/source.md", "html").unwrap();

        let html = result.render.html.as_deref().unwrap_or_default();
        assert!(html.contains(r#"<a href="./users/tiscs.md">Tiscs</a>"#));
        assert!(!html.contains(r#"href="users/tiscs""#));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_render_reports_unresolved_references_as_diagnostics() {
        let root = fixture_root("file-render-unresolved-ref");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\nSee [[notes/missing]].\n",
        )
        .unwrap();

        let result = render_file(&root, "notes/source.md", "html").unwrap();

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "ref.unresolved")
        );
        assert!(
            result
                .render
                .html
                .as_deref()
                .unwrap_or_default()
                .contains("notes/missing")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_render_reports_only_selected_document_diagnostics() {
        let root = fixture_root("file-render-scoped-diagnostics");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/broken.md"),
            "---\nkind: note\nsummary: Missing title\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Broken\n",
        )
        .unwrap();

        let result = render_file(&root, "notes/source.md", "html").unwrap();

        assert_eq!(result.status, crate::OperationStatus::Passed);
        assert!(result.diagnostics.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_source_for_workspace_text_files() {
        let root = fixture_root("file-render-source");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();

        let result = render_file(&root, ".forma/workspace.yml", "source").unwrap();

        assert_eq!(result.status, crate::OperationStatus::Passed);
        assert_eq!(result.file.path, ".forma/workspace.yml");
        assert_eq!(result.file.space, None);
        assert_eq!(result.render.format, "source");
        assert!(result.render.html.is_none());
        assert!(
            result
                .render
                .source
                .as_deref()
                .unwrap_or_default()
                .contains("workspace:")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_render_html_accepts_knowledge_files_and_rejects_templates() {
        let root = fixture_root("file-render-html");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "File Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/renderable.md"),
            "---\nkind: note\ntitle: Renderable\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Renderable\n",
        )
        .unwrap();

        let rendered = render_file(&root, "notes/renderable.md", "html").unwrap();
        assert_eq!(rendered.operation, "file.render");
        assert_eq!(rendered.file.path, "notes/renderable.md");
        assert!(
            rendered
                .render
                .html
                .as_deref()
                .unwrap_or_default()
                .contains("<h1>Renderable</h1>")
        );

        assert!(matches!(
            render_file(&root, ".forma/templates/note.md", "html"),
            Err(OperationError::EntryNotFound)
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_render_source_reads_text_resources() {
        let root = fixture_root("file-render-source-resource");
        fs::create_dir_all(root.join("assets")).unwrap();
        init_workspace(&root, "File Source Test", "en", Some("UTC")).unwrap();
        fs::write(root.join("assets/data.json"), br#"{"ok":true}"#).unwrap();

        let rendered = render_file(&root, "assets/data.json", "source").unwrap();
        assert_eq!(rendered.operation, "file.render");
        assert_eq!(rendered.file.path, "assets/data.json");
        assert_eq!(rendered.render.source.as_deref(), Some("{\"ok\":true}"));

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
    fn renders_list_view_from_query_candidates() {
        let root = fixture_root("list-view-render");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        create_entry(
            &root,
            "notes",
            BTreeMap::from([("title".to_string(), Value::String("Background".to_string()))]),
        )
        .unwrap();
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
        fs::write(
            root.join(".forma/views/recent.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: list\n  title: Recent Workspace Items\n  source:\n    kind: workspace\n    include:\n      - \"**/*.md\"\n  query:\n    all:\n      - target: frontmatter.title\n        op: contains\n        value: brief\n---\n\n# Recent Workspace Items\n\n<!-- forma-view -->\n",
        )
        .unwrap();

        let result = render_view(&root, "recent", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::List { items }) = result.render else {
            panic!("expected list render");
        };

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "todos/draft-brief.md");
        assert_eq!(items[0].title.as_deref(), Some("Draft brief"));
        assert_eq!(items[0].fields["status"], "doing");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_graph_view_from_resolved_index_references() {
        let root = fixture_root("graph-view-render");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Source\n\nSee [Target](target).\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/target.md"),
            "---\nkind: note\ntitle: Target\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Target\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/knowledge-graph.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: graph\n  title: Knowledge Graph\n  source:\n    kind: workspace\n    include:\n      - \"notes/**/*.md\"\n---\n\n# Knowledge Graph\n\n<!-- forma-view -->\n",
        )
        .unwrap();

        let result = render_view(&root, "knowledge-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph { nodes, edges }) = result.render else {
            panic!("expected graph render");
        };

        assert_eq!(nodes.len(), 2);
        assert!(nodes.iter().any(|node| node.id == "notes/source.md"));
        assert!(nodes.iter().any(|node| node.id == "notes/target.md"));
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].source, "notes/source.md");
        assert_eq!(edges[0].target, "notes/target.md");
        assert_eq!(edges[0].intent, ReferenceIntent::Link);
        assert_eq!(edges[0].reference_source, ReferenceSource::Body);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_explicit_workspace_source_and_normalized_query_targets() {
        let root = fixture_root("workspace-source-view-render");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        create_entry(
            &root,
            "notes",
            BTreeMap::from([("title".to_string(), Value::String("Background".to_string()))]),
        )
        .unwrap();
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
        fs::write(
            root.join(".forma/views/active-todos.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  title: Active Todos\n  source:\n    kind: workspace\n    include:\n      - \"**/*.md\"\n  query:\n    all:\n      - target: entry.space\n        op: equals\n        value: todos\n      - target: frontmatter.status\n        op: in\n        value: [todo, doing]\n  table:\n    columns:\n      - title\n---\n\n# Active Todos\n\n<!-- forma-view -->\n",
        )
        .unwrap();

        let result = render_view(&root, "active-todos", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Table { items, .. }) = result.render else {
            panic!("expected table render");
        };

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "todos/draft-brief.md");
        assert_eq!(items[0].fields["title"], "Draft brief");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_invalid_query_target_as_diagnostic() {
        let root = fixture_root("view-invalid-target");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  title: Notes\n  query:\n    all:\n      - target: metadata.status\n        op: equals\n        value: todo\n  table:\n    columns:\n      - title\n---\n\n# Notes\n\n<!-- forma-view -->\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.queryInvalid")
        );
        assert!(result.render.is_none());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_missing_view_mount_as_diagnostic() {
        let root = fixture_root("view-missing-mount");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Render Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  space: notes\n  title: Notes\n  table:\n    columns:\n      - title\n---\n\n# Notes\n",
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
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  space: notes\n  table: broken\n---\n\n# Notes\n\n<!-- forma-view -->\n",
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
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  space: missing\n  table:\n    columns:\n      - title\n---\n\n# Notes\n\n<!-- forma-view -->\n",
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
