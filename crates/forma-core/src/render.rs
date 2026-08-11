use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

use globset::{Glob, GlobSetBuilder};
use markdown::{Options, to_html_with_options};
use serde::{Deserialize, Serialize};
use serde_yml::Value;

use crate::config::{
    DisplayOptions, FormaWorkspace, WorkspaceConfig, config_source_paths, is_valid_display_color,
    load_workspace,
};
use crate::diagnostics::{Diagnostic, DiagnosticLocation, DiagnosticSummary, OperationStatus};
use crate::index::{
    Discovery, IndexEntry, IndexReference, IndexView, ReferenceIntent, ReferenceSource,
    discover_loaded_workspace,
};
use crate::markdown::{
    FormaHeading, FormaMarkdownDocument, FormaReferenceIntent, FormaReferenceSyntax,
    all_markdown_headings,
};
use crate::model::ResolvedWorkspaceModel;
use crate::operations::{
    OperationError, WorkspaceSummary, diagnostic_sort_key, diagnostics_for_workspace_path,
};
use crate::path::WorkspacePath;

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
    #[serde(default)]
    pub omit_leading_title: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRenderOutput {
    pub format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub markdown: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document: Option<ViewRenderDocument>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewRenderDocument {
    pub body_source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mounts: Vec<ViewContentMount>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewContentMount {
    pub kind: String,
    pub start_offset: usize,
    pub end_offset: usize,
    pub location: DiagnosticLocation,
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
        columns: Vec<ViewRenderColumn>,
        items: Vec<ViewRenderItem>,
    },
    Kanban {
        card: KanbanRenderCard,
        columns: Vec<KanbanRenderColumn>,
    },
    Graph {
        nodes: Vec<GraphRenderNode>,
        edges: Vec<GraphRenderEdge>,
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        legend: Vec<GraphRenderLegendItem>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanbanRenderCard {
    pub title_field: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub subtitle_fields: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub badge_fields: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewRenderItem {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default)]
    pub fields: BTreeMap<String, ViewRenderFieldValue>,
}

/// A rendered field preserves whether its value is an entry reference rather
/// than flattening every frontmatter value into an untyped YAML value.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ViewRenderFieldValue {
    Value {
        value: Value,
    },
    Reference {
        reference: ViewRenderReference,
    },
    ReferenceList {
        references: Vec<ViewRenderReference>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewRenderReference {
    pub path: String,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewRenderColumn {
    pub field: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<TableColumnLink>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_width: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_width: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overflow: Option<TableColumnOverflow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableColumnLink {
    pub target: TableColumnLinkTarget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TableColumnLinkTarget {
    Entry,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TableColumnOverflow {
    Wrap,
    Truncate,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub classification: Option<GraphRenderNodeClassification>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRenderNodeClassification {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub taxonomy: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub terms: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRenderLegendItem {
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub taxonomy: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub terms: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphRenderEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_path: String,
    pub target_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_kind: Option<crate::index::ReferenceFragmentKind>,
    pub intent: ReferenceIntent,
    pub reference_source: ReferenceSource,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewDefinition {
    #[serde(default = "default_view_surface")]
    surface: String,
    mode: String,
    space: Option<String>,
    source: Option<ViewSource>,
    query: Option<QueryDefinition>,
    table: Option<TableDefinition>,
    kanban: Option<KanbanDefinition>,
    graph: Option<GraphDefinition>,
    #[serde(default)]
    sort: Vec<SortDefinition>,
}

fn default_view_surface() -> String {
    "page".to_string()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewSource {
    #[serde(rename = "type")]
    pub source_type: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub include: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub exclude: Vec<String>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub taxonomy: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TableDefinition {
    #[serde(default)]
    columns: Vec<TableColumnDefinition>,
    #[serde(default)]
    defaults: TableDefaultsDefinition,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TableDefaultsDefinition {
    #[serde(default)]
    column: TableColumnPresentationDefinition,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TableColumnPresentationDefinition {
    #[serde(default)]
    width: Option<Value>,
    #[serde(default)]
    min_width: Option<Value>,
    #[serde(default)]
    max_width: Option<Value>,
    #[serde(default)]
    overflow: Option<Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum TableColumnDefinition {
    Field(String),
    Object {
        field: String,
        label: String,
        #[serde(default)]
        link: Option<TableColumnLink>,
        #[serde(flatten)]
        presentation: Box<TableColumnPresentationDefinition>,
    },
}

impl TableColumnDefinition {
    fn field(&self) -> &str {
        match self {
            Self::Field(field) => field,
            Self::Object { field, .. } => field,
        }
    }

    fn presentation(&self) -> TableColumnPresentationDefinition {
        match self {
            Self::Field(_) => TableColumnPresentationDefinition::default(),
            Self::Object { presentation, .. } => (**presentation).clone(),
        }
    }

    fn link(&self) -> Option<TableColumnLink> {
        match self {
            Self::Field(_) => None,
            Self::Object { link, .. } => link.clone(),
        }
    }

    fn into_render_column(self, defaults: &TableColumnPresentationDefinition) -> ViewRenderColumn {
        let presentation = normalized_table_column_presentation(&self.presentation())
            .with_fallback(normalized_table_column_presentation(defaults))
            .without_inverted_bounds();
        let link = self.link();
        match self {
            Self::Field(field) => ViewRenderColumn {
                label: field.clone(),
                field,
                link,
                width: presentation.width,
                min_width: presentation.min_width,
                max_width: presentation.max_width,
                overflow: presentation.overflow,
            },
            Self::Object { field, label, .. } => ViewRenderColumn {
                field,
                label,
                link,
                width: presentation.width,
                min_width: presentation.min_width,
                max_width: presentation.max_width,
                overflow: presentation.overflow,
            },
        }
    }
}

#[derive(Debug, Clone, Default)]
struct NormalizedTableColumnPresentation {
    width: Option<String>,
    min_width: Option<String>,
    max_width: Option<String>,
    overflow: Option<TableColumnOverflow>,
}

impl NormalizedTableColumnPresentation {
    fn with_fallback(self, fallback: Self) -> Self {
        Self {
            width: self.width.or(fallback.width),
            min_width: self.min_width.or(fallback.min_width),
            max_width: self.max_width.or(fallback.max_width),
            overflow: self.overflow.or(fallback.overflow),
        }
    }

    fn without_inverted_bounds(mut self) -> Self {
        if comparable_table_column_dimensions(self.min_width.as_ref(), self.max_width.as_ref())
            .is_some_and(|(minimum, maximum)| minimum > maximum)
        {
            self.min_width = None;
            self.max_width = None;
        }
        self
    }
}

fn normalized_table_column_presentation(
    presentation: &TableColumnPresentationDefinition,
) -> NormalizedTableColumnPresentation {
    NormalizedTableColumnPresentation {
        width: normalized_table_column_dimension(presentation.width.as_ref()),
        min_width: normalized_table_column_dimension(presentation.min_width.as_ref()),
        max_width: normalized_table_column_dimension(presentation.max_width.as_ref()),
        overflow: normalized_table_column_overflow(presentation.overflow.as_ref()),
    }
    .without_inverted_bounds()
}

fn normalized_table_column_dimension(value: Option<&Value>) -> Option<String> {
    const MAX_TABLE_COLUMN_DIMENSION: f64 = 4096.0;
    match value? {
        Value::Number(number) => {
            let number = number.as_f64()?;
            (number > 0.0 && number <= MAX_TABLE_COLUMN_DIMENSION && number.is_finite())
                .then(|| format!("{number}px"))
        }
        Value::String(value) => {
            let (number, unit) = ["rem", "px", "em"]
                .iter()
                .find_map(|unit| value.strip_suffix(unit).map(|number| (number, *unit)))?;
            let mut decimal_points = 0;
            if number.is_empty()
                || !number
                    .chars()
                    .next()
                    .is_some_and(|character| character.is_ascii_digit())
                || !number
                    .chars()
                    .last()
                    .is_some_and(|character| character.is_ascii_digit())
                || !number.chars().all(|character| {
                    if character == '.' {
                        decimal_points += 1;
                        decimal_points == 1
                    } else {
                        character.is_ascii_digit()
                    }
                })
            {
                return None;
            }
            let number = number.parse::<f64>().ok()?;
            (number > 0.0 && number <= MAX_TABLE_COLUMN_DIMENSION && number.is_finite())
                .then(|| format!("{number}{unit}"))
        }
        _ => None,
    }
}

fn comparable_table_column_dimensions(
    minimum: Option<&String>,
    maximum: Option<&String>,
) -> Option<(f64, f64)> {
    let minimum = minimum?;
    let maximum = maximum?;
    let unit = ["rem", "px", "em"]
        .iter()
        .find(|unit| minimum.ends_with(**unit) && maximum.ends_with(**unit))?;
    Some((
        minimum.strip_suffix(unit)?.parse().ok()?,
        maximum.strip_suffix(unit)?.parse().ok()?,
    ))
}

fn normalized_table_column_overflow(value: Option<&Value>) -> Option<TableColumnOverflow> {
    match value?.as_str()? {
        "wrap" => Some(TableColumnOverflow::Wrap),
        "truncate" => Some(TableColumnOverflow::Truncate),
        _ => None,
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SortDefinition {
    field: String,
    #[serde(default)]
    direction: SortDirection,
    #[serde(default)]
    order: Vec<String>,
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
    card: KanbanCardDefinition,
    #[serde(default)]
    columns: Vec<KanbanColumnDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KanbanCardDefinition {
    #[serde(default = "default_kanban_title_field")]
    title_field: String,
    #[serde(default)]
    subtitle_fields: Vec<String>,
    #[serde(default)]
    badge_fields: Vec<String>,
}

impl Default for KanbanCardDefinition {
    fn default() -> Self {
        Self {
            title_field: default_kanban_title_field(),
            subtitle_fields: Vec::new(),
            badge_fields: Vec::new(),
        }
    }
}

impl KanbanCardDefinition {
    fn into_render_card(self) -> KanbanRenderCard {
        KanbanRenderCard {
            title_field: self.title_field,
            subtitle_fields: self.subtitle_fields,
            badge_fields: self.badge_fields,
        }
    }
}

fn default_kanban_title_field() -> String {
    "fields.title".to_string()
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphDefinition {
    presentation: Option<GraphPresentationDefinition>,
    #[serde(default)]
    edges: Vec<GraphEdgeDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphPresentationDefinition {
    nodes: GraphNodePresentationDefinition,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphNodePresentationDefinition {
    color_by: Option<GraphNodeColorByDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphNodeColorByDefinition {
    taxonomy: Option<String>,
    field: Option<String>,
}

#[derive(Debug, Clone, Copy)]
enum GraphNodeColorSource<'a> {
    Taxonomy(&'a str),
    Field(&'a str),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphEdgeDefinition {
    source: GraphEdgeSource,
    intent: Option<ReferenceIntent>,
    field: Option<String>,
    label: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
enum GraphEdgeSource {
    Body,
    Fields,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KanbanColumnDefinition {
    id: String,
    label: String,
    icon: Option<String>,
    query: Option<QueryDefinition>,
    #[serde(default)]
    sort: Vec<SortDefinition>,
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
    taxonomies: BTreeMap<String, Vec<String>>,
    kind: Option<String>,
    title: Option<String>,
    metadata: Value,
    references: Vec<IndexReference>,
}

pub fn render_file(
    root: impl AsRef<Path>,
    path: &str,
    format: &str,
) -> Result<FileRenderResult, OperationError> {
    if format == "source" {
        return render_source_file(root, path);
    }
    if format != "html" && format != "markdown" {
        return Err(OperationError::InvalidInput("format".to_string()));
    }

    let path = normalize_markdown_path(path)?;
    let workspace = load_workspace(root.as_ref())?;
    let discovery = discover_loaded_workspace(&workspace);
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
            logo: None,
        },
        file: RenderedFile {
            path,
            space: Some(index_entry.space.clone()),
            kind: index_entry.kind.clone(),
            title: index_entry.title.clone(),
            omit_leading_title: index_entry.omit_leading_title,
        },
        render: FileRenderOutput {
            format: format.to_string(),
            markdown: (format == "markdown").then(|| markdown_with_reference_fallbacks(&document)),
            html: (format == "html").then(|| render_markdown_html(&document)),
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
    let workspace = load_workspace(root.as_ref())?;
    let summary = DiagnosticSummary::default();

    Ok(FileRenderResult {
        schema_version: 1,
        operation: "file.render".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        file: RenderedFile {
            path,
            space: None,
            kind: None,
            title: None,
            omit_leading_title: false,
        },
        render: FileRenderOutput {
            format: "source".to_string(),
            markdown: None,
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
    let workspace = load_workspace(root.as_ref())?;
    let discovery = discover_loaded_workspace(&workspace);
    render_view_from_loaded(&workspace, &discovery, view, params, true)
}

pub(crate) fn render_indexed_view_from_loaded(
    workspace: &FormaWorkspace,
    discovery: &Discovery,
    view: &str,
    params: BTreeMap<String, Value>,
) -> Result<ViewRenderResult, OperationError> {
    render_view_from_loaded(workspace, discovery, view, params, false)
}

fn render_view_from_loaded(
    workspace: &FormaWorkspace,
    discovery: &Discovery,
    view: &str,
    params: BTreeMap<String, Value>,
    allow_unindexed: bool,
) -> Result<ViewRenderResult, OperationError> {
    let root = &workspace.root;
    let index_view = discovery.index.views.iter().find(|candidate| {
        candidate.id == view
            || candidate.path == view
            || candidate.path.strip_suffix(".md") == Some(view)
            || candidate.path.strip_suffix(".mdx") == Some(view)
    });
    let view_path = if let Some(index_view) = index_view {
        index_view.path.clone()
    } else if allow_unindexed {
        included_view_config_path(root, view)?
    } else {
        return Err(OperationError::ViewNotFound(view.to_string()));
    };

    let mut diagnostics = discovery.diagnostics.clone();
    let source =
        fs::read_to_string(root.join(&view_path)).map_err(|source| OperationError::Io {
            path: view_path.clone(),
            source,
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
    let body_line_offset = source
        .get(..source.len().saturating_sub(document.body.len()))
        .map_or(0, |prefix| {
            prefix.bytes().filter(|byte| *byte == b'\n').count()
        });
    let view_document = view_render_document(&document.body, body_line_offset);
    let has_legacy_mount = document.references.iter().any(|reference| {
        reference.intent == FormaReferenceIntent::View && reference.target.is_empty()
    });
    if view_document.mounts.is_empty() && has_legacy_mount {
        diagnostics.push(
            Diagnostic::error(
                "view.mountMissing",
                "Replace legacy `<!-- forma-view -->` with `<!-- forma:content -->`.",
            )
            .with_path(view_path.clone()),
        );
    }
    if view_document.mounts.len() > 1 {
        diagnostics.push(
            Diagnostic::error(
                "view.mountMultiple",
                "View must contain only one `<!-- forma:content -->` marker.",
            )
            .with_path(view_path.clone())
            .with_location(view_document.mounts[1].location.clone()),
        );
    }

    let definition_is_valid = view_definition.as_ref().is_some_and(|definition| {
        view_definition_is_valid(
            definition,
            &workspace.config,
            &workspace.model,
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
            render_view_definition(
                root,
                definition,
                &workspace.config,
                &discovery.index.entries,
                &view_path,
                &mut diagnostics,
            )
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
            name: workspace.config.workspace.name.clone(),
            logo: None,
        },
        view: view_definition
            .as_ref()
            .map(|definition| rendered_view(index_view, view, &view_path, definition, params)),
        render,
        document: Some(view_document),
        summary,
        diagnostics,
    })
}

fn view_render_document(body_source: &str, body_line_offset: usize) -> ViewRenderDocument {
    const MARKER: &str = "<!-- forma:content -->";
    let mounts = body_source
        .match_indices(MARKER)
        .map(|(start_byte, marker)| {
            let prefix = &body_source[..start_byte];
            let start_offset = prefix.encode_utf16().count();
            let line = body_line_offset + prefix.bytes().filter(|byte| *byte == b'\n').count() + 1;
            let column = prefix
                .rsplit_once('\n')
                .map_or(prefix.encode_utf16().count() + 1, |(_, tail)| {
                    tail.encode_utf16().count() + 1
                });
            ViewContentMount {
                kind: "content".to_string(),
                start_offset,
                end_offset: start_offset + marker.encode_utf16().count(),
                location: DiagnosticLocation::Body {
                    line: Some(line),
                    column: Some(column),
                },
            }
        })
        .collect();
    ViewRenderDocument {
        body_source: body_source.to_string(),
        mounts,
    }
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
    let Ok(view) = serde_yml::from_value::<ViewDefinition>(value) else {
        diagnostics
            .push(Diagnostic::error("view.invalid", "View definition is invalid.").with_path(path));
        return None;
    };
    Some(view)
}

fn view_definition_is_valid(
    definition: &ViewDefinition,
    config: &WorkspaceConfig,
    model: &ResolvedWorkspaceModel,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> bool {
    let mut valid = true;
    if definition.surface != "page" {
        valid = false;
    }
    if let Some(space) = &definition.space
        && model.content_group(space).is_none()
    {
        valid = false;
    }
    if let Some(source) = &definition.source
        && source.source_type != "pages"
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
    if let Some(color_by) = definition
        .graph
        .as_ref()
        .and_then(|graph| graph.presentation.as_ref())
        .and_then(|presentation| presentation.nodes.color_by.as_ref())
    {
        match (&color_by.taxonomy, &color_by.field) {
            (Some(taxonomy), None) if !config.taxonomies.contains_key(taxonomy) => {
                diagnostics.push(
                    Diagnostic::error(
                        "view.graphTaxonomyMissing",
                        "Graph node color taxonomy is not configured.",
                    )
                    .with_path(path)
                    .with_location(DiagnosticLocation::Frontmatter {
                        field: "graph.presentation.nodes.colorBy.taxonomy".to_string(),
                        index: None,
                    })
                    .with_actual(taxonomy.to_string())
                    .with_expected("configured taxonomy id".to_string()),
                );
                valid = false;
            }
            (Some(_), None) => {}
            (None, Some(field)) if is_supported_graph_color_field(field) => {}
            _ => {
                diagnostics.push(
                    Diagnostic::error(
                        "view.graphColorByInvalid",
                        "Graph node color source must define exactly one taxonomy or frontmatter field.",
                    )
                    .with_path(path)
                    .with_location(DiagnosticLocation::Frontmatter {
                        field: "graph.presentation.nodes.colorBy".to_string(),
                        index: None,
                    })
                    .with_expected(
                        "exactly one of taxonomy or a non-empty fields.<path> field".to_string(),
                    ),
                );
                valid = false;
            }
        }
    }
    valid
}

fn is_supported_graph_color_field(field: &str) -> bool {
    normalized_field_path(field)
        .is_some_and(|path| !path.is_empty() && path.split('.').all(|segment| !segment.is_empty()))
}

fn validate_table_column_presentation(
    table: &TableDefinition,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    validate_table_column_presentation_layer(
        &table.defaults.column,
        "table.defaults.column",
        None,
        path,
        diagnostics,
    );
    let defaults = normalized_table_column_presentation(&table.defaults.column);
    for (index, column) in table.columns.iter().enumerate() {
        let presentation = column.presentation();
        validate_table_column_presentation_layer(
            &presentation,
            "table.columns",
            Some(index),
            path,
            diagnostics,
        );
        let effective =
            normalized_table_column_presentation(&presentation).with_fallback(defaults.clone());
        if comparable_table_column_dimensions(
            effective.min_width.as_ref(),
            effective.max_width.as_ref(),
        )
        .is_some_and(|(minimum, maximum)| minimum > maximum)
        {
            diagnostics.push(
                Diagnostic::warning(
                    "view.tableColumnPresentationInvalid",
                    "Effective Table column `minWidth` and `maxWidth` are ignored because minWidth exceeds maxWidth.",
                )
                .with_path(path)
                .with_location(DiagnosticLocation::Frontmatter {
                    field: "table.columns".to_string(),
                    index: Some(index),
                })
                .with_expected("effective minWidth less than or equal to maxWidth"),
            );
        }
    }
}

fn validate_table_column_presentation_layer(
    presentation: &TableColumnPresentationDefinition,
    field_prefix: &str,
    index: Option<usize>,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let scope = if index.is_some() {
        "Table column"
    } else {
        "Table column default"
    };
    let TableColumnPresentationDefinition {
        width,
        min_width,
        max_width,
        overflow,
    } = presentation;
    for (field, value) in [
        ("width", width),
        ("minWidth", min_width),
        ("maxWidth", max_width),
    ] {
        if value.is_some() && normalized_table_column_dimension(value.as_ref()).is_none() {
            diagnostics.push(
                    Diagnostic::warning(
                        "view.tableColumnPresentationInvalid",
                        format!(
                            "{scope} `{field}` is ignored because it is not a supported positive CSS length."
                        ),
                    )
                    .with_path(path)
                    .with_location(DiagnosticLocation::Frontmatter {
                        field: format!("{field_prefix}.{field}"),
                        index,
                    })
                    .with_actual(
                        value
                            .as_ref()
                            .map(|value| format!("{value:?}"))
                            .unwrap_or_default(),
                    )
                    .with_expected(
                        "positive number (pixels) or positive px, rem, or em length up to 4096",
                    ),
                );
        }
    }
    if overflow.is_some() && normalized_table_column_overflow(overflow.as_ref()).is_none() {
        diagnostics.push(
            Diagnostic::warning(
                "view.tableColumnPresentationInvalid",
                format!("{scope} `overflow` is ignored because it is not supported."),
            )
            .with_path(path)
            .with_location(DiagnosticLocation::Frontmatter {
                field: format!("{field_prefix}.overflow"),
                index,
            })
            .with_actual(
                overflow
                    .as_ref()
                    .map(|value| format!("{value:?}"))
                    .unwrap_or_default(),
            )
            .with_expected("wrap or truncate"),
        );
    }
    let normalized_minimum = normalized_table_column_dimension(min_width.as_ref());
    let normalized_maximum = normalized_table_column_dimension(max_width.as_ref());
    if comparable_table_column_dimensions(normalized_minimum.as_ref(), normalized_maximum.as_ref())
        .is_some_and(|(minimum, maximum)| minimum > maximum)
    {
        diagnostics.push(
                Diagnostic::warning(
                    "view.tableColumnPresentationInvalid",
                    format!("{scope} `minWidth` and `maxWidth` are ignored because minWidth exceeds maxWidth."),
                )
                .with_path(path)
                .with_location(DiagnosticLocation::Frontmatter {
                    field: field_prefix.to_string(),
                    index,
                })
                .with_expected("minWidth less than or equal to maxWidth"),
            );
    }
}

pub(crate) fn validate_table_column_presentation_value(
    value: &Value,
    path: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(table) = value
        .as_mapping()
        .and_then(|mapping| mapping.get(Value::String("table".to_string())))
        .cloned()
    else {
        return;
    };
    if let Ok(table) = serde_yml::from_value::<TableDefinition>(table) {
        validate_table_column_presentation(&table, path, diagnostics);
    }
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
    if let Some(target) = query_node_target(node)
        && !is_supported_target(target)
    {
        diagnostics.push(
            Diagnostic::error("view.queryInvalid", "View query target is invalid.")
                .with_path(path)
                .with_actual(target.to_string()),
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
    ) || target.starts_with("fields.")
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
        source_type: "pages".to_string(),
        include: Vec::new(),
        exclude: Vec::new(),
        taxonomy: BTreeMap::new(),
    }
}

fn render_view_definition(
    root: &Path,
    definition: &ViewDefinition,
    config: &WorkspaceConfig,
    entries: &[IndexEntry],
    view_path: &str,
    diagnostics: &mut Vec<Diagnostic>,
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
            let table = definition.table.clone().unwrap_or(TableDefinition {
                columns: Vec::new(),
                defaults: TableDefaultsDefinition::default(),
            });
            let columns = table.columns;
            let render_columns = columns
                .iter()
                .cloned()
                .map(|column| column.into_render_column(&table.defaults.column))
                .collect();
            Some(ViewRenderOutput::Table {
                columns: render_columns,
                items: items
                    .into_iter()
                    .map(|item| item.into_view_item(&columns))
                    .collect(),
            })
        }
        "kanban" => {
            let kanban = definition.kanban.as_ref()?;
            Some(ViewRenderOutput::Kanban {
                card: kanban.card.clone().into_render_card(),
                columns: kanban
                    .columns
                    .iter()
                    .map(|column| KanbanRenderColumn {
                        id: column.id.clone(),
                        label: column.label.clone(),
                        icon: column.icon.clone(),
                        items: sorted_column_items(&items, column)
                            .into_iter()
                            .filter(|item| column_matches(item, column))
                            .map(RenderCandidate::into_all_fields_view_item)
                            .collect(),
                    })
                    .collect(),
            })
        }
        "graph" => {
            let render = render_graph_view(&items, entries, definition.graph.as_ref(), config);
            if matches!(
                graph_node_color_source(definition.graph.as_ref()),
                Some(GraphNodeColorSource::Field(_))
            ) && let ViewRenderOutput::Graph { legend, .. } = &render
            {
                let classified_values = legend.iter().filter(|item| item.color.is_some()).count();
                if classified_values > GRAPH_COLOR_CARDINALITY_WARNING_THRESHOLD {
                    diagnostics.push(
                        Diagnostic::warning(
                            "view.graphColorCardinalityHigh",
                            "Graph node color field has many distinct values and may create a noisy legend.",
                        )
                        .with_path(view_path)
                        .with_location(DiagnosticLocation::Frontmatter {
                            field: "graph.presentation.nodes.colorBy.field".to_string(),
                            index: None,
                        })
                        .with_actual(classified_values.to_string())
                        .with_expected(format!(
                            "at most {GRAPH_COLOR_CARDINALITY_WARNING_THRESHOLD} distinct scalar values"
                        )),
                    );
                }
            }
            Some(render)
        }
        _ => None,
    }
}

fn render_graph_view(
    items: &[RenderCandidate],
    entries: &[IndexEntry],
    graph: Option<&GraphDefinition>,
    config: &WorkspaceConfig,
) -> ViewRenderOutput {
    let included_paths = items
        .iter()
        .map(|item| item.path.as_str())
        .collect::<BTreeSet<_>>();
    let entry_by_path = entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect::<BTreeMap<_, _>>();

    let color_source = graph_node_color_source(graph);
    let nodes = items
        .iter()
        .map(|item| GraphRenderNode {
            id: item.path.clone(),
            path: item.path.clone(),
            title: item.title.clone(),
            space: item.space.clone(),
            kind: item.kind.clone(),
            classification: color_source.map(|source| match source {
                GraphNodeColorSource::Taxonomy(taxonomy) => {
                    graph_taxonomy_classification(item, config, taxonomy)
                }
                GraphNodeColorSource::Field(field) => graph_field_classification(item, field),
            }),
        })
        .collect::<Vec<_>>();
    let legend = match color_source {
        Some(GraphNodeColorSource::Taxonomy(taxonomy)) => {
            graph_taxonomy_legend(&nodes, config, taxonomy)
        }
        Some(GraphNodeColorSource::Field(field)) => graph_field_legend(items, field),
        None => Vec::new(),
    };

    let default_rules;
    let rules = if let Some(graph) = graph.filter(|graph| !graph.edges.is_empty()) {
        graph.edges.as_slice()
    } else {
        default_rules = default_graph_edges();
        default_rules.as_slice()
    };
    let mut seen_edges = BTreeSet::<String>::new();
    let mut edges = Vec::new();
    for item in items {
        let Some(entry) = entry_by_path.get(item.path.as_str()) else {
            continue;
        };

        for reference in &entry.refs {
            if !included_paths.contains(reference.target_path.as_str()) {
                continue;
            }

            for rule in rules {
                if !graph_edge_rule_matches(rule, reference) {
                    continue;
                }

                let label = graph_edge_label(rule, reference);
                let key = format!(
                    "{}->{}:{:?}:{:?}:{}:{}",
                    entry.path,
                    reference.target_path,
                    reference.intent,
                    reference.source,
                    reference.field.as_deref().unwrap_or_default(),
                    label
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
                    fragment: reference.fragment.clone(),
                    fragment_kind: reference.fragment_kind,
                    intent: reference.intent,
                    reference_source: reference.source,
                    label,
                    field: reference.field.clone(),
                    semantic_type: reference.semantic_type.clone(),
                });
            }
        }
    }

    ViewRenderOutput::Graph {
        nodes,
        edges,
        legend,
    }
}

fn graph_node_color_source(graph: Option<&GraphDefinition>) -> Option<GraphNodeColorSource<'_>> {
    let color_by = graph?.presentation.as_ref()?.nodes.color_by.as_ref()?;
    match (&color_by.taxonomy, &color_by.field) {
        (Some(taxonomy), None) => Some(GraphNodeColorSource::Taxonomy(taxonomy)),
        (None, Some(field)) => Some(GraphNodeColorSource::Field(field)),
        _ => None,
    }
}

fn graph_taxonomy_classification(
    item: &RenderCandidate,
    config: &WorkspaceConfig,
    taxonomy: &str,
) -> GraphRenderNodeClassification {
    let terms = item.taxonomies.get(taxonomy).cloned().unwrap_or_default();
    let (key, label) = match terms.as_slice() {
        [] => (
            format!("{taxonomy}:unclassified"),
            "Unclassified".to_string(),
        ),
        [term] => (
            format!("{taxonomy}:term:{term}"),
            config
                .terms
                .get(taxonomy)
                .and_then(|definitions| definitions.get(term))
                .map(|definition| definition.title.clone())
                .unwrap_or_else(|| term.clone()),
        ),
        _ => {
            let labels = terms
                .iter()
                .map(|term| {
                    config
                        .terms
                        .get(taxonomy)
                        .and_then(|definitions| definitions.get(term))
                        .map(|definition| definition.title.clone())
                        .unwrap_or_else(|| term.clone())
                })
                .collect::<Vec<_>>();
            (format!("{taxonomy}:multiple"), labels.join(", "))
        }
    };
    GraphRenderNodeClassification {
        key,
        taxonomy: Some(taxonomy.to_string()),
        terms,
        field: None,
        label,
    }
}

fn graph_taxonomy_legend(
    nodes: &[GraphRenderNode],
    config: &WorkspaceConfig,
    taxonomy: &str,
) -> Vec<GraphRenderLegendItem> {
    let used_keys = nodes
        .iter()
        .filter_map(|node| {
            node.classification
                .as_ref()
                .map(|classification| classification.key.as_str())
        })
        .collect::<BTreeSet<_>>();
    let taxonomy_color = taxonomy_display(config, taxonomy).color;
    let mut terms = config
        .terms
        .get(taxonomy)
        .into_iter()
        .flat_map(|terms| terms.iter())
        .filter_map(|(term_id, term)| {
            let key = format!("{taxonomy}:term:{term_id}");
            used_keys.contains(key.as_str()).then(|| {
                (
                    term.display.order,
                    term.title.clone(),
                    term_id.clone(),
                    GraphRenderLegendItem {
                        key,
                        taxonomy: Some(taxonomy.to_string()),
                        terms: vec![term_id.clone()],
                        field: None,
                        label: term.title.clone(),
                        color: term
                            .display
                            .color
                            .clone()
                            .or_else(|| taxonomy_color.clone()),
                    },
                )
            })
        })
        .collect::<Vec<_>>();
    terms.sort_by(|left, right| {
        (left.0.is_none(), left.0.unwrap_or(0), &left.1, &left.2).cmp(&(
            right.0.is_none(),
            right.0.unwrap_or(0),
            &right.1,
            &right.2,
        ))
    });
    let mut legend = terms
        .into_iter()
        .map(|(_, _, _, item)| item)
        .collect::<Vec<_>>();
    let multiple_key = format!("{taxonomy}:multiple");
    if used_keys.contains(multiple_key.as_str()) {
        legend.push(GraphRenderLegendItem {
            key: multiple_key,
            taxonomy: Some(taxonomy.to_string()),
            terms: Vec::new(),
            field: None,
            label: "Multiple terms".to_string(),
            color: None,
        });
    }
    let unclassified_key = format!("{taxonomy}:unclassified");
    if used_keys.contains(unclassified_key.as_str()) {
        legend.push(GraphRenderLegendItem {
            key: unclassified_key,
            taxonomy: Some(taxonomy.to_string()),
            terms: Vec::new(),
            field: None,
            label: "Unclassified".to_string(),
            color: None,
        });
    }
    legend
}

fn graph_field_classification(
    item: &RenderCandidate,
    field: &str,
) -> GraphRenderNodeClassification {
    graph_field_classification_and_color(item, field).0
}

fn graph_field_classification_and_color(
    item: &RenderCandidate,
    field: &str,
) -> (GraphRenderNodeClassification, Option<String>) {
    let Some(value) = value_for_target(item, field)
        .as_ref()
        .and_then(graph_field_scalar)
    else {
        return (
            GraphRenderNodeClassification {
                key: format!("field:{field}:unclassified"),
                taxonomy: None,
                terms: Vec::new(),
                field: Some(field.to_string()),
                label: "Unclassified".to_string(),
            },
            None,
        );
    };
    let hash = stable_graph_color_hash(value.identity.as_bytes());
    let color = value.explicit_color.unwrap_or_else(|| {
        GENERATED_GRAPH_COLORS[hash as usize % GENERATED_GRAPH_COLORS.len()].to_string()
    });
    (
        GraphRenderNodeClassification {
            key: format!("field:{field}:value:{hash:016x}"),
            taxonomy: None,
            terms: Vec::new(),
            field: Some(field.to_string()),
            label: value.label,
        },
        Some(color),
    )
}

struct GraphFieldScalar {
    identity: String,
    label: String,
    explicit_color: Option<String>,
}

fn graph_field_scalar(value: &Value) -> Option<GraphFieldScalar> {
    let (identity, label, explicit_color) = match value {
        Value::String(value) => {
            let label = value.trim();
            if label.is_empty() {
                return None;
            }
            if is_valid_display_color(label) {
                let color = label.to_ascii_uppercase();
                (format!("string:{color}"), color.clone(), Some(color))
            } else {
                (format!("string:{label}"), label.to_string(), None)
            }
        }
        Value::Number(value) => {
            let label = value.to_string();
            (format!("number:{label}"), label, None)
        }
        Value::Bool(value) => {
            let label = value.to_string();
            (format!("boolean:{label}"), label, None)
        }
        _ => return None,
    };
    Some(GraphFieldScalar {
        identity,
        label,
        explicit_color,
    })
}

fn graph_field_legend(items: &[RenderCandidate], field: &str) -> Vec<GraphRenderLegendItem> {
    let mut items_by_key = BTreeMap::new();
    for item in items {
        let (classification, color) = graph_field_classification_and_color(item, field);
        items_by_key
            .entry(classification.key.clone())
            .or_insert_with(|| GraphRenderLegendItem {
                key: classification.key,
                taxonomy: None,
                terms: Vec::new(),
                field: classification.field,
                label: classification.label,
                color,
            });
    }
    let mut legend = items_by_key.into_values().collect::<Vec<_>>();
    legend.sort_by(|left, right| {
        (left.label.to_lowercase(), &left.label, &left.key).cmp(&(
            right.label.to_lowercase(),
            &right.label,
            &right.key,
        ))
    });
    legend
}

fn stable_graph_color_hash(value: &[u8]) -> u64 {
    const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    value.iter().fold(FNV_OFFSET_BASIS, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(FNV_PRIME)
    })
}

const GENERATED_GRAPH_COLORS: [&str; 16] = [
    "#2563EB", "#7C3AED", "#DB2777", "#16A34A", "#D97706", "#0891B2", "#0F766E", "#9333EA",
    "#475569", "#EA580C", "#4F46E5", "#DC2626", "#65A30D", "#C026D3", "#0284C7", "#A16207",
];

const GRAPH_COLOR_CARDINALITY_WARNING_THRESHOLD: usize = 24;

fn taxonomy_display(config: &WorkspaceConfig, taxonomy: &str) -> DisplayOptions {
    config
        .taxonomies
        .get(taxonomy)
        .and_then(|value| value.get("display"))
        .cloned()
        .and_then(|value| serde_yml::from_value::<DisplayOptions>(value).ok())
        .unwrap_or_default()
        .sanitized()
}

fn default_graph_edges() -> Vec<GraphEdgeDefinition> {
    vec![
        GraphEdgeDefinition {
            source: GraphEdgeSource::Body,
            intent: Some(ReferenceIntent::Link),
            field: None,
            label: None,
        },
        GraphEdgeDefinition {
            source: GraphEdgeSource::Body,
            intent: Some(ReferenceIntent::Embed),
            field: None,
            label: None,
        },
    ]
}

fn graph_edge_rule_matches(rule: &GraphEdgeDefinition, reference: &IndexReference) -> bool {
    match rule.source {
        GraphEdgeSource::Body => {
            reference.source == ReferenceSource::Body
                && rule.intent.is_none_or(|intent| intent == reference.intent)
        }
        GraphEdgeSource::Fields => {
            reference.source == ReferenceSource::Frontmatter
                && rule
                    .field
                    .as_ref()
                    .is_some_and(|field| reference.field.as_ref() == Some(field))
                && rule.intent.is_none_or(|intent| intent == reference.intent)
        }
    }
}

fn graph_edge_label(rule: &GraphEdgeDefinition, reference: &IndexReference) -> String {
    if let Some(label) = rule.label.as_ref().filter(|label| !label.trim().is_empty()) {
        return label.clone();
    }

    match rule.source {
        GraphEdgeSource::Body => match reference.intent {
            ReferenceIntent::Link => "links to".to_string(),
            ReferenceIntent::Embed => "embeds".to_string(),
            ReferenceIntent::Reference => "references".to_string(),
        },
        GraphEdgeSource::Fields => rule
            .field
            .as_deref()
            .or(reference.field.as_deref())
            .map(field_label)
            .unwrap_or_else(|| "references".to_string()),
    }
}

fn field_label(field: &str) -> String {
    field
        .split('.')
        .next_back()
        .unwrap_or(field)
        .chars()
        .enumerate()
        .fold(String::new(), |mut label, (index, character)| {
            if index > 0 && character.is_uppercase() {
                label.push(' ');
            }
            if index == 0 {
                label.extend(character.to_uppercase());
            } else {
                label.push(character);
            }
            label
        })
}

impl RenderCandidate {
    fn from_index_entry(root: &Path, entry: &IndexEntry) -> Option<Self> {
        let metadata = read_entry_metadata(root, &entry.path)?;
        Some(Self {
            path: entry.path.clone(),
            space: entry.space.clone(),
            taxonomies: entry.taxonomies.clone(),
            kind: entry.kind.clone(),
            title: entry.title.clone(),
            metadata,
            references: entry.refs.clone(),
        })
    }

    fn into_view_item(self, columns: &[TableColumnDefinition]) -> ViewRenderItem {
        let fields = columns
            .iter()
            .filter_map(|column| {
                let field = column.field();
                value_for_target(&self, field)
                    .map(|value| (field.to_string(), self.render_field_value(field, value)))
            })
            .collect();
        ViewRenderItem {
            path: self.path,
            title: self.title,
            fields,
        }
    }

    fn into_all_fields_view_item(self) -> ViewRenderItem {
        let fields = match &self.metadata {
            Value::Mapping(mapping) => mapping
                .iter()
                .filter_map(|(key, value)| {
                    key.as_str().map(|key| {
                        (
                            key.to_string(),
                            self.render_field_value(&format!("fields.{key}"), value.clone()),
                        )
                    })
                })
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

impl RenderCandidate {
    fn render_field_value(&self, target: &str, value: Value) -> ViewRenderFieldValue {
        let Some(field) = normalized_field_path(target) else {
            return ViewRenderFieldValue::Value { value };
        };
        let references = self
            .references
            .iter()
            .filter(|reference| {
                reference.source == ReferenceSource::Frontmatter
                    && reference.intent == ReferenceIntent::Reference
                    && reference.field.as_deref() == Some(field)
            })
            .map(|reference| ViewRenderReference {
                path: reference.target_path.clone(),
                title: reference
                    .resolved_title
                    .clone()
                    .or_else(|| reference.target_title.clone())
                    .unwrap_or_else(|| reference.target_path.clone()),
            })
            .collect::<Vec<_>>();

        if references.is_empty() {
            ViewRenderFieldValue::Value { value }
        } else if matches!(value, Value::Sequence(_)) {
            ViewRenderFieldValue::ReferenceList { references }
        } else {
            ViewRenderFieldValue::Reference {
                reference: references
                    .into_iter()
                    .next()
                    .expect("references is not empty"),
            }
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
            let ordering = if sort.order.is_empty() {
                let left_value = comparable_value(value_for_target(left, &sort.field).as_ref());
                let right_value = comparable_value(value_for_target(right, &sort.field).as_ref());
                left_value.cmp(&right_value)
            } else {
                ordered_value_rank(value_for_target(left, &sort.field).as_ref(), &sort.order).cmp(
                    &ordered_value_rank(value_for_target(right, &sort.field).as_ref(), &sort.order),
                )
            };
            if sort.direction == SortDirection::Desc {
                ordering.reverse()
            } else {
                ordering
            }
        });
    }
}

fn sorted_column_items(
    items: &[RenderCandidate],
    column: &KanbanColumnDefinition,
) -> Vec<RenderCandidate> {
    let mut items = items.to_vec();
    apply_sort(&mut items, &column.sort);
    items
}

fn ordered_value_rank(value: Option<&Value>, order: &[String]) -> usize {
    let Some(value) = value.and_then(Value::as_str) else {
        return order.len();
    };
    order
        .iter()
        .position(|candidate| candidate == value)
        .unwrap_or(order.len())
}

fn column_matches(item: &RenderCandidate, column: &KanbanColumnDefinition) -> bool {
    let Some(query) = column.query.as_ref() else {
        return true;
    };
    query_matches(item, query)
}

fn view_candidate_matches(item: &RenderCandidate, definition: &ViewDefinition) -> bool {
    if !source_matches(item, definition.source.as_ref()) {
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

fn source_matches(item: &RenderCandidate, source: Option<&ViewSource>) -> bool {
    let Some(source) = source else {
        return true;
    };
    if source.source_type != "pages" {
        return false;
    }
    let include_match = source.include.is_empty() || path_matches_any(&item.path, &source.include);
    let exclude_match = path_matches_any(&item.path, &source.exclude);
    include_match && !exclude_match && source_taxonomy_matches(item, source)
}

fn source_taxonomy_matches(item: &RenderCandidate, source: &ViewSource) -> bool {
    source.taxonomy.iter().all(|(taxonomy, terms)| {
        let memberships = item.taxonomies.get(taxonomy);
        terms.is_empty()
            || memberships
                .is_some_and(|memberships| terms.iter().any(|term| memberships.contains(term)))
    })
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
    node.field.as_deref()
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
    normalized_field_path(target).and_then(|field| value_at_path(&item.metadata, field).cloned())
}

fn normalized_field_path(target: &str) -> Option<&str> {
    target.strip_prefix("fields.")
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

pub(crate) fn render_markdown_html(document: &FormaMarkdownDocument) -> String {
    let markdown = markdown_with_reference_fallbacks(document);
    render_markdown_source_html(&markdown)
}

pub(crate) fn render_markdown_source_html(markdown: &str) -> String {
    to_html_with_options(markdown, &Options::gfm()).expect("normal Markdown renders to HTML")
}

pub(crate) fn render_headings(document: &FormaMarkdownDocument) -> Vec<RenderedHeading> {
    rendered_headings(&document.headings)
}

pub(crate) fn render_all_headings(document: &FormaMarkdownDocument) -> Vec<RenderedHeading> {
    rendered_headings(&all_markdown_headings(&document.body))
}

fn rendered_headings(headings: &[FormaHeading]) -> Vec<RenderedHeading> {
    let mut seen = BTreeMap::<String, usize>::new();
    headings
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

pub(crate) fn slugify_heading(text: &str) -> String {
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

pub(crate) fn markdown_with_reference_fallbacks(document: &FormaMarkdownDocument) -> String {
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

fn included_view_config_path(root: &Path, view: &str) -> Result<String, OperationError> {
    let view = view.strip_suffix(".md").unwrap_or(view);
    let view = view.strip_suffix(".mdx").unwrap_or(view);
    let sources = config_source_paths(root)?;
    let mut matches = Vec::new();
    for path in sources
        .into_iter()
        .map(|source| source.path)
        .filter(|path| path.ends_with(".md") || path.ends_with(".mdx"))
    {
        let path_id = path
            .strip_suffix(".md")
            .or_else(|| path.strip_suffix(".mdx"))
            .unwrap_or(&path);
        let stem = Path::new(&path)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or(path_id);
        if path_id != view && stem != view {
            continue;
        }
        let Ok(source) = fs::read_to_string(root.join(&path)) else {
            continue;
        };
        let document = FormaMarkdownDocument::parse(&source);
        if document
            .frontmatter
            .value
            .as_ref()
            .and_then(|value| value.get("kind"))
            .and_then(Value::as_str)
            == Some("view")
        {
            matches.push(path);
        }
    }
    match matches.as_slice() {
        [] => Err(OperationError::ViewNotFound(view.to_string())),
        [path] => Ok(path.clone()),
        _ => Err(OperationError::ViewAmbiguous(view.to_string())),
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
        GRAPH_COLOR_CARDINALITY_WARNING_THRESHOLD, ReferenceIntent, ReferenceSource,
        RenderedHeading, TableColumnLink, TableColumnLinkTarget, TableColumnOverflow,
        ViewRenderColumn, ViewRenderFieldValue, ViewRenderOutput,
        normalized_table_column_dimension, render_file, render_view, stable_graph_color_hash,
    };
    use crate::OperationStatus;
    use crate::index::discover_workspace;
    use crate::operations::{OperationError, create_entry};
    use crate::path::FORMA_CONFIG_PATH;

    fn copy_starter_workspace(root: &std::path::Path) {
        let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("examples/getting-started-workspace");
        copy_dir_recursive(&source, root);
        remove_guideline_references(root);
        clear_starter_content(root);
    }

    fn copy_dir_recursive(source: &std::path::Path, target: &std::path::Path) {
        fs::create_dir_all(target).unwrap();
        for entry in fs::read_dir(source).unwrap() {
            let entry = entry.unwrap();
            let source_path = entry.path();
            let target_path = target.join(entry.file_name());
            if source_path.is_dir() {
                copy_dir_recursive(&source_path, &target_path);
            } else {
                fs::copy(&source_path, &target_path).unwrap();
            }
        }
    }

    fn clear_starter_content(root: &std::path::Path) {
        for directory in ["notes", "tasks", "members", "guidelines"] {
            let path = root.join(directory);
            if path.exists() {
                fs::remove_dir_all(&path).unwrap();
            }
            fs::create_dir_all(path).unwrap();
        }
    }

    fn remove_guideline_references(root: &std::path::Path) {
        let config_path = root.join(".forma.md");
        let config = fs::read_to_string(&config_path).unwrap();
        fs::write(
            &config_path,
            config.replace(
                "\nguidelines:\n  - \"guidelines/workspace-operations.md\"\n  - \"guidelines/task-selection.md\"\n",
                "\n",
            ),
        )
        .unwrap();

        let tasks_path = root.join(".forma/spaces/tasks.md");
        let tasks = fs::read_to_string(&tasks_path).unwrap();
        fs::write(
            &tasks_path,
            tasks.replace(
                "guidelines:\n  - \"guidelines/workspace-operations.md\"\n",
                "",
            ),
        )
        .unwrap();
    }

    fn write_config(root: &std::path::Path, yaml: impl AsRef<str>) {
        fs::write(
            root.join(FORMA_CONFIG_PATH),
            format!("---\n{}---\n\n# Forma Workspace\n", yaml.as_ref()),
        )
        .unwrap();
    }

    #[test]
    fn renders_file_html_and_degrades_obsidian_embed_to_link() {
        let root = fixture_root("file-render");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Source\n\nOwner: [[members/alex-chen|Alex Chen]].\n",
        )
        .unwrap();
        fs::write(
            root.join("members/alex-chen.md"),
            "---\nkind: member\nname: Alex Chen\nrole: Developer\n---\n\n# Alex Chen\n",
        )
        .unwrap();

        let result = render_file(&root, "notes/source.md", "html").unwrap();

        let html = result.render.html.as_deref().unwrap_or_default();
        assert!(html.contains(r#"<a href="./members/alex-chen.md">Alex Chen</a>"#));
        assert!(!html.contains(r#"href="members/alex-chen""#));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_render_reports_unresolved_references_as_diagnostics() {
        let root = fixture_root("file-render-unresolved-ref");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
                .any(|diagnostic| diagnostic.code == "entryRef.unresolved")
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
        copy_starter_workspace(&root);
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
        copy_starter_workspace(&root);

        let result = render_file(&root, ".forma.md", "source").unwrap();

        assert_eq!(result.status, crate::OperationStatus::Passed);
        assert_eq!(result.file.path, ".forma.md");
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
    fn renders_file_markdown_for_client_reader() {
        let root = fixture_root("file-render-markdown");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Source\n\n## Context\n\nSee ![[notes/target|Target note]].\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/target.md"),
            "---\nkind: note\ntitle: Target\nsummary: \"\"\ncreatedAt: \"2026-05-19T00:00:00Z\"\n---\n\n# Target\n",
        )
        .unwrap();

        let result = render_file(&root, "notes/source.md", "markdown").unwrap();

        assert_eq!(result.operation, "file.render");
        assert_eq!(result.status, crate::OperationStatus::Passed);
        assert_eq!(result.render.format, "markdown");
        assert_eq!(result.render.html, None);
        let markdown = result.render.markdown.as_deref().unwrap_or_default();
        assert!(markdown.contains("# Source"));
        assert!(markdown.contains("[Target note](<./notes/target.md>)"));
        assert_eq!(
            result.render.headings,
            vec![RenderedHeading {
                id: "context".to_string(),
                level: 2,
                text: "Context".to_string(),
            }]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_render_html_accepts_knowledge_files_and_rejects_templates() {
        let root = fixture_root("file-render-html");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
            render_file(&root, ".forma/spaces/templates/note.md", "html"),
            Err(OperationError::EntryNotFound)
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_render_source_reads_text_resources() {
        let root = fixture_root("file-render-source-resource");
        fs::create_dir_all(root.join("assets")).unwrap();
        copy_starter_workspace(&root);
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
        copy_starter_workspace(&root);

        let empty = render_view(&root, "notes", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Table { columns, items }) = empty.render else {
            panic!("expected table render");
        };
        assert_eq!(
            columns
                .iter()
                .map(|column| column.field.as_str())
                .collect::<Vec<_>>(),
            vec!["fields.title", "fields.summary", "fields.createdAt"]
        );
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
        assert_eq!(
            items[0].fields["fields.title"],
            ViewRenderFieldValue::Value {
                value: Value::String("Alpha Note".to_string())
            }
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preserves_explicit_entry_links_on_table_columns() {
        let root = fixture_root("table-column-entry-link");
        fs::create_dir_all(root.join(".forma/views")).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/entry-link.md"),
            "---\nkind: view\nmode: table\ntitle: Entry link\ntable:\n  columns:\n    - field: fields.summary\n      label: Summary\n      link:\n        target: entry\n    - field: fields.status\n      label: Status\n---\n\n# Entry link\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "entry-link", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Table { columns, .. }) = result.render else {
            panic!("expected table render");
        };
        assert_eq!(
            columns[0].link,
            Some(TableColumnLink {
                target: TableColumnLinkTarget::Entry,
            })
        );
        assert_eq!(columns[1].link, None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn normalizes_table_column_presentation_without_blocking_the_view() {
        let root = fixture_root("table-column-presentation");
        fs::create_dir_all(root.join(".forma/views")).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/column-presentation.md"),
            "---\nkind: view\nmode: table\ntitle: Column presentation\ntable:\n  defaults:\n    column:\n      width: 16rem\n      minWidth: 8rem\n      maxWidth: 24rem\n      overflow: wrap\n  columns:\n    - field: fields.title\n      label: Valid\n      width: 240\n      maxWidth: 32em\n      overflow: truncate\n    - field: fields.summary\n      label: Invalid\n      width: calc(100vw)\n      minWidth: 30em\n      maxWidth: 20em\n      overflow: hidden\n    - field: fields.createdAt\n      label: Invalid units\n      width: 20ch\n      minWidth: 12pt\n      maxWidth: 50%\n      overflow: auto\n    - fields.status\n---\n\n# Column presentation\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "column-presentation", BTreeMap::new()).unwrap();
        assert_eq!(result.status, OperationStatus::Warning);
        assert_eq!(
            result
                .diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "view.tableColumnPresentationInvalid")
                .count(),
            7
        );
        let Some(ViewRenderOutput::Table { columns, .. }) = result.render else {
            panic!("expected table render");
        };
        assert_eq!(
            columns[0],
            ViewRenderColumn {
                field: "fields.title".to_string(),
                label: "Valid".to_string(),
                link: None,
                width: Some("240px".to_string()),
                min_width: Some("8rem".to_string()),
                max_width: Some("32em".to_string()),
                overflow: Some(TableColumnOverflow::Truncate),
            }
        );
        assert_eq!(
            columns[1],
            ViewRenderColumn {
                field: "fields.summary".to_string(),
                label: "Invalid".to_string(),
                link: None,
                width: Some("16rem".to_string()),
                min_width: Some("8rem".to_string()),
                max_width: Some("24rem".to_string()),
                overflow: Some(TableColumnOverflow::Wrap),
            }
        );
        assert_eq!(
            columns[2],
            ViewRenderColumn {
                field: "fields.createdAt".to_string(),
                label: "Invalid units".to_string(),
                link: None,
                width: Some("16rem".to_string()),
                min_width: Some("8rem".to_string()),
                max_width: Some("24rem".to_string()),
                overflow: Some(TableColumnOverflow::Wrap),
            }
        );
        assert_eq!(
            columns[3],
            ViewRenderColumn {
                field: "fields.status".to_string(),
                label: "fields.status".to_string(),
                link: None,
                width: Some("16rem".to_string()),
                min_width: Some("8rem".to_string()),
                max_width: Some("24rem".to_string()),
                overflow: Some(TableColumnOverflow::Wrap),
            }
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn invalid_table_defaults_fall_back_to_intrinsic_presentation() {
        let root = fixture_root("table-column-defaults");
        fs::create_dir_all(root.join(".forma/views")).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/column-defaults.md"),
            "---\nkind: view\nmode: table\ntitle: Column defaults\ntable:\n  defaults:\n    column:\n      width: calc(100vw)\n      minWidth: 8em\n      maxWidth: 20em\n      overflow: hidden\n  columns:\n    - field: fields.title\n      label: Conflicting override\n      minWidth: 30em\n    - fields.summary\n---\n\n# Column defaults\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "column-defaults", BTreeMap::new()).unwrap();
        assert_eq!(result.status, OperationStatus::Warning);
        assert_eq!(
            result
                .diagnostics
                .iter()
                .filter(|diagnostic| diagnostic.code == "view.tableColumnPresentationInvalid")
                .count(),
            3
        );
        let Some(ViewRenderOutput::Table { columns, .. }) = result.render else {
            panic!("expected table render");
        };
        assert_eq!(columns[0].width, None);
        assert_eq!(columns[0].min_width, None);
        assert_eq!(columns[0].max_width, None);
        assert_eq!(columns[0].overflow, None);
        assert_eq!(columns[1].width, None);
        assert_eq!(columns[1].min_width.as_deref(), Some("8em"));
        assert_eq!(columns[1].max_width.as_deref(), Some("20em"));
        assert_eq!(columns[1].overflow, None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn bounds_table_column_dimensions_to_supported_units() {
        let normalized = |source: &str| {
            let value = serde_yml::from_str::<Value>(source).unwrap();
            normalized_table_column_dimension(Some(&value))
        };

        assert_eq!(normalized("240"), Some("240px".to_string()));
        assert_eq!(normalized("\"12.5px\""), Some("12.5px".to_string()));
        assert_eq!(normalized("\"8rem\""), Some("8rem".to_string()));
        assert_eq!(normalized("\"24em\""), Some("24em".to_string()));

        for invalid in [
            "0",
            "-1",
            "4097",
            "\"20ch\"",
            "\"12pt\"",
            "\"50%\"",
            "\"10vw\"",
            "\"calc(100vw)\"",
            "\"var(--column-width)\"",
            "\"auto\"",
            "\"1e2px\"",
        ] {
            assert_eq!(normalized(invalid), None, "{invalid} must be omitted");
        }
    }

    #[test]
    fn renders_included_view_config_node_outside_forma_views() {
        let root = fixture_root("included-view-render");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Render Test\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/spaces/*.md\n  - views/*.md\n",
        );
        fs::create_dir_all(root.join("views")).unwrap();
        fs::write(
            root.join("views/custom.md"),
            "---\nkind: view\ntitle: Custom\nmode: table\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - notes\ncolumns:\n  - field: fields.title\n---\n\n# Custom\n",
        )
        .unwrap();

        let result = render_view(&root, "custom", BTreeMap::new()).unwrap();

        assert_eq!(
            result.view.as_ref().map(|view| view.path.as_str()),
            Some("views/custom.md")
        );
        assert!(matches!(
            result.render,
            Some(ViewRenderOutput::Table { .. })
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_exact_view_id_when_basenames_collide_and_rejects_ambiguous_short_id() {
        let root = fixture_root("render-view-basename-collision");
        fs::create_dir_all(root.join(".forma/views")).unwrap();
        fs::create_dir_all(root.join("views")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Workspace\n  canonicalLanguage: en\n  supportedLanguages:\n    - en\n  timezone: UTC\nimports:\n  - .forma/views/*.md\n  - views/*.md\n",
        );
        fs::write(
            root.join(".forma/views/tasks.md"),
            "---\nkind: view\nmode: list\ntitle: Built-in Tasks\nsource:\n  type: pages\n---\n\n# Built-in Tasks\n",
        )
        .unwrap();
        fs::write(
            root.join("views/tasks.md"),
            "---\nkind: view\nmode: table\ntitle: Custom Tasks\nsource:\n  type: pages\n---\n\n# Custom Tasks\n",
        )
        .unwrap();

        let discovery = discover_workspace(&root).unwrap();
        assert!(
            discovery
                .index
                .views
                .iter()
                .any(|view| view.id == ".forma/views/tasks")
        );
        assert!(
            discovery
                .index
                .views
                .iter()
                .any(|view| view.id == "views/tasks")
        );

        let exact = render_view(&root, "views/tasks", BTreeMap::new()).unwrap();
        assert_eq!(
            exact.view.as_ref().and_then(|view| view.title.as_deref()),
            Some("Custom Tasks")
        );
        assert!(matches!(
            render_view(&root, "tasks", BTreeMap::new()),
            Err(OperationError::ViewAmbiguous(view)) if view == "tasks"
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_kanban_view_from_query_columns() {
        let root = fixture_root("kanban-view-render");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        create_entry(
            &root,
            "tasks",
            BTreeMap::from([
                (
                    "title".to_string(),
                    Value::String("Draft brief".to_string()),
                ),
                ("status".to_string(), Value::String("doing".to_string())),
            ]),
        )
        .unwrap();

        let result = render_view(&root, "tasks", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Kanban { card, columns }) = result.render else {
            panic!("expected kanban render");
        };
        assert_eq!(card.title_field, "fields.title");
        assert_eq!(
            card.subtitle_fields,
            ["fields.summary", "fields.owners", "fields.assignees"]
        );
        assert_eq!(card.badge_fields, ["fields.priority", "fields.dueDate"]);
        let doing = columns
            .iter()
            .find(|column| column.id == "doing")
            .expect("doing column should exist");
        assert_eq!(doing.items.len(), 1);
        assert_eq!(
            doing.items[0].fields["title"],
            ViewRenderFieldValue::Value {
                value: Value::String("Draft brief".to_string())
            }
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_list_view_from_query_candidates() {
        let root = fixture_root("list-view-render");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        create_entry(
            &root,
            "notes",
            BTreeMap::from([("title".to_string(), Value::String("Background".to_string()))]),
        )
        .unwrap();
        create_entry(
            &root,
            "tasks",
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
            "---\nkind: view\nmode: list\ntitle: Recent Workspace Items\nsource:\n  type: pages\n  include:\n    - \"**/*.md\"\nquery:\n  all:\n    - field: fields.title\n      op: contains\n      value: brief\n---\n\n# Recent Workspace Items\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "recent", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::List { items }) = result.render else {
            panic!("expected list render");
        };

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "tasks/draft-brief.md");
        assert_eq!(items[0].title.as_deref(), Some("Draft brief"));
        assert_eq!(
            items[0].fields["status"],
            ViewRenderFieldValue::Value {
                value: Value::String("doing".to_string())
            }
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_graph_view_from_resolved_index_references() {
        let root = fixture_root("graph-view-render");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
            root.join(".forma/views/workspace-graph.md"),
            "---\nkind: view\nmode: graph\ntitle: Workspace Graph\nsource:\n  type: pages\n  include:\n    - \"notes/**/*.md\"\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph { nodes, edges, .. }) = result.render else {
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
        assert_eq!(edges[0].label, "links to");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_graph_node_titles_from_namespaced_space_conventions() {
        let root = fixture_root("graph-view-convention-title");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("members/ava-patel.md"),
            "---\nname: Ava Patel\ndescription: Product lead\n---\n\n# Ava Patel\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/workspace-graph.md"),
            "---\nkind: view\nmode: graph\ntitle: Workspace Graph\nsource:\n  type: pages\n  include:\n    - \"members/**/*.md\"\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph { nodes, .. }) = result.render else {
            panic!("expected graph render");
        };

        assert_eq!(nodes.len(), 1);
        assert_eq!(nodes[0].path, "members/ava-patel.md");
        assert_eq!(nodes[0].title.as_deref(), Some("Ava Patel"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_graph_classification_from_an_explicit_taxonomy() {
        let root = fixture_root("graph-view-taxonomy-color");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\n---\n\n# Source\n\n[Target](target).\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/target.md"),
            "---\nkind: note\ntitle: Target\n---\n\n# Target\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/unclassified.md"),
            "---\nkind: note\ntitle: Unclassified\n---\n\n# Unclassified\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/shared.md"),
            "---\nkind: note\ntitle: Shared\n---\n\n# Shared\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/areas.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: areas\ntitle: Areas\nmode: multiple\ndisplay:\n  color: \"#64748B\"\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/area-sources.md"),
            "---\nschemaVersion: 1\nkind: term\nid: sources\ntaxonomy: areas\ntitle: Sources\ndisplay:\n  order: 20\n  color: \"#4F7CAC\"\ninclude:\n  - notes/source.md\n  - notes/shared.md\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/area-targets.md"),
            "---\nschemaVersion: 1\nkind: term\nid: targets\ntaxonomy: areas\ntitle: Targets\ndisplay:\n  order: 10\ninclude:\n  - notes/target.md\n  - notes/shared.md\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/workspace-graph.md"),
            "---\nkind: view\nmode: graph\ntitle: Workspace Graph\nsource:\n  type: pages\n  include:\n    - \"notes/**/*.md\"\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        taxonomy: areas\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph {
            nodes,
            edges,
            legend,
        }) = result.render
        else {
            panic!("expected graph render");
        };

        assert_eq!(edges.len(), 1);
        assert_eq!(legend.len(), 4);
        assert_eq!(legend[0].label, "Targets");
        assert_eq!(legend[0].color.as_deref(), Some("#64748B"));
        assert_eq!(legend[1].label, "Sources");
        assert_eq!(legend[1].color.as_deref(), Some("#4F7CAC"));
        assert_eq!(legend[2].label, "Multiple terms");
        assert_eq!(legend[2].color, None);
        assert_eq!(legend[3].label, "Unclassified");
        assert_eq!(legend[3].color, None);
        let source = nodes
            .iter()
            .find(|node| node.path == "notes/source.md")
            .expect("source node");
        assert_eq!(
            source
                .classification
                .as_ref()
                .map(|value| value.key.as_str()),
            Some("areas:term:sources")
        );
        let shared = nodes
            .iter()
            .find(|node| node.path == "notes/shared.md")
            .expect("shared node");
        assert_eq!(
            shared
                .classification
                .as_ref()
                .map(|value| (value.key.as_str(), value.label.as_str())),
            Some(("areas:multiple", "Sources, Targets"))
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_graph_classification_from_a_frontmatter_field() {
        let root = fixture_root("graph-view-field-color");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/doing-one.md"),
            "---\nkind: note\ntitle: Doing One\nworkflow:\n  stage: doing\n---\n\n# Doing One\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/doing-two.md"),
            "---\nkind: note\ntitle: Doing Two\nworkflow:\n  stage: doing\n---\n\n# Doing Two\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/explicit.md"),
            "---\nkind: note\ntitle: Explicit\nworkflow:\n  stage: \"#dc2626\"\n---\n\n# Explicit\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/explicit-uppercase.md"),
            "---\nkind: note\ntitle: Explicit Uppercase\nworkflow:\n  stage: \"#DC2626\"\n---\n\n# Explicit Uppercase\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/missing.md"),
            "---\nkind: note\ntitle: Missing\n---\n\n# Missing\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/unsupported.md"),
            "---\nkind: note\ntitle: Unsupported\nworkflow:\n  stage:\n    - doing\n    - done\n---\n\n# Unsupported\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/workspace-graph.md"),
            "---\nkind: view\nmode: graph\ntitle: Workspace Graph\nsource:\n  type: pages\n  include:\n    - \"notes/**/*.md\"\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        field: fields.workflow.stage\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph { nodes, legend, .. }) = result.render else {
            panic!("expected graph render");
        };

        assert_eq!(legend.len(), 3);
        assert_eq!(legend[0].label, "#DC2626");
        assert_eq!(legend[0].color.as_deref(), Some("#DC2626"));
        assert_eq!(legend[1].label, "doing");
        assert_eq!(legend[1].color.as_deref(), Some("#C026D3"));
        assert_eq!(legend[2].label, "Unclassified");
        assert_eq!(legend[2].color, None);

        let doing_one = nodes
            .iter()
            .find(|node| node.path == "notes/doing-one.md")
            .and_then(|node| node.classification.as_ref())
            .expect("doing one classification");
        let doing_two = nodes
            .iter()
            .find(|node| node.path == "notes/doing-two.md")
            .and_then(|node| node.classification.as_ref())
            .expect("doing two classification");
        assert_eq!(doing_one.key, doing_two.key);
        assert_eq!(doing_one.label, "doing");
        assert_eq!(doing_one.field.as_deref(), Some("fields.workflow.stage"));
        assert_eq!(doing_one.taxonomy, None);

        let explicit = nodes
            .iter()
            .find(|node| node.path == "notes/explicit.md")
            .and_then(|node| node.classification.as_ref())
            .expect("explicit classification");
        let explicit_uppercase = nodes
            .iter()
            .find(|node| node.path == "notes/explicit-uppercase.md")
            .and_then(|node| node.classification.as_ref())
            .expect("uppercase explicit classification");
        assert_eq!(explicit.key, explicit_uppercase.key);

        let missing = nodes
            .iter()
            .find(|node| node.path == "notes/missing.md")
            .and_then(|node| node.classification.as_ref())
            .expect("missing classification");
        let unsupported = nodes
            .iter()
            .find(|node| node.path == "notes/unsupported.md")
            .and_then(|node| node.classification.as_ref())
            .expect("unsupported classification");
        assert_eq!(missing.key, unsupported.key);
        assert_eq!(missing.label, "Unclassified");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_generated_graph_colors_stable_for_typed_scalar_values() {
        assert_eq!(
            stable_graph_color_hash(b"string:doing"),
            0xe98f_0c27_9bc0_f74d
        );
        assert_ne!(
            stable_graph_color_hash(b"string:42"),
            stable_graph_color_hash(b"number:42")
        );
        assert_ne!(
            stable_graph_color_hash(b"string:true"),
            stable_graph_color_hash(b"boolean:true")
        );
    }

    #[test]
    fn rejects_invalid_graph_field_color_sources() {
        for (fixture, color_by) in [
            (
                "graph-view-color-source-conflict",
                "taxonomy: spaces\n        field: fields.status",
            ),
            ("graph-view-color-field-invalid", "field: status"),
        ] {
            let root = fixture_root(fixture);
            fs::create_dir_all(&root).unwrap();
            copy_starter_workspace(&root);
            fs::write(
                root.join(".forma/views/workspace-graph.md"),
                format!(
                    "---\nkind: view\nmode: graph\nsource:\n  type: pages\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        {color_by}\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n"
                ),
            )
            .unwrap();

            let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();

            assert!(result.render.is_none());
            assert!(
                result
                    .diagnostics
                    .iter()
                    .any(|diagnostic| diagnostic.code == "view.graphColorByInvalid")
            );

            fs::remove_dir_all(root).unwrap();
        }
    }

    #[test]
    fn warns_when_a_graph_color_field_has_high_cardinality() {
        let root = fixture_root("graph-view-field-color-cardinality");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        for index in 0..=GRAPH_COLOR_CARDINALITY_WARNING_THRESHOLD {
            fs::write(
                root.join(format!("notes/value-{index}.md")),
                format!(
                    "---\nkind: note\ntitle: Value {index}\ncategory: value-{index}\n---\n\n# Value {index}\n"
                ),
            )
            .unwrap();
        }
        fs::write(
            root.join(".forma/views/workspace-graph.md"),
            "---\nkind: view\nmode: graph\nsource:\n  type: pages\n  include:\n    - \"notes/**/*.md\"\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        field: fields.category\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();

        assert!(result.render.is_some());
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.graphColorCardinalityHigh")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_an_unknown_graph_color_taxonomy() {
        let root = fixture_root("graph-view-missing-taxonomy");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/workspace-graph.md"),
            "---\nkind: view\nmode: graph\ntitle: Workspace Graph\nsource:\n  type: pages\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        taxonomy: missing\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();

        assert!(result.render.is_none());
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.graphTaxonomyMissing")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_invalid_taxonomy_colors_out_of_graph_projection() {
        let root = fixture_root("graph-view-invalid-taxonomy-color");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\n---\n\n# Source\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/areas.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: areas\ntitle: Areas\nmode: primary\ndisplay:\n  color: red\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/area-sources.md"),
            "---\nschemaVersion: 1\nkind: term\nid: sources\ntaxonomy: areas\ntitle: Sources\ninclude:\n  - notes/source.md\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/workspace-graph.md"),
            "---\nkind: view\nmode: graph\nsource:\n  type: pages\ngraph:\n  presentation:\n    nodes:\n      colorBy:\n        taxonomy: areas\n---\n\n# Workspace Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "workspace-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph { legend, .. }) = result.render else {
            panic!("expected graph render");
        };

        assert_eq!(legend.len(), 1);
        assert_eq!(legend[0].color, None);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "config.displayColorInvalid")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_configured_graph_edges_from_frontmatter_fields() {
        let root = fixture_root("graph-view-field-render");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("members/mira-chen.md"),
            "---\nkind: member\nname: Mira Chen\n---\n\n# Mira Chen\n",
        )
        .unwrap();
        fs::write(
            root.join("tasks/connect-related-pages.md"),
            "---\nkind: task\ntitle: Connect Related Pages\nassignees:\n  - members/mira-chen.md\n---\n\n# Connect Related Pages\n\nSee [[members/mira-chen]].\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/members-graph.md"),
            "---\nkind: view\nmode: graph\ntitle: Members Graph\nsource:\n  type: pages\ngraph:\n  edges:\n    - source: fields\n      field: assignees\n      label: assigned to\n---\n\n# Members Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "members-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph { nodes, edges, .. }) = result.render else {
            panic!("expected graph render");
        };

        assert_eq!(nodes.len(), 2);
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].source, "tasks/connect-related-pages.md");
        assert_eq!(edges[0].target, "members/mira-chen.md");
        assert_eq!(edges[0].intent, ReferenceIntent::Reference);
        assert_eq!(edges[0].reference_source, ReferenceSource::Frontmatter);
        assert_eq!(edges[0].field.as_deref(), Some("assignees"));
        assert_eq!(edges[0].label, "assigned to");
        assert_eq!(edges[0].semantic_type.as_deref(), Some("member"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_graph_field_edges_from_user_authored_space_schema() {
        let root = fixture_root("graph-view-custom-field-schema");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        let config_path = root.join(FORMA_CONFIG_PATH);
        let config = fs::read_to_string(&config_path).unwrap();
        fs::write(
            &config_path,
            config.replace(
                "  taskStatus:\n",
                "  project:\n    kind: entryRef\n    source: .forma/spaces/projects\n    input:\n      transform: slugify\n  taskStatus:\n",
            ),
        )
        .unwrap();
        fs::create_dir_all(root.join("projects")).unwrap();
        fs::create_dir_all(root.join("notes")).unwrap();
        fs::write(
            root.join(".forma/spaces/projects.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Projects\ninclude:\n  - projects/**/*.md\ncreate:\n  directory: projects\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: title\nschema:\n  type: object\n  fields:\n    kind:\n      type: const\n      value: project\n    title:\n      type: string\n---\n\n# Projects\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\ncreate:\n  directory: notes\n  filename: \"{{ input.slug }}.md\"\n  template: .forma/spaces/templates/note.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: title\nschema:\n  type: object\n  fields:\n    kind:\n      type: const\n      value: note\n    title:\n      type: string\n    project:\n      type: project\n---\n\n# Notes\n",
        )
        .unwrap();
        fs::write(
            root.join("projects/migration.md"),
            "---\nkind: project\ntitle: Migration\n---\n\n# Migration\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/plan.md"),
            "---\nkind: note\ntitle: Plan\nproject: projects/migration.md\n---\n\n# Plan\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/views/project-graph.md"),
            "---\nkind: view\nmode: graph\ntitle: Project Graph\nsource:\n  type: pages\ngraph:\n  edges:\n    - source: fields\n      field: project\n      label: belongs to\n---\n\n# Project Graph\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "project-graph", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Graph { nodes, edges, .. }) = result.render else {
            panic!("expected graph render");
        };

        assert_eq!(nodes.len(), 2);
        assert_eq!(edges.len(), 1);
        assert_eq!(edges[0].source, "notes/plan.md");
        assert_eq!(edges[0].target, "projects/migration.md");
        assert_eq!(edges[0].reference_source, ReferenceSource::Frontmatter);
        assert_eq!(edges[0].field.as_deref(), Some("project"));
        assert_eq!(edges[0].semantic_type.as_deref(), Some("project"));
        assert_eq!(edges[0].label, "belongs to");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renders_explicit_workspace_source_and_normalized_query_targets() {
        let root = fixture_root("workspace-source-view-render");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        create_entry(
            &root,
            "notes",
            BTreeMap::from([("title".to_string(), Value::String("Background".to_string()))]),
        )
        .unwrap();
        create_entry(
            &root,
            "tasks",
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
            root.join(".forma/views/active-tasks.md"),
            "---\nkind: view\nmode: table\ntitle: Active Tasks\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - tasks\nquery:\n  all:\n    - field: fields.status\n      op: in\n      value: [todo, doing]\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n---\n\n# Active Tasks\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "active-tasks", BTreeMap::new()).unwrap();
        let Some(ViewRenderOutput::Table { items, .. }) = result.render else {
            panic!("expected table render");
        };

        assert_eq!(items.len(), 1);
        assert_eq!(items[0].path, "tasks/draft-brief.md");
        assert_eq!(
            items[0].fields["fields.title"],
            ViewRenderFieldValue::Value {
                value: Value::String("Draft brief".to_string())
            }
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_invalid_query_target_as_diagnostic() {
        let root = fixture_root("view-invalid-target");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: view\nmode: table\ntitle: Notes\nquery:\n  all:\n    - field: metadata.status\n      op: equals\n      value: todo\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n---\n\n# Notes\n\n<!-- forma:content -->\n",
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
    fn rejects_legacy_target_query_predicates() {
        let root = fixture_root("view-legacy-target");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        create_entry(
            &root,
            "tasks",
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
            root.join(".forma/views/active-tasks.md"),
            "---\nkind: view\nmode: table\ntitle: Active Tasks\nquery:\n  all:\n    - target: fields.status\n      op: equals\n      value: doing\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n---\n\n# Active Tasks\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "active-tasks", BTreeMap::new()).unwrap();

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
    fn allows_missing_view_mount_for_clients_that_append_the_projection() {
        let root = fixture_root("view-missing-mount");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: view\nmode: table\ntitle: Notes\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n---\n\n# Notes\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();

        assert_eq!(result.status, crate::OperationStatus::Passed);
        assert!(result.render.is_some());
        assert_eq!(
            result
                .document
                .as_ref()
                .map(|document| document.mounts.len()),
            Some(0)
        );
        assert!(
            !result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "view.mountMissing")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn view_render_returns_body_and_content_mount_source_mapping() {
        let root = fixture_root("view-document-mount");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: view\nmode: list\ntitle: Notes\nsource:\n  type: pages\n---\n\n# Notes\n\nBefore 🧭.\n\n<!-- forma:content -->\n\nAfter.\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();
        let document = result.document.expect("view document should be returned");

        assert!(document.body_source.contains("Before 🧭."));
        assert!(document.body_source.contains("After."));
        assert_eq!(document.mounts.len(), 1);
        assert_eq!(
            document.mounts[0].location,
            crate::DiagnosticLocation::Body {
                line: Some(13),
                column: Some(1)
            }
        );
        let prefix = document
            .body_source
            .split("<!-- forma:content -->")
            .next()
            .unwrap();
        assert_eq!(
            document.mounts[0].start_offset,
            prefix.encode_utf16().count()
        );
        assert_eq!(
            document.mounts[0].end_offset - document.mounts[0].start_offset,
            "<!-- forma:content -->".encode_utf16().count()
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_multiple_view_mounts_with_source_location() {
        let root = fixture_root("view-multiple-mounts");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: view\nmode: list\ntitle: Notes\nsource:\n  type: pages\n---\n\n# Notes\n\n<!-- forma:content -->\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(result.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "view.mountMultiple"
                && diagnostic.message
                    == "View must contain only one `<!-- forma:content -->` marker."
                && diagnostic.location.is_some()
        }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_legacy_empty_view_mount_with_migration_diagnostic() {
        let root = fixture_root("view-legacy-empty-mount");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: view\nmode: list\ntitle: Notes\nsource:\n  type: pages\n---\n\n# Notes\n\n<!-- forma-view -->\n",
        )
        .unwrap();

        let result = render_view(&root, "notes", BTreeMap::new()).unwrap();
        let document = result
            .document
            .as_ref()
            .expect("view document should be returned");

        assert_eq!(result.status, crate::OperationStatus::Failed);
        assert!(document.mounts.is_empty());
        assert!(result.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == "view.mountMissing"
                && diagnostic.message
                    == "Replace legacy `<!-- forma-view -->` with `<!-- forma:content -->`."
        }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_invalid_view_definition_as_diagnostic() {
        let root = fixture_root("view-invalid");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: view\nmode: table\ntable: broken\n---\n\n# Notes\n\n<!-- forma:content -->\n",
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
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/views/notes.md"),
            "---\nkind: view\nmode: table\nspace: missing\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n---\n\n# Notes\n\n<!-- forma:content -->\n",
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
