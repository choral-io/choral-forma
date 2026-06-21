use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::config::{
    ConfigError, LoadMode, WorkspaceConfig, WorkspaceSettings, config_source_paths, load_workspace,
};
use crate::diagnostics::{Diagnostic, DiagnosticSeverity, DiagnosticSummary, OperationStatus};
use crate::index::{
    IndexEntry, IndexReference, ReferenceIntent, ReferenceSource, config_error_diagnostic,
    discover_workspace,
};
use crate::markdown::FormaMarkdownDocument;
use crate::path::{
    FORMA_CONFIG_PATH, FORMA_DIR, FORMA_GITIGNORE_PATH, FORMA_VIEWS_DIR, PathError, WorkspacePath,
};
use crate::schema::{
    PlaceholderContext, render_placeholder_template, resolve_create_inputs, resolve_runtime_values,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub root: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<WorkspaceLogoSummary>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceLogoSummary {
    pub url: String,
    pub alt: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub created: Vec<String>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub created: CreatedEntry,
    pub inputs: BTreeMap<String, CreateInputResult>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedEntry {
    pub path: String,
    pub space: String,
    pub template: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInputResult {
    pub source: CreateInputSource,
    pub value: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CreateInputSource {
    Explicit,
    Default,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub entry: InspectEntry,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectEntry {
    pub path: String,
    pub space: String,
    #[serde(default)]
    pub guidelines: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default)]
    pub metadata: Value,
    #[serde(default)]
    pub headings: Vec<String>,
    #[serde(default)]
    pub refs: Vec<crate::index::IndexReference>,
    pub renderable: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub space: ListedSpace,
    pub entries: Vec<ListEntry>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigInspectResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub config: Value,
    pub sources: Vec<ConfigSource>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSource {
    pub path: String,
    pub kind: ConfigSourceKind,
    pub present: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfigSourceKind {
    Shared,
    Local,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilesListResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub files: Vec<WorkspaceFile>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDashboardResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub spaces: Vec<DashboardSpace>,
    pub entries: Vec<DashboardEntrySummary>,
    pub views: Vec<DashboardViewSummary>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSpace {
    pub id: String,
    pub title: String,
    #[serde(
        default,
        skip_serializing_if = "crate::config::DisplayOptions::is_empty"
    )]
    pub display: crate::config::DisplayOptions,
    pub include: String,
    pub include_patterns: Vec<String>,
    pub entry_count: usize,
    pub status: OperationStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardEntrySummary {
    pub id: String,
    pub path: String,
    pub route_path: String,
    pub raw_path: String,
    pub space: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variants: Vec<DashboardEntryVariant>,
    pub status: OperationStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<DateTime<Utc>>,
    pub renderable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardEntryVariant {
    pub language: String,
    pub path: String,
    pub route_path: String,
    pub raw_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardViewSummary {
    pub id: String,
    pub path: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "crate::config::DisplayOptions::is_empty"
    )]
    pub display: crate::config::DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReferencesResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub file: ReferenceFile,
    pub outgoing: Vec<ReferenceEdge>,
    pub backlinks: Vec<ReferenceEdge>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeHealthResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub findings: Vec<KnowledgeHealthFinding>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeHealthFinding {
    pub category: KnowledgeHealthCategory,
    pub severity: DiagnosticSeverity,
    pub path: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KnowledgeHealthCategory {
    BrokenReference,
    AmbiguousReference,
    NoOutgoingReferences,
    NoBacklinks,
    ConfigDiagnostic,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceFile {
    pub path: String,
    pub space: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceEdge {
    pub source_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_kind: Option<String>,
    pub target_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_kind: Option<crate::index::ReferenceFragmentKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_kind: Option<String>,
    pub source: ReferenceSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub semantic_type: Option<String>,
    pub intent: ReferenceIntent,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFile {
    pub path: String,
    pub name: String,
    pub parent: String,
    pub depth: usize,
    pub kind: WorkspaceFileKind,
    pub media_type: String,
    pub features: Vec<WorkspaceFileFeature>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frontmatter: Option<Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceFileKind {
    Knowledge,
    View,
    Template,
    Markdown,
    Config,
    Resource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorkspaceFileFeature {
    #[serde(rename = "render.markdown")]
    RenderMarkdown,
    #[serde(rename = "render.source")]
    RenderSource,
    #[serde(rename = "render.view")]
    RenderView,
    #[serde(rename = "preview.media")]
    PreviewMedia,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedSpace {
    pub id: String,
    pub title: String,
    pub include: String,
    pub include_patterns: Vec<String>,
    pub entry_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntry {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(default)]
    pub fields: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TasksListResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub tasks: Vec<TaskSummary>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardShowResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub columns: Vec<BoardColumn>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardColumn {
    pub id: String,
    pub title: String,
    pub tasks: Vec<TaskSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TasksInspectResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    #[serde(default)]
    pub guidelines: Vec<String>,
    pub task: TaskSummary,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskSummary {
    pub path: String,
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readiness: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owners: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignees: Option<Vec<String>>,
}

#[derive(Debug, Error)]
pub enum OperationError {
    #[error("configuration error: {0}")]
    Config(#[from] ConfigError),
    #[error("workspace already contains .forma")]
    WorkspaceExists,
    #[error("space `{0}` was not found")]
    SpaceNotFound(String),
    #[error("space `{0}` does not define create behavior")]
    CreateNotConfigured(String),
    #[error("invalid input `{0}`")]
    InvalidInput(String),
    #[error("invalid workspace path: {0}")]
    InvalidPath(#[from] PathError),
    #[error("configuration path is not inspectable: {0}")]
    ConfigPathNotInspectable(String),
    #[error("invalid timezone `{0}`")]
    InvalidTimezone(String),
    #[error("entry was not found")]
    EntryNotFound,
    #[error("entry locator matched multiple files")]
    EntryAmbiguous,
    #[error("view `{0}` was not found")]
    ViewNotFound(String),
    #[error("path already exists: {0}")]
    PathConflict(String),
    #[error("file operation failed for {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
}

pub fn init_workspace(
    root: impl AsRef<Path>,
    name: &str,
    language: &str,
    timezone: Option<&str>,
) -> Result<InitResult, OperationError> {
    let root = root.as_ref();
    if root.join(FORMA_DIR).exists() {
        return Err(OperationError::WorkspaceExists);
    }

    let timezone = timezone
        .map(ToString::to_string)
        .unwrap_or_else(detect_environment_timezone);
    validate_timezone(&timezone)?;
    let mut created = Vec::new();

    for directory in [
        FORMA_DIR,
        ".forma/spaces",
        ".forma/spaces/templates",
        FORMA_VIEWS_DIR,
        "notes",
        "tasks",
        "members",
        "decisions",
        "proposals",
        "guidelines",
    ] {
        fs::create_dir_all(root.join(directory)).map_err(|source| OperationError::Io {
            path: directory.to_string(),
            source,
        })?;
    }

    write_file(root, FORMA_GITIGNORE_PATH, STARTER_GITIGNORE, &mut created)?;
    write_file(
        root,
        FORMA_CONFIG_PATH,
        &starter_config_yml(name, language, &timezone),
        &mut created,
    )?;
    for (path, source) in starter_support_nodes() {
        write_file(root, &path, source, &mut created)?;
    }
    for (path, source) in starter_templates() {
        write_file(root, &path, source, &mut created)?;
    }
    for (path, source) in starter_views() {
        write_file(root, &path, source, &mut created)?;
    }

    let diagnostics = Vec::new();
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(InitResult {
        schema_version: 1,
        operation: "init".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: name.to_string(),
            logo: None,
        },
        created,
        summary,
        diagnostics,
    })
}

pub fn create_entry(
    root: impl AsRef<Path>,
    space_id: &str,
    provided: BTreeMap<String, Value>,
) -> Result<CreateResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::WithLocalOverrides)?;
    let space = workspace
        .config
        .spaces
        .get(space_id)
        .ok_or_else(|| OperationError::SpaceNotFound(space_id.to_string()))?;
    let create = space
        .create
        .as_ref()
        .ok_or_else(|| OperationError::CreateNotConfigured(space_id.to_string()))?;

    for name in provided.keys() {
        if !create.inputs.contains_key(name) {
            return Err(OperationError::InvalidInput(name.clone()));
        }
    }

    let runtime = resolve_runtime_values(&workspace.config, ".");
    let resolved = resolve_create_inputs(&create.inputs, &provided, &runtime);
    let mut diagnostics = workspace.diagnostics;
    diagnostics.extend(runtime.diagnostics.clone());
    diagnostics.extend(resolved.diagnostics);
    if DiagnosticSummary::from_diagnostics(&diagnostics).errors > 0 {
        return Err(OperationError::InvalidInput("create inputs".to_string()));
    }

    let context = PlaceholderContext {
        input: resolved.values.clone(),
        runtime_values: runtime.as_map().clone(),
    };
    let filename = render_placeholder_template(&create.filename, &context);
    diagnostics.extend(filename.diagnostics);
    let Some(filename) = filename.value else {
        return Err(OperationError::InvalidInput("filename".to_string()));
    };
    let rendered_path = WorkspacePath::parse_config(format!("{}/{}", create.directory, filename))?;
    let public_path = rendered_path.as_str().to_string();
    if root.as_ref().join(&public_path).exists() {
        return Err(OperationError::PathConflict(public_path));
    }

    let template_path = WorkspacePath::parse_config(&space.template)?;
    let template_source =
        fs::read_to_string(root.as_ref().join(template_path.as_str())).map_err(|source| {
            OperationError::Io {
                path: template_path.as_str().to_string(),
                source,
            }
        })?;
    let rendered = render_placeholder_template(&template_source, &context);
    diagnostics.extend(rendered.diagnostics);
    let Some(rendered) = rendered.value else {
        return Err(OperationError::InvalidInput("template".to_string()));
    };

    if let Some(parent) = root.as_ref().join(&public_path).parent() {
        fs::create_dir_all(parent).map_err(|source| OperationError::Io {
            path: create.directory.clone(),
            source,
        })?;
    }
    fs::write(root.as_ref().join(&public_path), rendered).map_err(|source| OperationError::Io {
        path: public_path.clone(),
        source,
    })?;

    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    let inputs = resolved
        .values
        .into_iter()
        .map(|(name, value)| {
            let source = if provided.contains_key(&name) {
                CreateInputSource::Explicit
            } else {
                CreateInputSource::Default
            };
            let transform = create
                .inputs
                .get(&name)
                .and_then(|input| input.transform.clone());
            (
                name,
                CreateInputResult {
                    source,
                    value,
                    transform,
                },
            )
        })
        .collect();

    Ok(CreateResult {
        schema_version: 1,
        operation: "create".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        created: CreatedEntry {
            path: public_path,
            space: space_id.to_string(),
            template: space.template.clone(),
        },
        inputs,
        summary,
        diagnostics,
    })
}

pub fn inspect_entry_by_path(
    root: impl AsRef<Path>,
    path: &str,
) -> Result<InspectResult, OperationError> {
    let path = normalize_entry_path(path)?;
    inspect_entry(root, &path)
}

pub fn inspect_entry_by_space(
    root: impl AsRef<Path>,
    space: &str,
    entry: &str,
) -> Result<InspectResult, OperationError> {
    let discovery = discover_workspace(root.as_ref())?;
    let path = resolve_space_entry_path(&discovery.index.entries, space, entry)?;
    inspect_entry(root, &path)
}

pub fn list_space(root: impl AsRef<Path>, space_id: &str) -> Result<ListResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let space = workspace
        .config
        .spaces
        .get(space_id)
        .ok_or_else(|| OperationError::SpaceNotFound(space_id.to_string()))?;
    let discovery = discover_workspace(root.as_ref())?;
    let entries = discovery
        .index
        .entries
        .iter()
        .filter(|entry| entry.space == space_id)
        .map(|entry| ListEntry {
            path: entry.path.clone(),
            kind: entry.kind.clone(),
            title: entry.title.clone(),
            summary: entry.summary.clone(),
            fields: Value::Mapping(Default::default()),
        })
        .collect::<Vec<_>>();
    let mut diagnostics = read_operation_diagnostics_for_paths(
        discovery.diagnostics,
        entries.iter().map(|entry| entry.path.as_str()),
    );
    diagnostics.sort_by_key(diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(ListResult {
        schema_version: 1,
        operation: "list".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        space: ListedSpace {
            id: space_id.to_string(),
            title: space.title.clone(),
            include: space.include.clone(),
            include_patterns: space.include_patterns.clone(),
            entry_count: entries.len(),
        },
        entries,
        summary,
        diagnostics,
    })
}

pub fn tasks_list(root: impl AsRef<Path>) -> Result<TasksListResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let task_entries = selected_task_entries(&discovery.index.entries);
    let mut diagnostics = read_operation_diagnostics_for_paths(
        discovery.diagnostics,
        task_entries.iter().map(|entry| entry.path.as_str()),
    );
    let mut tasks = Vec::with_capacity(task_entries.len());

    for entry in task_entries {
        let (task, task_diagnostics) = task_summary_from_entry(root.as_ref(), entry)?;
        diagnostics.extend(task_diagnostics);
        tasks.push(task);
    }

    diagnostics.sort_by_key(diagnostic_sort_key);
    tasks.sort_by(|left, right| left.path.cmp(&right.path));
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(TasksListResult {
        schema_version: 1,
        operation: "tasks.list".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        tasks,
        summary,
        diagnostics,
    })
}

pub fn board_show(root: impl AsRef<Path>) -> Result<BoardShowResult, OperationError> {
    let tasks = tasks_list(root)?;
    let task_board = TaskBoard::from_tasks(tasks.tasks);

    Ok(BoardShowResult {
        schema_version: tasks.schema_version,
        operation: "board.show".to_string(),
        status: tasks.status,
        workspace: tasks.workspace,
        columns: task_board.columns,
        summary: tasks.summary,
        diagnostics: tasks.diagnostics,
    })
}

pub fn tasks_inspect(
    root: impl AsRef<Path>,
    path_or_id: &str,
) -> Result<TasksInspectResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let task_entries = selected_task_entries(&discovery.index.entries);
    let entry = resolve_task_entry(task_entries, path_or_id)?;
    let mut diagnostics = read_operation_diagnostics_for_paths(
        discovery.diagnostics,
        std::iter::once(entry.path.as_str()),
    );
    let (task, task_diagnostics) = task_summary_from_entry(root.as_ref(), entry)?;
    diagnostics.extend(task_diagnostics);
    diagnostics.sort_by_key(diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let guidelines = applicable_guidelines(&workspace.config, entry.space.as_str());

    Ok(TasksInspectResult {
        schema_version: 1,
        operation: "tasks.inspect".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        guidelines,
        task,
        summary,
        diagnostics,
    })
}

pub fn inspect_config(
    root: impl AsRef<Path>,
    path: Option<&str>,
) -> Result<ConfigInspectResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::WithLocalOverrides)?;
    let path = path
        .map(|path| validate_config_inspect_path(root.as_ref(), path))
        .transpose()?;
    let mut diagnostics = workspace.diagnostics;
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let config = inspect_config_value(root.as_ref(), path.as_deref(), &workspace.config)?;

    Ok(ConfigInspectResult {
        schema_version: 1,
        operation: "config.inspect".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        config,
        sources: config_sources(root.as_ref()),
        summary,
        diagnostics,
    })
}

pub fn list_files(root: impl AsRef<Path>) -> Result<FilesListResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let mut diagnostics = read_operation_diagnostics(discovery.diagnostics);
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let mut files = collect_workspace_files(root.as_ref());

    for file in &mut files {
        if let Some(entry) = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == file.path)
        {
            file.kind = WorkspaceFileKind::Knowledge;
            file.features = features_for_media_type(file.kind, &file.media_type);
            file.space = Some(entry.space.clone());
            file.title = entry.title.clone();
        } else if let Some(view) = discovery
            .index
            .views
            .iter()
            .find(|view| view.path == file.path)
        {
            file.kind = WorkspaceFileKind::View;
            file.features = features_for_media_type(file.kind, &file.media_type);
            file.title = view.title.clone();
        }
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));

    Ok(FilesListResult {
        schema_version: 1,
        operation: "files.list".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        files,
        summary,
        diagnostics,
    })
}

pub fn workspace_dashboard(
    root: impl AsRef<Path>,
) -> Result<WorkspaceDashboardResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let mut diagnostics = read_operation_diagnostics(discovery.diagnostics);
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    let spaces = discovery
        .index
        .spaces
        .iter()
        .map(|space| DashboardSpace {
            id: space.id.clone(),
            title: space.title.clone(),
            display: space.display.clone(),
            include: space.include.clone(),
            include_patterns: space.include_patterns.clone(),
            entry_count: space.entry_count,
            status: status_for_paths(
                &diagnostics,
                discovery
                    .index
                    .entries
                    .iter()
                    .filter(|entry| entry.space == space.id)
                    .map(|entry| entry.path.as_str()),
            ),
        })
        .collect::<Vec<_>>();

    let entries = discovery
        .index
        .entries
        .iter()
        .map(|entry| DashboardEntrySummary {
            id: document_id_for_path(&entry.path),
            path: entry.path.clone(),
            route_path: entry_route_path_for_path(&entry.path),
            raw_path: entry_raw_path_for_path(&entry.path),
            space: entry.space.clone(),
            kind: entry.kind.clone(),
            title: entry.title.clone(),
            summary: entry.summary.clone(),
            variants: entry
                .variants
                .iter()
                .map(|variant| DashboardEntryVariant {
                    language: variant.language.clone(),
                    path: variant.path.clone(),
                    route_path: entry_route_path_for_path(&variant.path),
                    raw_path: entry_raw_path_for_path(&variant.path),
                    kind: variant.kind.clone(),
                    title: variant.title.clone(),
                    summary: variant.summary.clone(),
                })
                .collect(),
            status: status_for_paths(&diagnostics, std::iter::once(entry.path.as_str())),
            updated_at: file_modified_at(root.as_ref(), &entry.path),
            renderable: true,
        })
        .collect::<Vec<_>>();

    let views = discovery
        .index
        .views
        .iter()
        .map(|view| DashboardViewSummary {
            id: view.id.clone(),
            path: view.path.clone(),
            kind: view.mode.clone(),
            title: view.title.clone(),
            display: view.display.clone(),
            space: view.space.clone().or_else(|| view_taxonomy_space(view)),
        })
        .collect::<Vec<_>>();

    Ok(WorkspaceDashboardResult {
        schema_version: 1,
        operation: "workspace.dashboard".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name.clone(),
            logo: workspace_logo_summary(&workspace.config.workspace),
        },
        spaces,
        entries,
        views,
        summary,
        diagnostics,
    })
}

fn view_taxonomy_space(view: &crate::index::IndexView) -> Option<String> {
    let terms = view.source.as_ref()?.taxonomy.get("spaces")?;
    (terms.len() == 1).then(|| terms[0].clone())
}

fn workspace_logo_summary(workspace: &WorkspaceSettings) -> Option<WorkspaceLogoSummary> {
    let logo = workspace.logo.as_ref()?;
    let path = WorkspacePath::parse_config(&logo.path).ok()?;
    let path = path.as_str();
    if !is_raw_workspace_path_allowed(path) {
        return None;
    }
    if !matches!(
        media_type_for_workspace_path(path),
        Some("image/png" | "image/jpeg" | "image/webp" | "image/svg+xml")
    ) {
        return None;
    }

    Some(WorkspaceLogoSummary {
        url: format!("/raw/{path}"),
        alt: logo.alt.clone().unwrap_or_else(|| workspace.name.clone()),
    })
}

pub fn list_file_references(
    root: impl AsRef<Path>,
    path: &str,
) -> Result<FileReferencesResult, OperationError> {
    let path = normalize_entry_path(path)?;
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let index_entry = discovery
        .index
        .entries
        .iter()
        .find(|entry| entry.path == path)
        .ok_or(OperationError::EntryNotFound)?;
    let mut diagnostics = diagnostics_for_workspace_path(discovery.diagnostics, &path);
    diagnostics.sort_by_key(diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let outgoing = unique_references_by_target(index_entry.refs.iter())
        .into_iter()
        .map(|reference| reference_edge(index_entry, reference, &discovery.index.entries))
        .collect::<Vec<_>>();
    let mut backlinks = discovery
        .index
        .entries
        .iter()
        .filter(|entry| entry.path != path)
        .flat_map(|entry| {
            unique_references_by_target(
                entry
                    .refs
                    .iter()
                    .filter(|reference| reference.target_path == path),
            )
            .into_iter()
            .map(|reference| reference_edge(entry, reference, &discovery.index.entries))
        })
        .collect::<Vec<_>>();
    backlinks.sort_by_key(reference_edge_sort_key);

    Ok(FileReferencesResult {
        schema_version: 1,
        operation: "file.references".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        file: ReferenceFile {
            path: index_entry.path.clone(),
            space: index_entry.space.clone(),
            kind: index_entry.kind.clone(),
            title: index_entry.title.clone(),
        },
        outgoing,
        backlinks,
        summary,
        diagnostics,
    })
}

pub fn knowledge_health(root: impl AsRef<Path>) -> Result<KnowledgeHealthResult, OperationError> {
    let workspace = match load_workspace(root.as_ref(), LoadMode::SharedOnly) {
        Ok(workspace) => workspace,
        Err(error) => {
            return Ok(knowledge_health_failure_result(
                "Unknown Workspace",
                config_error_diagnostic(error),
            ));
        }
    };
    let discovery = match discover_workspace(root.as_ref()) {
        Ok(discovery) => discovery,
        Err(error) => {
            return Ok(knowledge_health_failure_result(
                &workspace.config.workspace.name,
                config_error_diagnostic(error),
            ));
        }
    };
    Ok(build_knowledge_health_result(
        &workspace.config.workspace.name,
        &discovery.index.entries,
        &discovery.diagnostics,
    ))
}

fn knowledge_health_failure_result(
    workspace_name: &str,
    diagnostic: Diagnostic,
) -> KnowledgeHealthResult {
    let finding = knowledge_health_config_finding_from_diagnostic(&diagnostic);
    let diagnostics = vec![knowledge_health_diagnostic(&finding)];
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    KnowledgeHealthResult {
        schema_version: 1,
        operation: "knowledge.health".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace_name.to_string(),
            logo: None,
        },
        findings: vec![finding],
        summary,
        diagnostics,
    }
}

fn build_knowledge_health_result(
    workspace_name: &str,
    entries: &[IndexEntry],
    discovery_diagnostics: &[Diagnostic],
) -> KnowledgeHealthResult {
    let mut findings = discovery_diagnostics
        .iter()
        .filter_map(knowledge_health_finding_from_diagnostic)
        .collect::<Vec<_>>();
    let reference_problem_paths = discovery_diagnostics
        .iter()
        .filter(|diagnostic| is_reference_problem_diagnostic(diagnostic))
        .filter_map(|diagnostic| diagnostic.path.clone())
        .collect::<BTreeSet<_>>();

    let mut inbound_counts = BTreeMap::<String, usize>::new();

    for entry in entries {
        let internal_targets = unique_internal_non_self_reference_targets(&entry.path, &entry.refs);
        if internal_targets.is_empty() && !reference_problem_paths.contains(&entry.path) {
            findings.push(KnowledgeHealthFinding {
                category: KnowledgeHealthCategory::NoOutgoingReferences,
                severity: DiagnosticSeverity::Warning,
                path: entry.path.clone(),
                message: "Entry has no outgoing internal references.".to_string(),
                target: None,
            });
        }

        for target in internal_targets {
            *inbound_counts.entry(target).or_default() += 1;
        }
    }

    for entry in entries {
        if inbound_counts.get(&entry.path).copied().unwrap_or_default() == 0
            && !reference_problem_paths.contains(&entry.path)
        {
            findings.push(KnowledgeHealthFinding {
                category: KnowledgeHealthCategory::NoBacklinks,
                severity: DiagnosticSeverity::Warning,
                path: entry.path.clone(),
                message: "Entry has no inbound internal references.".to_string(),
                target: None,
            });
        }
    }

    findings.sort_by_key(knowledge_health_finding_sort_key);

    let mut diagnostics = findings
        .iter()
        .map(knowledge_health_diagnostic)
        .collect::<Vec<_>>();
    diagnostics.extend(
        discovery_diagnostics
            .iter()
            .filter(|diagnostic| knowledge_health_finding_from_diagnostic(diagnostic).is_none())
            .cloned(),
    );
    diagnostics.sort_by_key(knowledge_health_diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    KnowledgeHealthResult {
        schema_version: 1,
        operation: "knowledge.health".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace_name.to_string(),
            logo: None,
        },
        findings,
        summary,
        diagnostics,
    }
}

fn unique_references_by_target<'a>(
    references: impl IntoIterator<Item = &'a IndexReference>,
) -> Vec<&'a IndexReference> {
    let mut seen = BTreeSet::new();
    references
        .into_iter()
        .filter(|reference| seen.insert(reference.target_path.as_str()))
        .collect()
}

pub(crate) fn diagnostics_for_workspace_path(
    diagnostics: impl IntoIterator<Item = Diagnostic>,
    path: &str,
) -> Vec<Diagnostic> {
    diagnostics
        .into_iter()
        .filter(|diagnostic| diagnostic.path.as_deref() == Some(path))
        .collect()
}

pub(crate) fn diagnostic_sort_key(diagnostic: &Diagnostic) -> (String, String, String) {
    (
        diagnostic.path.clone().unwrap_or_default(),
        diagnostic.code.clone(),
        diagnostic.message.clone(),
    )
}

fn status_for_paths<'a>(
    diagnostics: &[Diagnostic],
    paths: impl Iterator<Item = &'a str>,
) -> OperationStatus {
    let paths = paths.collect::<Vec<_>>();
    let relevant = diagnostics
        .iter()
        .filter(|diagnostic| {
            diagnostic
                .path
                .as_deref()
                .is_some_and(|path| paths.iter().any(|candidate| path == *candidate))
        })
        .cloned()
        .collect::<Vec<_>>();
    DiagnosticSummary::from_diagnostics(&relevant).status()
}

fn document_id_for_path(path: &str) -> String {
    let without_extension = path.strip_suffix(".md").unwrap_or(path);
    let id = without_extension
        .split('/')
        .filter_map(|segment| crate::path::slugify_path_segment(segment).ok())
        .collect::<Vec<_>>()
        .join("--");

    if id.is_empty() {
        path.replace(['/', '.'], "-")
    } else {
        id
    }
}

fn entry_route_path_for_path(path: &str) -> String {
    let without_extension = path.strip_suffix(".md").unwrap_or(path);
    let page_path = without_extension
        .strip_suffix("/index")
        .filter(|value| !value.is_empty())
        .unwrap_or(without_extension);

    format!("/pages/{page_path}")
}

fn entry_raw_path_for_path(path: &str) -> String {
    format!("/raw/{path}")
}

fn file_modified_at(root: &Path, path: &str) -> Option<DateTime<Utc>> {
    let modified = fs::metadata(root.join(path)).ok()?.modified().ok()?;
    Some(modified.into())
}

fn reference_edge(
    source_entry: &IndexEntry,
    reference: &IndexReference,
    entries: &[IndexEntry],
) -> ReferenceEdge {
    let target_entry = entries
        .iter()
        .find(|entry| entry.path == reference.target_path);
    ReferenceEdge {
        source_path: source_entry.path.clone(),
        source_title: source_entry.title.clone(),
        source_kind: source_entry.kind.clone(),
        target_path: reference.target_path.clone(),
        fragment: reference.fragment.clone(),
        fragment_kind: reference.fragment_kind,
        target_title: target_entry
            .and_then(|entry| entry.title.clone())
            .or_else(|| reference.target_title.clone()),
        target_kind: target_entry.and_then(|entry| entry.kind.clone()),
        source: reference.source,
        field: reference.field.clone(),
        semantic_type: reference.semantic_type.clone(),
        intent: reference.intent,
    }
}

fn reference_edge_sort_key(
    edge: &ReferenceEdge,
) -> (String, String, ReferenceIntent, ReferenceSource) {
    (
        edge.source_path.clone(),
        edge.target_path.clone(),
        edge.intent,
        edge.source,
    )
}

fn knowledge_health_finding_from_diagnostic(
    diagnostic: &Diagnostic,
) -> Option<KnowledgeHealthFinding> {
    let path = diagnostic.path.clone().unwrap_or_else(|| ".".to_string());
    match diagnostic.code.as_str() {
        "ref.unresolved" => Some(KnowledgeHealthFinding {
            category: KnowledgeHealthCategory::BrokenReference,
            severity: DiagnosticSeverity::Warning,
            path,
            message: "Reference cannot be resolved.".to_string(),
            target: diagnostic.actual.clone(),
        }),
        "ref.ambiguous" => Some(KnowledgeHealthFinding {
            category: KnowledgeHealthCategory::AmbiguousReference,
            severity: DiagnosticSeverity::Warning,
            path,
            message: "Reference resolves to multiple entries.".to_string(),
            target: diagnostic.actual.clone(),
        }),
        _ if is_config_health_diagnostic(diagnostic) => {
            Some(knowledge_health_config_finding_from_diagnostic(diagnostic))
        }
        _ => None,
    }
}

fn knowledge_health_config_finding_from_diagnostic(
    diagnostic: &Diagnostic,
) -> KnowledgeHealthFinding {
    KnowledgeHealthFinding {
        category: KnowledgeHealthCategory::ConfigDiagnostic,
        severity: diagnostic.severity,
        path: diagnostic.path.clone().unwrap_or_else(|| ".".to_string()),
        message: diagnostic.message.clone(),
        target: diagnostic.actual.clone(),
    }
}

fn is_reference_problem_diagnostic(diagnostic: &Diagnostic) -> bool {
    matches!(
        diagnostic.code.as_str(),
        "ref.unresolved" | "ref.ambiguous" | "ref.transformFailed"
    )
}

fn read_operation_diagnostics(diagnostics: Vec<Diagnostic>) -> Vec<Diagnostic> {
    diagnostics
        .into_iter()
        .map(|mut diagnostic| {
            if matches!(diagnostic.code.as_str(), "ref.unresolved" | "ref.ambiguous") {
                diagnostic.severity = DiagnosticSeverity::Warning;
            }
            diagnostic
        })
        .collect()
}

fn read_operation_diagnostics_for_paths<'a>(
    diagnostics: Vec<Diagnostic>,
    paths: impl IntoIterator<Item = &'a str>,
) -> Vec<Diagnostic> {
    let paths = paths.into_iter().collect::<BTreeSet<_>>();
    read_operation_diagnostics(diagnostics)
        .into_iter()
        .filter(|diagnostic| {
            diagnostic
                .path
                .as_deref()
                .is_some_and(|path| paths.contains(path))
        })
        .collect()
}

fn is_config_health_diagnostic(diagnostic: &Diagnostic) -> bool {
    matches!(
        diagnostic.code.split('.').next(),
        Some("config" | "workspace" | "path" | "space" | "schema" | "taxonomy" | "view")
    )
}

fn unique_internal_non_self_reference_targets(
    source_path: &str,
    references: &[IndexReference],
) -> BTreeSet<String> {
    references
        .iter()
        .filter(|reference| {
            !is_external_reference_target(&reference.target_path)
                && reference.target_path != source_path
        })
        .map(|reference| reference.target_path.clone())
        .collect()
}

fn is_external_reference_target(target: &str) -> bool {
    target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("mailto:")
        || target.starts_with('#')
}

fn knowledge_health_finding_sort_key(
    finding: &KnowledgeHealthFinding,
) -> (String, KnowledgeHealthCategory, String, Option<String>) {
    (
        finding.path.clone(),
        finding.category,
        finding.message.clone(),
        finding.target.clone(),
    )
}

fn knowledge_health_diagnostic(finding: &KnowledgeHealthFinding) -> Diagnostic {
    let diagnostic = match finding.severity {
        DiagnosticSeverity::Error => Diagnostic::error(
            knowledge_health_diagnostic_code(finding.category),
            &finding.message,
        ),
        DiagnosticSeverity::Warning => Diagnostic::warning(
            knowledge_health_diagnostic_code(finding.category),
            &finding.message,
        ),
        DiagnosticSeverity::Info => Diagnostic {
            severity: DiagnosticSeverity::Info,
            code: knowledge_health_diagnostic_code(finding.category).to_string(),
            message: finding.message.clone(),
            path: None,
            location: None,
            actual: None,
            expected: None,
        },
    };

    let diagnostic = diagnostic.with_path(finding.path.clone());
    if let Some(target) = &finding.target {
        diagnostic.with_actual(target.clone())
    } else {
        diagnostic
    }
}

fn knowledge_health_diagnostic_code(category: KnowledgeHealthCategory) -> &'static str {
    match category {
        KnowledgeHealthCategory::BrokenReference => "knowledgeHealth.brokenReference",
        KnowledgeHealthCategory::AmbiguousReference => "knowledgeHealth.ambiguousReference",
        KnowledgeHealthCategory::NoOutgoingReferences => "knowledgeHealth.noOutgoingReferences",
        KnowledgeHealthCategory::NoBacklinks => "knowledgeHealth.noBacklinks",
        KnowledgeHealthCategory::ConfigDiagnostic => "knowledgeHealth.configDiagnostic",
    }
}

fn knowledge_health_diagnostic_sort_key(diagnostic: &Diagnostic) -> (String, String, String) {
    (
        diagnostic.path.clone().unwrap_or_default(),
        diagnostic.code.clone(),
        diagnostic.message.clone(),
    )
}

fn inspect_entry(root: impl AsRef<Path>, path: &str) -> Result<InspectResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_workspace(root.as_ref())?;
    let index_entry = discovery
        .index
        .entries
        .iter()
        .find(|entry| entry.path == path)
        .ok_or(OperationError::EntryNotFound)?;
    let source =
        fs::read_to_string(root.as_ref().join(path)).map_err(|source| OperationError::Io {
            path: path.to_string(),
            source,
        })?;
    let document = FormaMarkdownDocument::parse(&source);
    let mut diagnostics =
        read_operation_diagnostics_for_paths(discovery.diagnostics, std::iter::once(path));
    diagnostics.extend(
        document
            .diagnostics
            .iter()
            .cloned()
            .map(|diagnostic| diagnostic.with_path(path.to_string())),
    );
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let guidelines = applicable_guidelines(&workspace.config, index_entry.space.as_str());

    Ok(InspectResult {
        schema_version: 1,
        operation: "inspect".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        entry: InspectEntry {
            path: path.to_string(),
            space: index_entry.space.clone(),
            guidelines,
            kind: index_entry.kind.clone(),
            title: index_entry.title.clone(),
            summary: index_entry.summary.clone(),
            metadata: document
                .frontmatter
                .value
                .unwrap_or(Value::Mapping(Default::default())),
            headings: Vec::new(),
            refs: index_entry.refs.clone(),
            renderable: true,
        },
        summary,
        diagnostics,
    })
}

fn applicable_guidelines(config: &WorkspaceConfig, space_id: &str) -> Vec<String> {
    let mut guidelines = Vec::new();
    for guideline in config.guidelines.iter().chain(
        config
            .spaces
            .get(space_id)
            .into_iter()
            .flat_map(|space| space.guidelines.iter()),
    ) {
        if !guidelines.contains(guideline) {
            guidelines.push(guideline.clone());
        }
    }
    guidelines
}

fn selected_task_entries(entries: &[IndexEntry]) -> Vec<&IndexEntry> {
    entries
        .iter()
        .filter(|entry| entry.kind.as_deref() == Some("task") || entry.space == "tasks")
        .collect()
}

fn resolve_task_entry<'a>(
    entries: Vec<&'a IndexEntry>,
    path_or_id: &str,
) -> Result<&'a IndexEntry, OperationError> {
    let normalized = normalize_entry_path(path_or_id).ok();
    let normalized_without_extension = normalized
        .as_deref()
        .and_then(|path| path.strip_suffix(".md"))
        .map(ToString::to_string);
    let raw_without_extension = path_or_id
        .strip_suffix(".md")
        .unwrap_or(path_or_id)
        .to_string();

    let exact = entries.iter().copied().find(|entry| {
        entry.path == path_or_id || normalized.as_deref() == Some(entry.path.as_str())
    });
    if let Some(entry) = exact {
        return Ok(entry);
    }

    let id_matches = entries
        .iter()
        .copied()
        .filter(|entry| {
            let id = task_id_from_path(&entry.path);
            id == raw_without_extension
                || normalized_without_extension.as_deref() == Some(id.as_str())
        })
        .collect::<Vec<_>>();
    match id_matches.len() {
        1 => return Ok(id_matches[0]),
        2.. => return Err(OperationError::EntryAmbiguous),
        0 => {}
    }

    let basename_matches = entries
        .iter()
        .copied()
        .filter(|entry| task_basename(&entry.path) == raw_without_extension)
        .collect::<Vec<_>>();
    match basename_matches.len() {
        0 => Err(OperationError::EntryNotFound),
        1 => Ok(basename_matches[0]),
        _ => Err(OperationError::EntryAmbiguous),
    }
}

fn task_summary_from_entry(
    root: &Path,
    entry: &IndexEntry,
) -> Result<(TaskSummary, Vec<Diagnostic>), OperationError> {
    let source =
        fs::read_to_string(root.join(&entry.path)).map_err(|source| OperationError::Io {
            path: entry.path.clone(),
            source,
        })?;
    let document = FormaMarkdownDocument::parse(&source);
    let fallback_title = first_top_level_heading(&document);
    let metadata = document
        .frontmatter
        .value
        .unwrap_or(Value::Mapping(Default::default()));
    let diagnostics = document
        .diagnostics
        .into_iter()
        .map(|diagnostic| diagnostic.with_path(entry.path.clone()))
        .collect::<Vec<_>>();

    Ok((
        TaskSummary {
            path: entry.path.clone(),
            id: task_id_from_path(&entry.path),
            title: string_field_with_fallback(&metadata, &["title", "fields.title"])
                .or_else(|| entry.title.clone())
                .or(fallback_title),
            summary: string_field_with_fallback(&metadata, &["summary", "fields.summary"])
                .or_else(|| entry.summary.clone()),
            status: string_field_with_fallback(&metadata, &["status", "fields.status"]),
            readiness: string_field_with_fallback(&metadata, &["readiness", "fields.readiness"]),
            priority: string_field_with_fallback(&metadata, &["priority", "fields.priority"]),
            owner: string_field_with_fallback(&metadata, &["owner", "fields.owner"]),
            owners: string_list_field_with_fallback(&metadata, &["owners", "fields.owners"]),
            assignees: string_list_field_with_fallback(
                &metadata,
                &["assignees", "fields.assignees"],
            ),
        },
        diagnostics,
    ))
}

fn first_top_level_heading(document: &FormaMarkdownDocument) -> Option<String> {
    document
        .headings
        .iter()
        .find(|heading| heading.level == 1)
        .map(|heading| heading.text.clone())
        .or_else(|| {
            document.body.lines().find_map(|line| {
                let heading = line.strip_prefix("# ")?;
                let heading = heading.trim();
                (!heading.is_empty()).then(|| heading.to_string())
            })
        })
        .filter(|heading| !heading.trim().is_empty())
}

fn task_id_from_path(path: &str) -> String {
    path.strip_suffix(".md").unwrap_or(path).to_string()
}

fn task_basename(path: &str) -> String {
    path.rsplit('/')
        .next()
        .unwrap_or(path)
        .strip_suffix(".md")
        .unwrap_or(path.rsplit('/').next().unwrap_or(path))
        .to_string()
}

const DELIVERY_BOARD_COLUMNS: &[(&str, &str)] = &[
    ("backlog", "Backlog"),
    ("ready", "Ready"),
    ("doing", "Doing"),
    ("reviewing", "Reviewing"),
    ("blocked", "Blocked"),
    ("done", "Done"),
    ("cancelled", "Cancelled"),
];

struct TaskBoard {
    columns: Vec<BoardColumn>,
}

impl TaskBoard {
    fn from_tasks(tasks: Vec<TaskSummary>) -> Self {
        let mut columns = delivery_board_columns();
        for task in tasks {
            let column_id = board_column_id_from_task(&task);
            if let Some(column) = columns.iter_mut().find(|column| column.id == column_id) {
                column
                    .tasks
                    .push(task.with_board_status(column_id.to_string()));
            }
        }
        for column in &mut columns {
            column
                .tasks
                .sort_by(|left, right| left.path.cmp(&right.path));
        }
        Self { columns }
    }
}

impl TaskSummary {
    fn with_board_status(mut self, status: String) -> Self {
        if self.status.is_none() {
            self.status = Some(status);
        }
        self
    }
}

fn delivery_board_columns() -> Vec<BoardColumn> {
    DELIVERY_BOARD_COLUMNS
        .iter()
        .map(|(id, title)| BoardColumn {
            id: (*id).to_string(),
            title: (*title).to_string(),
            tasks: Vec::new(),
        })
        .collect()
}

fn board_column_id_from_title(title: &str) -> Option<&'static str> {
    DELIVERY_BOARD_COLUMNS.iter().find_map(|(id, label)| {
        (id.eq_ignore_ascii_case(title) || label.eq_ignore_ascii_case(title)).then_some(*id)
    })
}

fn board_column_id_from_task(task: &TaskSummary) -> &'static str {
    if let Some(status) = task.status.as_deref().and_then(board_column_id_from_title) {
        return status;
    }

    match task.readiness.as_deref() {
        Some("ready") => "ready",
        Some("blocked") => "blocked",
        _ => "backlog",
    }
}

fn string_field_with_fallback(value: &Value, fields: &[&str]) -> Option<String> {
    fields
        .iter()
        .find_map(|field| value_at_path(value, field).and_then(|value| value.as_str()))
        .map(ToString::to_string)
}

fn string_list_field_with_fallback(value: &Value, fields: &[&str]) -> Option<Vec<String>> {
    fields.iter().find_map(|field| {
        let values = value_at_path(value, field)?
            .as_sequence()?
            .iter()
            .filter_map(Value::as_str)
            .map(ToOwned::to_owned)
            .collect::<Vec<_>>();
        Some(values)
    })
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

fn config_sources(root: &Path) -> Vec<ConfigSource> {
    config_source_paths(root, LoadMode::WithLocalOverrides)
        .unwrap_or_else(|_| {
            vec![crate::config::ConfigSourcePath {
                path: FORMA_CONFIG_PATH.to_string(),
                local: false,
                present: root.join(FORMA_CONFIG_PATH).exists(),
            }]
        })
        .into_iter()
        .map(|source| ConfigSource {
            path: source.path,
            kind: if source.local {
                ConfigSourceKind::Local
            } else {
                ConfigSourceKind::Shared
            },
            present: source.present,
        })
        .collect()
}

fn validate_config_inspect_path(root: &Path, path: &str) -> Result<String, OperationError> {
    let path = WorkspacePath::parse_cli(path)?;
    let path = path.as_str();
    let inspectable = config_source_paths(root, LoadMode::WithLocalOverrides)
        .unwrap_or_default()
        .into_iter()
        .any(|source| source.path == path);
    if inspectable {
        Ok(path.to_string())
    } else {
        Err(OperationError::ConfigPathNotInspectable(path.to_string()))
    }
}

fn inspect_config_value(
    root: &Path,
    path: Option<&str>,
    config: &crate::config::WorkspaceConfig,
) -> Result<Value, OperationError> {
    let Some(path) = path else {
        return Ok(
            serde_yml::to_value(config).unwrap_or_else(|_| Value::Mapping(Default::default()))
        );
    };
    let source = fs::read_to_string(root.join(path)).map_err(|source| OperationError::Io {
        path: path.to_string(),
        source,
    })?;
    if media_type_for_workspace_path(path) == Some("text/markdown") {
        return Ok(FormaMarkdownDocument::parse(&source)
            .frontmatter
            .value
            .unwrap_or(Value::Null));
    }
    serde_yml::from_str(&source).map_err(|source| OperationError::Io {
        path: path.to_string(),
        source: std::io::Error::new(std::io::ErrorKind::InvalidData, source),
    })
}

fn collect_workspace_files(root: &Path) -> Vec<WorkspaceFile> {
    let mut files = Vec::new();
    collect_workspace_files_inner(root, root, &mut files);
    files
}

fn collect_workspace_files_inner(root: &Path, dir: &Path, files: &mut Vec<WorkspaceFile>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if path.is_dir() {
            if should_skip_file_dir(name, &path) {
                continue;
            }
            collect_workspace_files_inner(root, &path, files);
        } else if should_skip_workspace_file(name, &path) {
            continue;
        } else if let Some(file) = workspace_file_from_path(root, path) {
            files.push(file);
        }
    }
}

fn should_skip_file_dir(name: &str, path: &Path) -> bool {
    matches!(name, ".git" | "target" | "node_modules")
        || path.components().any(|component| {
            component.as_os_str() == "local"
                && path.components().any(|part| part.as_os_str() == FORMA_DIR)
        })
}

fn should_skip_workspace_file(_name: &str, _path: &Path) -> bool {
    false
}

fn workspace_file_from_path(root: &Path, path: PathBuf) -> Option<WorkspaceFile> {
    let relative = path
        .strip_prefix(root)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    if !is_raw_workspace_path_allowed(&relative) {
        return None;
    }
    let media_type = media_type_for_workspace_path(&relative)?;
    let kind = if matches!(relative.as_str(), FORMA_CONFIG_PATH) {
        WorkspaceFileKind::Config
    } else if relative.starts_with(".forma/spaces/templates/") && media_type == "text/markdown" {
        WorkspaceFileKind::Template
    } else if media_type == "text/markdown" {
        WorkspaceFileKind::Markdown
    } else {
        WorkspaceFileKind::Resource
    };

    Some(WorkspaceFile {
        name: file_name_from_workspace_path(&relative),
        parent: parent_from_workspace_path(&relative),
        depth: relative.matches('/').count(),
        path: relative,
        kind,
        media_type: media_type.to_string(),
        features: features_for_media_type(kind, media_type),
        space: None,
        title: None,
        frontmatter: frontmatter_from_workspace_file(root, &path),
    })
}

pub fn media_type_for_workspace_path(path: &str) -> Option<&'static str> {
    let extension = path.rsplit_once('.')?.1.to_ascii_lowercase();
    match extension.as_str() {
        "md" | "mdx" => Some("text/markdown"),
        "yml" | "yaml" => Some("application/yaml"),
        "json" => Some("application/json"),
        "txt" => Some("text/plain"),
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "svg" => Some("image/svg+xml"),
        "mp3" => Some("audio/mpeg"),
        "wav" => Some("audio/wav"),
        "ogg" => Some("audio/ogg"),
        "mp4" => Some("video/mp4"),
        "webm" => Some("video/webm"),
        "mov" => Some("video/quicktime"),
        _ => None,
    }
}

pub fn is_raw_workspace_path_allowed(path: &str) -> bool {
    let normalized = path.to_ascii_lowercase();
    normalized != FORMA_CONFIG_PATH && !normalized.starts_with(".forma/")
}

fn features_for_media_type(kind: WorkspaceFileKind, media_type: &str) -> Vec<WorkspaceFileFeature> {
    match kind {
        WorkspaceFileKind::Knowledge => vec![
            WorkspaceFileFeature::RenderMarkdown,
            WorkspaceFileFeature::RenderSource,
        ],
        WorkspaceFileKind::View => vec![
            WorkspaceFileFeature::RenderView,
            WorkspaceFileFeature::RenderSource,
        ],
        WorkspaceFileKind::Template | WorkspaceFileKind::Markdown | WorkspaceFileKind::Config => {
            vec![WorkspaceFileFeature::RenderSource]
        }
        WorkspaceFileKind::Resource
            if media_type.starts_with("image/")
                || media_type.starts_with("audio/")
                || media_type.starts_with("video/") =>
        {
            vec![WorkspaceFileFeature::PreviewMedia]
        }
        WorkspaceFileKind::Resource
            if media_type.starts_with("text/") || media_type == "application/json" =>
        {
            vec![WorkspaceFileFeature::RenderSource]
        }
        WorkspaceFileKind::Resource => Vec::new(),
    }
}

fn frontmatter_from_workspace_file(root: &Path, path: &Path) -> Option<Value> {
    let relative = path.strip_prefix(root).ok()?.to_string_lossy();
    if media_type_for_workspace_path(&relative) != Some("text/markdown") {
        return None;
    }
    let source = fs::read_to_string(path).ok()?;
    FormaMarkdownDocument::parse(&source).frontmatter.value
}

fn file_name_from_workspace_path(path: &str) -> String {
    path.rsplit('/').next().unwrap_or(path).to_string()
}

fn parent_from_workspace_path(path: &str) -> String {
    path.rsplit_once('/')
        .map(|(parent, _)| parent.to_string())
        .unwrap_or_default()
}

fn resolve_space_entry_path(
    entries: &[IndexEntry],
    space: &str,
    entry: &str,
) -> Result<String, OperationError> {
    let entry = entry.strip_suffix(".md").unwrap_or(entry);
    let matches = entries
        .iter()
        .filter(|candidate| {
            candidate.space == space
                && candidate
                    .path
                    .rsplit('/')
                    .next()
                    .and_then(|name| name.strip_suffix(".md"))
                    == Some(entry)
        })
        .map(|entry| entry.path.clone())
        .collect::<Vec<_>>();
    match matches.len() {
        0 => Err(OperationError::EntryNotFound),
        1 => Ok(matches[0].clone()),
        _ => Err(OperationError::EntryAmbiguous),
    }
}

fn normalize_entry_path(path: &str) -> Result<String, OperationError> {
    let normalized = WorkspacePath::parse_cli(path)?;
    let value = normalized.as_str();
    if value.ends_with(".md") {
        Ok(value.to_string())
    } else {
        Ok(format!("{value}.md"))
    }
}

fn write_file(
    root: &Path,
    public_path: &str,
    source: &str,
    created: &mut Vec<String>,
) -> Result<(), OperationError> {
    fs::write(root.join(public_path), source).map_err(|source| OperationError::Io {
        path: public_path.to_string(),
        source,
    })?;
    created.push(public_path.to_string());
    Ok(())
}

fn starter_config_yml(name: &str, language: &str, timezone: &str) -> String {
    STARTER_SETTINGS_YML
        .replace("__WORKSPACE_NAME__", &yaml_string(name))
        .replace("__LANGUAGE__", &yaml_string(language))
        .replace("__TIMEZONE__", &yaml_string(timezone))
}

fn starter_support_nodes() -> Vec<(String, &'static str)> {
    vec![
        (".forma/dashboard.md".to_string(), STARTER_DASHBOARD_MD),
        (
            ".forma/spaces/index.md".to_string(),
            STARTER_SPACES_INDEX_MD,
        ),
        (".forma/spaces/notes.md".to_string(), STARTER_NOTES_TERM_MD),
        (".forma/spaces/tasks.md".to_string(), STARTER_TASKS_TERM_MD),
        (
            ".forma/spaces/members.md".to_string(),
            STARTER_MEMBERS_TERM_MD,
        ),
        (
            ".forma/spaces/decisions.md".to_string(),
            STARTER_DECISIONS_TERM_MD,
        ),
        (
            ".forma/spaces/proposals.md".to_string(),
            STARTER_PROPOSALS_TERM_MD,
        ),
        (
            ".forma/spaces/guidelines.md".to_string(),
            STARTER_GUIDELINES_TERM_MD,
        ),
    ]
}

fn starter_templates() -> Vec<(String, &'static str)> {
    vec![
        (
            ".forma/spaces/templates/note.md".to_string(),
            "---\nkind: note\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\ncreatedAt: \"{{ input.createdAt }}\"\nupdatedAt: \"{{ input.updatedAt }}\"\n---\n\n# {{ input.title }}\n",
        ),
        (
            ".forma/spaces/templates/task.md".to_string(),
            "---\nkind: task\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\nstatus: \"{{ input.status }}\"\nreadiness: \"{{ input.readiness }}\"\npriority: \"{{ input.priority }}\"\nowners: []\nassignees: []\nreviewers: []\nblocked_by: []\ndueDate: \"{{ input.dueDate }}\"\ncreatedAt: \"{{ input.createdAt }}\"\nupdatedAt: \"{{ input.updatedAt }}\"\n---\n\n# {{ input.title }}\n",
        ),
        (
            ".forma/spaces/templates/member.md".to_string(),
            "---\nkind: member\nname: \"{{ input.name }}\"\ndescription: \"{{ input.description }}\"\nresponsibilities: \"{{ input.responsibilities }}\"\ncreatedAt: \"{{ input.createdAt }}\"\nupdatedAt: \"{{ input.updatedAt }}\"\n---\n\n# {{ input.name }}\n",
        ),
        (
            ".forma/spaces/templates/decision.md".to_string(),
            "---\nkind: decision\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\nstatus: \"{{ input.status }}\"\nowners: []\nreviewers: []\nrelated_to: []\ndecidedAt: \"{{ input.decidedAt }}\"\ncreatedAt: \"{{ input.createdAt }}\"\nupdatedAt: \"{{ input.updatedAt }}\"\n---\n\n# {{ input.title }}\n\n## Context\n\n## Decision\n\n## Consequences\n",
        ),
        (
            ".forma/spaces/templates/proposal.md".to_string(),
            "---\nkind: proposal\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\nstatus: \"{{ input.status }}\"\nowners: []\nassignees: []\nreviewers: []\nrelated_to: []\ncreatedAt: \"{{ input.createdAt }}\"\nupdatedAt: \"{{ input.updatedAt }}\"\n---\n\n# {{ input.title }}\n\n## Problem\n\n## Proposed Change\n\n## Expected Outcome\n",
        ),
        (
            ".forma/spaces/templates/guideline.md".to_string(),
            "---\nkind: guideline\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\nowners: []\nreviewers: []\nrelated_to: []\ncreatedAt: \"{{ input.createdAt }}\"\nupdatedAt: \"{{ input.updatedAt }}\"\n---\n\n# {{ input.title }}\n\n## When To Use This\n\n## Guidance\n",
        ),
    ]
}

fn starter_views() -> Vec<(String, &'static str)> {
    vec![
        (
            format!("{FORMA_VIEWS_DIR}/notes.md"),
            "---\nschemaVersion: 1\nkind: view\nmode: table\ntitle: Notes\ndisplay:\n  order: 30\ndescription: Starter guide and feature demonstration notes.\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - notes\ntable:\n  columns:\n    - field: fields.title\n      label: Title\n    - field: fields.summary\n      label: Summary\n    - field: fields.createdAt\n      label: Created\nsort:\n  - field: fields.createdAt\n    direction: desc\n---\n\n# Notes\n\nBrowse guide and feature demonstration pages as a structured table.\n\n<!-- forma:content -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/tasks.md"),
            "---\nschemaVersion: 1\nkind: view\nmode: kanban\ntitle: Tasks\ndisplay:\n  order: 50\ndescription: Example work tracked with status, readiness, and review fields.\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - tasks\nkanban:\n  card:\n    titleField: fields.title\n    subtitleFields:\n      - fields.summary\n      - fields.owners\n      - fields.assignees\n    badgeFields:\n      - fields.priority\n      - fields.readiness\n      - fields.dueDate\n  columns:\n    - id: todo\n      label: To Do\n      query:\n        all:\n          - field: fields.status\n            op: equals\n            value: todo\n      sort:\n        - field: fields.priority\n          order:\n            - high\n            - medium\n            - low\n        - field: fields.updatedAt\n          direction: desc\n        - field: fields.createdAt\n          direction: desc\n    - id: ready\n      label: Ready\n      query:\n        all:\n          - field: fields.status\n            op: equals\n            value: ready\n      sort:\n        - field: fields.priority\n          order:\n            - high\n            - medium\n            - low\n        - field: fields.updatedAt\n          direction: desc\n        - field: fields.createdAt\n          direction: desc\n    - id: doing\n      label: Doing\n      query:\n        all:\n          - field: fields.status\n            op: equals\n            value: doing\n      sort:\n        - field: fields.updatedAt\n          direction: desc\n        - field: fields.createdAt\n          direction: desc\n    - id: blocked\n      label: Blocked\n      query:\n        all:\n          - field: fields.status\n            op: equals\n            value: blocked\n      sort:\n        - field: fields.updatedAt\n          direction: desc\n        - field: fields.createdAt\n          direction: desc\n    - id: reviewing\n      label: Reviewing\n      query:\n        all:\n          - field: fields.status\n            op: equals\n            value: reviewing\n      sort:\n        - field: fields.updatedAt\n          direction: desc\n        - field: fields.createdAt\n          direction: desc\n    - id: done\n      label: Done\n      query:\n        all:\n          - field: fields.status\n            op: equals\n            value: done\n      sort:\n        - field: fields.updatedAt\n          direction: desc\n        - field: fields.createdAt\n          direction: desc\n---\n\n# Tasks\n\nTrack example work by workflow state.\n\n<!-- forma:content -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/members.md"),
            "---\nschemaVersion: 1\nkind: view\nmode: table\ntitle: Members\ndisplay:\n  order: 60\ndescription: Example team members referenced by the starter workspace.\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - members\ntable:\n  columns:\n    - field: fields.name\n      label: Name\n    - field: fields.description\n      label: Description\n    - field: fields.responsibilities\n      label: Responsibilities\nsort:\n  - field: fields.name\n    direction: asc\n---\n\n# Members\n\nList example team members referenced by starter tasks and pages.\n\n<!-- forma:content -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/guide.md"),
            "---\nschemaVersion: 1\nkind: view\nmode: graph\ntitle: Guide\ndisplay:\n  order: 20\ndescription: Graph links between the starter guide pages.\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - notes\n---\n\n# Guide\n\nFocus the graph on guide pages so the starter tour is easier to follow.\n\n<!-- forma:content -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/recent.md"),
            "---\nschemaVersion: 1\nkind: view\nmode: list\ntitle: Recent\ndisplay:\n  order: 40\ndescription: Recently updated starter pages across the main workspace spaces.\nsource:\n  type: pages\n  taxonomy:\n    spaces:\n      - notes\n      - tasks\n      - members\n      - decisions\n      - proposals\n      - guidelines\nsort:\n  - field: fields.updatedAt\n    direction: desc\n  - field: fields.createdAt\n    direction: desc\n---\n\n# Recent\n\nReview recently updated starter pages without changing the underlying files.\n\n<!-- forma:content -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/graph.md"),
            "---\nschemaVersion: 1\nkind: view\nmode: graph\ntitle: Graph\ndisplay:\n  order: 10\ndescription: Graph links across notes, tasks, members, decisions, proposals, and guidelines.\nsource:\n  type: pages\ngraph:\n  edges:\n    - source: body\n      intent: link\n      label: links to\n    - source: body\n      intent: embed\n      label: embeds\n    - source: fields\n      field: owners\n      label: owned by\n    - source: fields\n      field: assignees\n      label: assigned to\n    - source: fields\n      field: reviewers\n      label: reviewed by\n    - source: fields\n      field: blocked_by\n      label: blocked by\n    - source: fields\n      field: related_to\n      label: related to\n---\n\n# Graph\n\nExplore how pages connect across the starter workspace.\n\n<!-- forma:content -->\n",
        ),
    ]
}

pub fn detect_environment_timezone() -> String {
    if let Ok(value) = std::env::var("TZ")
        && !value.trim().is_empty()
    {
        return value;
    }
    if let Ok(target) = fs::read_link("/etc/localtime") {
        let target = target.to_string_lossy();
        if let Some((_, zone)) = target.split_once("zoneinfo/") {
            return zone.to_string();
        }
    }
    "UTC".to_string()
}

fn validate_timezone(timezone: &str) -> Result<(), OperationError> {
    timezone
        .parse::<Tz>()
        .map(|_| ())
        .map_err(|_| OperationError::InvalidTimezone(timezone.to_string()))
}

fn yaml_string(value: &str) -> String {
    serde_json::to_string(value).expect("string values should serialize")
}

pub fn operation_error_diagnostic(error: OperationError) -> Diagnostic {
    match error {
        OperationError::Config(error) => config_error_diagnostic(error),
        OperationError::WorkspaceExists => {
            Diagnostic::error("init.workspaceExists", "Workspace already contains .forma.")
                .with_path(FORMA_DIR)
        }
        OperationError::SpaceNotFound(space) => {
            Diagnostic::error("space.notFound", format!("Space `{space}` was not found."))
        }
        OperationError::CreateNotConfigured(space) => Diagnostic::error(
            "create.notConfigured",
            format!("Space `{space}` does not define create behavior."),
        ),
        OperationError::InvalidInput(input) => {
            Diagnostic::error("operation.inputInvalid", "Operation input is invalid.")
                .with_actual(input)
        }
        OperationError::InvalidPath(error) => Diagnostic::error(
            "path.invalid",
            "Workspace-relative path parameter is invalid.",
        )
        .with_actual(error.to_string()),
        OperationError::ConfigPathNotInspectable(path) => Diagnostic::error(
            "config.pathNotInspectable",
            "Configuration inspect path must reference a known configuration source.",
        )
        .with_path(path),
        OperationError::InvalidTimezone(timezone) => Diagnostic::error(
            "init.timezoneInvalid",
            "Workspace timezone must be a valid IANA timezone.",
        )
        .with_actual(timezone),
        OperationError::EntryNotFound => {
            Diagnostic::error("entry.notFound", "Entry was not found.")
        }
        OperationError::EntryAmbiguous => {
            Diagnostic::error("entry.ambiguous", "Entry locator matched multiple files.")
        }
        OperationError::ViewNotFound(view) => {
            Diagnostic::error("view.notFound", "View was not found.").with_actual(view)
        }
        OperationError::PathConflict(path) => {
            Diagnostic::error("create.pathConflict", "Target path already exists.").with_path(path)
        }
        OperationError::Io { path, source } => {
            Diagnostic::error("file.writeFailed", "File operation failed.")
                .with_path(path)
                .with_actual(source.to_string())
        }
    }
}

const STARTER_GITIGNORE: &str = "local/\n";

const STARTER_SETTINGS_YML: &str = r#"schemaVersion: 1

workspace:
  name: __WORKSPACE_NAME__
  canonicalLanguage: __LANGUAGE__
  supportedLanguages:
    - __LANGUAGE__
  timezone: __TIMEZONE__

include:
  - ".forma/dashboard.md"
  - ".forma/spaces/*.md"
  - ".forma/views/*.md"
  - ".forma/local/*.yml"
  - ".forma/local/*.md"

runtime:
  values:
    currentDateTime:
      kind: currentDateTime
    workspaceRoot:
      kind: workspaceRoot
    currentUserId:
      kind: gitConfig
      key: user.name
      transform: slugify
"#;

const STARTER_DASHBOARD_MD: &str = r#"---
schemaVersion: 1
kind: dashboard
title: Dashboard
sections:
  - id: overview
    title: Workspace overview
    source:
      type: workspace
    display:
      order: 10

  - id: recent
    title: Recent pages
    source:
      type: view
      view: ".forma/views/recent.md"
    display:
      order: 20

  - id: health
    title: Knowledge health
    source:
      type: diagnostics
    display:
      order: 30
---

# {{ workspace.name }}

Use the dashboard to scan recent pages, workspace health, and configured views.

<!-- forma:content -->
"#;

const STARTER_SPACES_INDEX_MD: &str = r#"---
schemaVersion: 1
kind: taxonomy
title: Spaces
mode: primary
display:
  order: 30
description: Primary workspace sections for the starter pages.
---

# Spaces

Browse this workspace by the configured primary taxonomy.

<!-- forma:content -->
"#;

const STARTER_NOTES_TERM_MD: &str = r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
display:
  order: 10
description: Starter guide pages and lightweight knowledge notes.
include:
  - "notes/**/*.md"
create:
  directory: "notes"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/note.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Notes

Starter guide pages and lightweight knowledge notes.

<!-- forma:content -->
"#;

const STARTER_TASKS_TERM_MD: &str = r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
display:
  order: 20
description: Delivery tasks tracked as ordinary Markdown pages.
schema:
  type: object
  fields:
    kind:
      type: string
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    readiness:
      type: string
    priority:
      type: string
    owners:
      type: list
      items:
        type: ref
        target: member
    assignees:
      type: list
      items:
        type: ref
        target: member
    reviewers:
      type: list
      items:
        type: ref
        target: member
    blocked_by:
      type: list
      items:
        type: ref
        target: task
    dueDate:
      type: string
include:
  - "tasks/**/*.md"
create:
  directory: "tasks"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/task.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    status:
      type: select
      default: todo
      options:
        - value: todo
          label: To Do
        - value: ready
          label: Ready
        - value: doing
          label: Doing
        - value: blocked
          label: Blocked
        - value: reviewing
          label: Reviewing
        - value: done
          label: Done
    readiness:
      type: select
      default: needs-refinement
      options:
        - value: needs-refinement
          label: Needs Refinement
        - value: ready
          label: Ready
        - value: blocked
          label: Blocked
        - value: done
          label: Done
    priority:
      type: select
      default: medium
      options:
        - value: high
          label: High
        - value: medium
          label: Medium
        - value: low
          label: Low
    owners:
      type: list
      default: []
    assignees:
      type: list
      default: []
    reviewers:
      type: list
      default: []
    blocked_by:
      type: list
      default: []
    dueDate:
      type: date
      default: ""
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Tasks

Delivery tasks tracked as ordinary Markdown pages.

<!-- forma:content -->
"#;

const STARTER_MEMBERS_TERM_MD: &str = r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Members
display:
  order: 30
description: Team members referenced by tasks, proposals, and shared notes.
schema:
  type: object
  fields:
    kind:
      type: string
    name:
      type: string
    description:
      type: string
    responsibilities:
      type: string
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "members/**/*.md"
create:
  directory: "members"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/member.md"
  inputs:
    name:
      required: true
    description:
      default: ""
    responsibilities:
      default: ""
    slug:
      type: string
      default: "{{ input.name }}"
      transform: slugify
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.name
  summaryField: fields.description
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Members

Team members referenced by tasks, proposals, and shared notes.

<!-- forma:content -->
"#;

const STARTER_DECISIONS_TERM_MD: &str = r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Decisions
display:
  order: 40
description: Short decision records that explain why the workspace is set up this way.
schema:
  type: object
  fields:
    kind:
      type: string
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    owners:
      type: list
      items:
        type: ref
        target: member
    reviewers:
      type: list
      items:
        type: ref
        target: member
    related_to:
      type: list
      items:
        type: ref
    decidedAt:
      type: string
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "decisions/**/*.md"
create:
  directory: "decisions"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/decision.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    status:
      type: select
      default: accepted
      options:
        - value: proposed
          label: Proposed
        - value: accepted
          label: Accepted
        - value: superseded
          label: Superseded
    owners:
      type: list
      default: []
    reviewers:
      type: list
      default: []
    related_to:
      type: list
      default: []
    decidedAt:
      default: "{{ runtime.values.currentDateTime }}"
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Decisions

Short decision records that explain why the workspace is set up this way.

<!-- forma:content -->
"#;

const STARTER_PROPOSALS_TERM_MD: &str = r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Proposals
display:
  order: 50
description: Reviewable changes that may later become notes, tasks, or decisions.
schema:
  type: object
  fields:
    kind:
      type: string
    title:
      type: string
    summary:
      type: string
    status:
      type: string
    owners:
      type: list
      items:
        type: ref
        target: member
    assignees:
      type: list
      items:
        type: ref
        target: member
    reviewers:
      type: list
      items:
        type: ref
        target: member
    related_to:
      type: list
      items:
        type: ref
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "proposals/**/*.md"
create:
  directory: "proposals"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/proposal.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    status:
      type: select
      default: proposed
      options:
        - value: proposed
          label: Proposed
        - value: reviewing
          label: Reviewing
        - value: accepted
          label: Accepted
    owners:
      type: list
      default: []
    assignees:
      type: list
      default: []
    reviewers:
      type: list
      default: []
    related_to:
      type: list
      default: []
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Proposals

Reviewable changes that may later become notes, tasks, or decisions.

<!-- forma:content -->
"#;

const STARTER_GUIDELINES_TERM_MD: &str = r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Guidelines
display:
  order: 60
description: Operating guidance for running and extending the workspace.
schema:
  type: object
  fields:
    kind:
      type: string
    title:
      type: string
    summary:
      type: string
    owners:
      type: list
      items:
        type: ref
        target: member
    reviewers:
      type: list
      items:
        type: ref
        target: member
    related_to:
      type: list
      items:
        type: ref
    createdAt:
      type: string
    updatedAt:
      type: string
include:
  - "guidelines/**/*.md"
create:
  directory: "guidelines"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/guideline.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    owners:
      type: list
      default: []
    reviewers:
      type: list
      default: []
    related_to:
      type: list
      default: []
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
  createdAtField: fields.createdAt
  updatedAtField: fields.updatedAt
---

# Guidelines

Operating guidance for running and extending the workspace.

<!-- forma:content -->
"#;

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_yml::Value;

    use super::{
        KnowledgeHealthCategory, OperationError, WorkspaceFileFeature, board_show,
        build_knowledge_health_result, create_entry, init_workspace, inspect_config,
        inspect_entry_by_path, is_raw_workspace_path_allowed, knowledge_health,
        list_file_references, list_files, tasks_inspect, tasks_list, workspace_dashboard,
    };
    use crate::{
        Diagnostic, FORMA_VIEWS_DIR, IndexEntry, OperationStatus, ReferenceIntent,
        WorkspaceFileKind,
    };

    #[test]
    fn config_inspect_returns_effective_config_sources_and_diagnostics() {
        let root = fixture_root("config-inspect");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Config Test", "en", Some("UTC")).unwrap();

        let result = inspect_config(&root, None).unwrap();

        assert_eq!(result.operation, "config.inspect");
        assert_eq!(result.status, OperationStatus::Passed);
        assert_eq!(result.workspace.name, "Config Test");
        assert_eq!(
            result.config["workspace"]["timezone"],
            Value::String("UTC".to_string())
        );
        assert!(
            result
                .sources
                .iter()
                .any(|source| source.path == ".forma.yml" && source.present)
        );
        assert!(result.sources.iter().all(|source| source.present));

        let narrowed = inspect_config(&root, Some(".forma.yml")).unwrap();
        assert_eq!(
            narrowed.config["workspace"]["name"],
            Value::String("Config Test".to_string())
        );
        assert!(narrowed.config.get("include").is_some());

        fs::write(root.join("notes.yml"), "secret: value").unwrap();
        assert!(matches!(
            inspect_config(&root, Some("notes.yml")),
            Err(OperationError::ConfigPathNotInspectable(path)) if path == "notes.yml"
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_uses_path_derived_entry_ids() {
        let root = fixture_root("dashboard-entry-ids");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Dashboard IDs", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/shared.md"),
            "---\nkind: note\ntitle: Note Shared\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Note Shared\n",
        )
        .unwrap();
        fs::write(
            root.join("tasks/shared.md"),
            "---\nkind: task\ntitle: Task Shared\nsummary: \"\"\nstatus: todo\nreadiness: ready\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Task Shared\n",
        )
        .unwrap();

        let result = workspace_dashboard(&root).unwrap();
        let ids = result
            .entries
            .iter()
            .map(|entry| entry.id.as_str())
            .collect::<Vec<_>>();

        assert!(ids.contains(&"notes--shared"));
        assert!(ids.contains(&"tasks--shared"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_exposes_page_and_raw_paths_for_markdown_entries() {
        let root = fixture_root("dashboard-page-paths");
        fs::create_dir_all(root.join("notes/nested")).unwrap();
        init_workspace(&root, "Dashboard Page Paths", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/topic.md"),
            "---\nkind: note\ntitle: Topic\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Topic\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/nested/index.md"),
            "---\nkind: note\ntitle: Nested Topic\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Nested Topic\n",
        )
        .unwrap();

        let result = workspace_dashboard(&root).unwrap();
        let topic = result
            .entries
            .iter()
            .find(|entry| entry.path == "notes/topic.md")
            .unwrap();
        let nested = result
            .entries
            .iter()
            .find(|entry| entry.path == "notes/nested/index.md")
            .unwrap();

        assert_eq!(topic.route_path, "/pages/notes/topic");
        assert_eq!(topic.raw_path, "/raw/notes/topic.md");
        assert_eq!(nested.route_path, "/pages/notes/nested");
        assert_eq!(nested.raw_path, "/raw/notes/nested/index.md");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_exposes_language_variants_for_canonical_entries() {
        let root = fixture_root("dashboard-language-variants");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Dashboard Language Variants", "en", Some("UTC")).unwrap();
        fs::write(
            root.join(".forma.yml"),
            r#"schemaVersion: 1
workspace:
  name: Dashboard Language Variants
  canonicalLanguage: en
  supportedLanguages:
    - en
    - zh-Hans
  timezone: UTC
include:
  - .forma/spaces/*.md
  - .forma/views/*.md
"#,
        )
        .unwrap();
        fs::write(
            root.join("notes/topic.md"),
            "---\nkind: note\ntitle: Topic\nsummary: Canonical summary\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Topic\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/topic.zh-hans.md"),
            "---\nkind: note\ntitle: Topic ZH\nsummary: Variant summary\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Topic ZH\n",
        )
        .unwrap();

        let result = workspace_dashboard(&root).unwrap();
        let topic = result
            .entries
            .iter()
            .find(|entry| entry.path == "notes/topic.md")
            .unwrap();

        assert_eq!(topic.variants.len(), 1);
        assert_eq!(topic.variants[0].language, "zh-Hans");
        assert_eq!(topic.variants[0].path, "notes/topic.zh-hans.md");
        assert_eq!(topic.variants[0].route_path, "/pages/notes/topic.zh-hans");
        assert_eq!(topic.variants[0].raw_path, "/raw/notes/topic.zh-hans.md");
        assert_eq!(topic.variants[0].title.as_deref(), Some("Topic ZH"));
        assert_eq!(
            topic.variants[0].summary.as_deref(),
            Some("Variant summary")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_exposes_configured_workspace_logo() {
        let root = fixture_root("dashboard-workspace-logo");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Logo Workspace", "en", Some("UTC")).unwrap();
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(
            root.join(".forma.yml"),
            r#"schemaVersion: 1

workspace:
  name: "Logo Workspace"
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"
  logo:
    path: "assets/logo.svg"
    alt: "Logo Alt"
include:
  - ".forma/spaces/*.md"
  - ".forma/views/*.md"
"#,
        )
        .unwrap();
        fs::write(root.join("assets/logo.svg"), "<svg></svg>").unwrap();

        let result = workspace_dashboard(&root).unwrap();
        let logo = result.workspace.logo.unwrap();

        assert_eq!(logo.url, "/raw/assets/logo.svg");
        assert_eq!(logo.alt, "Logo Alt");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_view_summary_uses_space_field() {
        let root = fixture_root("dashboard-view-space");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Dashboard Views", "en", Some("UTC")).unwrap();

        let result = workspace_dashboard(&root).unwrap();
        let notes_view = result.views.iter().find(|view| view.id == "notes").unwrap();
        let value = serde_json::to_value(notes_view).unwrap();

        assert_eq!(value["space"], serde_json::json!("notes"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_sorts_spaces_and_views_by_display_order() {
        let root = fixture_root("dashboard-display-order");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Dashboard Display Order", "en", Some("UTC")).unwrap();

        for (path, order) in [
            (".forma/spaces/notes.md", 30),
            (".forma/spaces/tasks.md", 10),
            (".forma/spaces/members.md", 20),
        ] {
            let source = fs::read_to_string(root.join(path)).unwrap();
            fs::write(
                root.join(path),
                source.replace(
                    "display:\n  order:",
                    &format!("display:\n  order: {order}\n#"),
                ),
            )
            .unwrap();
        }
        fs::remove_dir_all(root.join(FORMA_VIEWS_DIR)).unwrap();
        fs::create_dir_all(root.join(FORMA_VIEWS_DIR)).unwrap();
        fs::write(
            root.join(format!("{FORMA_VIEWS_DIR}/alpha.md")),
            "---\nkind: view\nmode: table\ntitle: Alpha\ndisplay:\n  order: 20\nsource:\n  type: pages\n---\n\n# Alpha\n\n<!-- forma:content -->\n",
        )
        .unwrap();
        fs::write(
            root.join(format!("{FORMA_VIEWS_DIR}/beta.md")),
            "---\nkind: view\nmode: table\ntitle: Beta\nsource:\n  type: pages\n---\n\n# Beta\n\n<!-- forma:content -->\n",
        )
        .unwrap();
        fs::write(
            root.join(format!("{FORMA_VIEWS_DIR}/zeta.md")),
            "---\nkind: view\nmode: graph\ntitle: Zeta\ndisplay:\n  order: 10\nsource:\n  type: pages\n---\n\n# Zeta\n\n<!-- forma:content -->\n",
        )
        .unwrap();

        let result = workspace_dashboard(&root).unwrap();

        assert_eq!(
            result
                .spaces
                .iter()
                .map(|space| space.id.as_str())
                .collect::<Vec<_>>(),
            vec![
                "tasks",
                "members",
                "notes",
                "decisions",
                "proposals",
                "guidelines"
            ]
        );
        assert_eq!(
            result
                .views
                .iter()
                .map(|view| view.id.as_str())
                .collect::<Vec<_>>(),
            vec!["zeta", "alpha", "beta"]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_returns_navigation_files_with_entry_and_view_classification() {
        let root = fixture_root("files-list");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Files Test", "en", Some("UTC")).unwrap();
        create_entry(
            &root,
            "notes",
            [(
                "title".to_string(),
                Value::String("Navigation Note".to_string()),
            )]
            .into(),
        )
        .unwrap();

        let result = list_files(&root).unwrap();

        assert_eq!(result.operation, "files.list");
        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.files.iter().any(|file| {
            file.path == "notes/navigation-note.md"
                && file.name == "navigation-note.md"
                && file.parent == "notes"
                && file.depth == 1
                && file.kind == WorkspaceFileKind::Knowledge
                && file.features
                    == vec![
                        WorkspaceFileFeature::RenderMarkdown,
                        WorkspaceFileFeature::RenderSource,
                    ]
                && file.space.as_deref() == Some("notes")
                && file.title.as_deref() == Some("Navigation Note")
                && file
                    .frontmatter
                    .as_ref()
                    .and_then(|value| value.get("title"))
                    == Some(&Value::String("Navigation Note".to_string()))
        }));
        assert!(result.files.iter().all(|file| {
            !file.path.starts_with(".forma/")
                && !matches!(
                    file.kind,
                    WorkspaceFileKind::View
                        | WorkspaceFileKind::Template
                        | WorkspaceFileKind::Config
                )
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_entry_from_repository_starter_templates_uses_in_memory_index() {
        let root = fixture_root("repository-starter-create");
        copy_dir_all(repository_root().join("examples/forma-starter-kit"), &root).unwrap();

        let result = create_entry(
            &root,
            "tasks",
            [(
                "title".to_string(),
                Value::String("Review Starter Create".to_string()),
            )]
            .into(),
        )
        .unwrap();
        let source = fs::read_to_string(root.join("tasks/review-starter-create.md")).unwrap();
        assert!(source.contains("kind: task"));
        assert!(source.contains("title: \"Review Starter Create\""));
        assert!(source.contains("assignees: []"));

        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.diagnostics.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn init_workspace_reports_created_files() {
        let root = fixture_root("init-created-files");
        fs::create_dir_all(&root).unwrap();

        let result = init_workspace(&root, "Created Files Workspace", "en", Some("UTC")).unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.created.iter().any(|path| path == ".forma.yml"));
        assert!(
            result
                .created
                .iter()
                .any(|path| path == ".forma/spaces/tasks.md")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn init_workspace_includes_template_kinds() {
        let root = fixture_root("init-create-kind");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Template Kind Test", "en", Some("UTC")).unwrap();

        create_entry(
            &root,
            "notes",
            [(
                "title".to_string(),
                Value::String("Kinded Note".to_string()),
            )]
            .into(),
        )
        .unwrap();
        create_entry(
            &root,
            "tasks",
            [(
                "title".to_string(),
                Value::String("Kinded Task".to_string()),
            )]
            .into(),
        )
        .unwrap();
        create_entry(
            &root,
            "members",
            [(
                "name".to_string(),
                Value::String("Kinded Member".to_string()),
            )]
            .into(),
        )
        .unwrap();

        let note = fs::read_to_string(root.join("notes/kinded-note.md")).unwrap();
        let task = fs::read_to_string(root.join("tasks/kinded-task.md")).unwrap();
        let member = fs::read_to_string(root.join("members/kinded-member.md")).unwrap();
        assert!(note.contains("kind: note"));
        assert!(task.contains("kind: task"));
        assert!(task.contains("readiness: \"needs-refinement\""));
        assert!(member.contains("kind: member"));
        assert!(root.join(".forma/dashboard.md").is_file());
        assert!(root.join(".forma/views/tasks.md").is_file());
        assert!(root.join(".forma/spaces/templates/guideline.md").is_file());
        assert!(root.join("tasks").is_dir());
        assert!(root.join("members").is_dir());
        assert!(root.join("decisions").is_dir());
        assert!(root.join("proposals").is_dir());
        assert!(root.join("guidelines").is_dir());
        assert!(!root.join("todos").exists());
        assert!(!root.join("users").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_returns_workspace_files_with_neutral_kinds() {
        let root = fixture_root("workspace-file-kinds");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Workspace File Kinds", "en", Some("UTC")).unwrap();
        create_entry(
            &root,
            "notes",
            [(
                "title".to_string(),
                Value::String("Neutral File Model".to_string()),
            )]
            .into(),
        )
        .unwrap();

        let result = list_files(&root).unwrap();

        let knowledge = result
            .files
            .iter()
            .find(|file| file.path == "notes/neutral-file-model.md")
            .unwrap();
        assert_eq!(knowledge.kind, WorkspaceFileKind::Knowledge);
        let knowledge_json = serde_json::to_value(knowledge).unwrap();
        assert_eq!(knowledge_json["kind"], serde_json::json!("knowledge"));
        assert_eq!(knowledge.space.as_deref(), Some("notes"));
        assert_eq!(knowledge.title.as_deref(), Some("Neutral File Model"));

        assert!(result.files.iter().all(|file| {
            !matches!(
                file.kind,
                WorkspaceFileKind::View | WorkspaceFileKind::Template | WorkspaceFileKind::Config
            )
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_reports_media_type_and_resource_preview_features() {
        let root = fixture_root("workspace-file-media-types");
        fs::create_dir_all(root.join("assets")).unwrap();
        init_workspace(&root, "Media Type Test", "en", Some("UTC")).unwrap();
        fs::write(root.join("assets/logo.png"), b"\x89PNG\r\n\x1a\n").unwrap();
        fs::write(root.join("assets/clip.mp3"), b"ID3").unwrap();
        fs::write(root.join("assets/demo.mp4"), b"\0\0\0\x18ftypmp42").unwrap();
        fs::write(root.join("assets/data.json"), br#"{"ok":true}"#).unwrap();

        let result = list_files(&root).unwrap();

        let logo = result
            .files
            .iter()
            .find(|file| file.path == "assets/logo.png")
            .unwrap();
        assert_eq!(logo.kind, WorkspaceFileKind::Resource);
        assert_eq!(logo.media_type, "image/png");
        assert_eq!(logo.features, vec![WorkspaceFileFeature::PreviewMedia]);
        let logo_json = serde_json::to_value(logo).unwrap();
        assert_eq!(logo_json["kind"], serde_json::json!("resource"));
        assert_eq!(logo_json["mediaType"], serde_json::json!("image/png"));
        assert_eq!(logo_json["features"], serde_json::json!(["preview.media"]));

        let clip = result
            .files
            .iter()
            .find(|file| file.path == "assets/clip.mp3")
            .unwrap();
        assert_eq!(clip.media_type, "audio/mpeg");
        assert_eq!(clip.features, vec![WorkspaceFileFeature::PreviewMedia]);

        let demo = result
            .files
            .iter()
            .find(|file| file.path == "assets/demo.mp4")
            .unwrap();
        assert_eq!(demo.media_type, "video/mp4");
        assert_eq!(demo.features, vec![WorkspaceFileFeature::PreviewMedia]);

        let data = result
            .files
            .iter()
            .find(|file| file.path == "assets/data.json")
            .unwrap();
        assert_eq!(data.kind, WorkspaceFileKind::Resource);
        assert_eq!(data.media_type, "application/json");
        assert_eq!(data.features, vec![WorkspaceFileFeature::RenderSource]);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_excludes_local_only_override_files() {
        let root = fixture_root("files-list-local-only");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Local Only Test", "en", Some("UTC")).unwrap();
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(root.join(".forma/local/profile.yml"), "spaces: {}\n").unwrap();

        let result = list_files(&root).unwrap();

        assert!(
            !result
                .files
                .iter()
                .any(|file| file.path == ".forma/local/profile.yml")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn tasks_list_and_inspect_read_frontmatter_metadata() {
        let root = fixture_root("tasks-operations");
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        fs::create_dir_all(root.join("knowledge/tasks/subgroup")).unwrap();
        fs::write(
            root.join(".forma.yml"),
            r#"schemaVersion: 1
workspace:
  name: Task Operations
  canonicalLanguage: en
  supportedLanguages:
    - en
  timezone: UTC
guidelines:
  - knowledge/guidelines/operations.md
include:
  - .forma/spaces/*.md
"#,
        )
        .unwrap();
        fs::write(
            root.join("knowledge/guidelines/operations.md"),
            "---\ntitle: Operations\n---\n\n# Operations\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/guidelines/tasks.md"),
            "---\ntitle: Tasks\n---\n\n# Tasks\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/tasks.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
guidelines:
  - knowledge/guidelines/operations.md
  - knowledge/guidelines/tasks.md
include:
  - knowledge/tasks/**/*.md
create:
  directory: knowledge/tasks
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/task.md
  inputs:
    title:
      required: true
    slug:
      default: "{{ input.title }}"
      transform: slugify
conventions:
  titleField: title
  summaryField: summary
---

# Tasks
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/task.md"),
            "---\nkind: task\ntitle: \"{{ input.title }}\"\nsummary: \"\"\n---\n\n# {{ input.title }}\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/ship-cli.md"),
            r#"---
schemaVersion: 1
kind: task
summary: Add CLI task inventory commands.
readiness: ready
priority: P0
owner: Tiscs
owners: []
assignees: []
---

# Ship CLI

See [[knowledge/tasks/missing-task]].
"#,
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/subgroup/legacy.md"),
            r#"---
schemaVersion: 1
kind: note
fields:
  title: Legacy Task
  summary: Support fixture compatibility.
  status: todo
  priority: P2
  owners: []
  assignees: []
---

# Legacy Task
"#,
        )
        .unwrap();

        let list = tasks_list(&root).unwrap();
        assert_eq!(list.operation, "tasks.list");
        assert_eq!(list.status, OperationStatus::Warning);
        assert_eq!(list.summary.errors, 0);
        assert_eq!(list.summary.warnings, 1);
        assert_eq!(list.tasks.len(), 2);
        assert_eq!(list.tasks[0].path, "knowledge/tasks/ship-cli.md");
        assert_eq!(list.tasks[0].id, "knowledge/tasks/ship-cli");
        assert_eq!(list.tasks[0].readiness.as_deref(), Some("ready"));
        assert_eq!(list.tasks[0].priority.as_deref(), Some("P0"));
        assert_eq!(list.tasks[0].owner.as_deref(), Some("Tiscs"));
        assert_eq!(list.tasks[0].owners, Some(Vec::new()));
        assert_eq!(list.tasks[0].assignees, Some(Vec::new()));
        assert_eq!(list.tasks[1].path, "knowledge/tasks/subgroup/legacy.md");
        assert_eq!(list.tasks[1].status.as_deref(), Some("todo"));
        assert_eq!(list.tasks[1].owners, Some(Vec::new()));
        assert_eq!(list.tasks[1].assignees, Some(Vec::new()));

        let inspect = tasks_inspect(&root, "ship-cli").unwrap();
        assert_eq!(inspect.operation, "tasks.inspect");
        assert_eq!(inspect.status, OperationStatus::Warning);
        assert_eq!(inspect.summary.errors, 0);
        assert_eq!(inspect.summary.warnings, 1);
        assert_eq!(inspect.task.path, "knowledge/tasks/ship-cli.md");
        assert_eq!(inspect.task.title.as_deref(), Some("Ship CLI"));
        assert_eq!(
            inspect.task.summary.as_deref(),
            Some("Add CLI task inventory commands.")
        );
        assert_eq!(
            inspect.guidelines,
            vec![
                "knowledge/guidelines/operations.md".to_string(),
                "knowledge/guidelines/tasks.md".to_string()
            ]
        );

        let entry_inspect = inspect_entry_by_path(&root, "knowledge/tasks/ship-cli.md").unwrap();
        assert_eq!(
            entry_inspect.entry.guidelines,
            vec![
                "knowledge/guidelines/operations.md".to_string(),
                "knowledge/guidelines/tasks.md".to_string()
            ]
        );

        let legacy = tasks_inspect(&root, "legacy").unwrap();
        assert_eq!(legacy.status, OperationStatus::Passed);
        assert_eq!(legacy.summary.warnings, 0);
        assert!(legacy.diagnostics.is_empty());
        assert_eq!(legacy.task.path, "knowledge/tasks/subgroup/legacy.md");
        assert_eq!(legacy.task.status.as_deref(), Some("todo"));
        assert!(matches!(
            tasks_inspect(&root, "missing"),
            Err(OperationError::EntryNotFound)
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn board_show_groups_tasks_by_delivery_columns() {
        let root = fixture_root("board-show-operations");
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join("knowledge/tasks")).unwrap();
        fs::write(
            root.join(".forma.yml"),
            r#"schemaVersion: 1
workspace:
  name: Board Operations
  canonicalLanguage: en
  supportedLanguages:
    - en
  timezone: UTC
include:
  - .forma/spaces/*.md
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/tasks.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
include:
  - knowledge/tasks/**/*.md
create:
  directory: knowledge/tasks
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/task.md
  inputs:
    title:
      required: true
    slug:
      default: "{{ input.title }}"
      transform: slugify
conventions:
  titleField: title
  summaryField: summary
---

# Tasks
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/task.md"),
            "---\nkind: task\ntitle: \"{{ input.title }}\"\nsummary: \"\"\n---\n\n# {{ input.title }}\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/charlie.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Charlie\nsummary: Blocked\nreadiness: blocked\n---\n\n# Charlie\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/alpha.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Alpha\nsummary: Needs refinement\n---\n\n# Alpha\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/bravo.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Bravo\nsummary: Ready\nreadiness: ready\n---\n\n# Bravo\n",
        )
        .unwrap();

        let result = board_show(&root).unwrap();
        assert_eq!(result.operation, "board.show");
        assert_eq!(result.columns.len(), 7);
        assert_eq!(result.columns[0].id, "backlog");
        assert_eq!(result.columns[0].title, "Backlog");
        assert_eq!(result.columns[0].tasks.len(), 1);
        assert_eq!(result.columns[0].tasks[0].path, "knowledge/tasks/alpha.md");
        assert_eq!(result.columns[1].id, "ready");
        assert_eq!(result.columns[1].tasks[0].path, "knowledge/tasks/bravo.md");
        assert_eq!(result.columns[2].id, "doing");
        assert!(result.columns[2].tasks.is_empty());
        assert_eq!(result.columns[3].id, "reviewing");
        assert!(result.columns[3].tasks.is_empty());
        assert_eq!(result.columns[4].id, "blocked");
        assert_eq!(
            result.columns[4].tasks[0].path,
            "knowledge/tasks/charlie.md"
        );
        assert_eq!(result.columns[5].id, "done");
        assert!(result.columns[5].tasks.is_empty());
        assert_eq!(result.columns[6].id, "cancelled");
        assert!(result.columns[6].tasks.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn board_show_uses_task_status_columns_when_available() {
        let root = fixture_root("board-show-status-operations");
        fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
        fs::create_dir_all(root.join("knowledge/tasks")).unwrap();
        fs::write(
            root.join(".forma.yml"),
            r#"schemaVersion: 1
workspace:
  name: Board Operations
  canonicalLanguage: en
  supportedLanguages:
    - en
  timezone: UTC
include:
  - .forma/spaces/*.md
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/tasks.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
include:
  - knowledge/tasks/**/*.md
create:
  directory: knowledge/tasks
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/task.md
  inputs:
    title:
      required: true
    slug:
      default: "{{ input.title }}"
      transform: slugify
conventions:
  titleField: title
  summaryField: summary
---

# Tasks
"#,
        )
        .unwrap();
        fs::write(
            root.join(".forma/spaces/templates/task.md"),
            "---\nkind: task\ntitle: \"{{ input.title }}\"\nsummary: \"\"\n---\n\n# {{ input.title }}\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/alpha.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Alpha\nsummary: Done task.\nstatus: done\n---\n\n# Alpha\n",
        )
        .unwrap();
        fs::write(
            root.join("knowledge/tasks/bravo.md"),
            "---\nschemaVersion: 1\nkind: task\ntitle: Bravo\nsummary: Doing task.\nstatus: doing\nreadiness: ready\n---\n\n# Bravo\n",
        )
        .unwrap();

        let result = board_show(&root).unwrap();
        assert_eq!(result.columns[2].id, "doing");
        assert_eq!(result.columns[2].tasks[0].path, "knowledge/tasks/bravo.md");
        assert_eq!(result.columns[2].tasks[0].status.as_deref(), Some("doing"));
        assert_eq!(result.columns[5].id, "done");
        assert_eq!(result.columns[5].tasks[0].path, "knowledge/tasks/alpha.md");
        assert_eq!(result.columns[5].tasks[0].status.as_deref(), Some("done"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn raw_workspace_path_policy_excludes_local_only_files() {
        assert!(!is_raw_workspace_path_allowed(".forma/local/profile.yml"));
        assert!(!is_raw_workspace_path_allowed(".forma/local/cache.json"));
        assert!(!is_raw_workspace_path_allowed(".forma.yml"));
        assert!(!is_raw_workspace_path_allowed(".forma/assets/logo.svg"));
        assert!(is_raw_workspace_path_allowed("notes/public.md"));
    }

    #[test]
    fn file_references_returns_outgoing_references_and_backlinks() {
        let root = fixture_root("references-list");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "References Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/alpha.md"),
            "---\nkind: note\ntitle: Alpha\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Alpha\n\nSee [[notes/beta|Beta]] and [External Guide](https://example.com/guide). Repeat [[notes/beta|Beta again]].\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/beta.md"),
            "---\nkind: note\ntitle: Beta\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Beta\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/gamma.md"),
            "---\nkind: note\ntitle: Gamma\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Gamma\n\nBack to [[notes/alpha]].\n",
        )
        .unwrap();

        let result = list_file_references(&root, "notes/alpha.md").unwrap();

        assert_eq!(result.operation, "file.references");
        assert_eq!(result.status, OperationStatus::Passed);
        assert_eq!(result.file.path, "notes/alpha.md");
        assert_eq!(result.file.title.as_deref(), Some("Alpha"));
        assert_eq!(result.outgoing.len(), 2);
        assert_eq!(
            result
                .outgoing
                .iter()
                .map(|reference| reference.target_path.as_str())
                .collect::<Vec<_>>(),
            vec!["notes/beta.md", "https://example.com/guide"]
        );
        let beta = result
            .outgoing
            .iter()
            .find(|reference| reference.target_path == "notes/beta.md")
            .unwrap();
        assert_eq!(beta.source_path, "notes/alpha.md");
        assert_eq!(beta.target_title.as_deref(), Some("Beta"));
        assert_eq!(beta.intent, ReferenceIntent::Link);
        let external = result
            .outgoing
            .iter()
            .find(|reference| reference.target_path == "https://example.com/guide")
            .unwrap();
        assert_eq!(external.source_path, "notes/alpha.md");
        assert_eq!(external.target_title.as_deref(), Some("External Guide"));
        assert_eq!(external.intent, ReferenceIntent::Link);
        assert_eq!(result.backlinks.len(), 1);
        assert_eq!(result.backlinks[0].source_path, "notes/gamma.md");
        assert_eq!(result.backlinks[0].source_title.as_deref(), Some("Gamma"));
        assert_eq!(result.backlinks[0].target_path, "notes/alpha.md");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_references_reports_only_selected_document_diagnostics() {
        let root = fixture_root("references-scoped-diagnostics");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "References Scoped Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/broken.md"),
            "---\nkind: note\nsummary: Missing title\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Broken\n",
        )
        .unwrap();

        let result = list_file_references(&root, "notes/source.md").unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.diagnostics.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_references_returns_empty_relationships_for_isolated_entries() {
        let root = fixture_root("references-empty");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "References Empty Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/solo.md"),
            "---\nkind: note\ntitle: Solo\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Solo\n",
        )
        .unwrap();

        let result = list_file_references(&root, "notes/solo.md").unwrap();

        assert_eq!(result.operation, "file.references");
        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.outgoing.is_empty());
        assert!(result.backlinks.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_references_rejects_missing_entries() {
        let root = fixture_root("references-missing");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "References Missing Test", "en", Some("UTC")).unwrap();

        assert!(matches!(
            list_file_references(&root, "notes/missing.md"),
            Err(OperationError::EntryNotFound)
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn knowledge_health_reports_broken_references_and_orphan_pages() {
        let root = fixture_root("knowledge-health-broken");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Knowledge Health Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/linked.md"),
            "---\nkind: note\ntitle: Linked\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Linked\n\nMissing [[notes/missing]].\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/orphan.md"),
            "---\nkind: note\ntitle: Orphan\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Orphan\n",
        )
        .unwrap();

        let result = knowledge_health(&root).unwrap();

        assert_eq!(result.operation, "knowledge.health");
        assert_eq!(result.status, OperationStatus::Warning);
        assert_eq!(result.workspace.root, ".");
        assert_eq!(result.workspace.name, "Knowledge Health Test");
        assert!(result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::BrokenReference
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::NoOutgoingReferences
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::NoBacklinks
                && finding.path == "notes/linked.md"
        }));
        assert!(result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::NoBacklinks
                && finding.path == "notes/orphan.md"
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn knowledge_health_reports_self_links_as_isolated() {
        let root = fixture_root("knowledge-health-self-link");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Knowledge Health Self Link", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/self.md"),
            "---\nkind: note\ntitle: Self\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Self\n\nSee [[notes/self]].\n",
        )
        .unwrap();

        let result = knowledge_health(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Warning);
        assert!(result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::NoOutgoingReferences
                && finding.path == "notes/self.md"
        }));
        assert!(result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::NoBacklinks
                && finding.path == "notes/self.md"
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn knowledge_health_reports_config_diagnostic_for_missing_workspace_root() {
        let root = fixture_root("knowledge-health-missing-forma");
        fs::create_dir_all(&root).unwrap();

        let result = knowledge_health(&root).unwrap();

        assert_eq!(result.operation, "knowledge.health");
        assert_eq!(result.status, OperationStatus::Failed);
        assert_eq!(result.workspace.root, ".");
        assert_eq!(result.workspace.name, "Unknown Workspace");
        assert_eq!(result.findings.len(), 1);
        assert_eq!(
            result.findings[0].category,
            KnowledgeHealthCategory::ConfigDiagnostic
        );
        assert_eq!(result.findings[0].path, ".");
        assert_eq!(result.summary.errors, 1);
        assert_eq!(result.summary.warnings, 0);
        assert_eq!(result.diagnostics.len(), 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn knowledge_health_passes_for_clean_workspace() {
        let root = fixture_root("knowledge-health-clean");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "Knowledge Health Clean", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/alpha.md"),
            "---\nkind: note\ntitle: Alpha\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Alpha\n\nSee [[notes/beta]].\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/beta.md"),
            "---\nkind: note\ntitle: Beta\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Beta\n\nSee [[notes/alpha]].\n",
        )
        .unwrap();

        let result = knowledge_health(&root).unwrap();

        assert_eq!(result.operation, "knowledge.health");
        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.findings.is_empty());
        assert!(result.diagnostics.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn knowledge_health_preserves_transform_failed_diagnostics_without_isolation_findings() {
        let entries = vec![IndexEntry {
            path: "notes/linked.md".to_string(),
            space: "notes".to_string(),
            kind: Some("note".to_string()),
            title: Some("Linked".to_string()),
            summary: None,
            variants: Vec::new(),
            refs: Vec::new(),
        }];
        let diagnostics = vec![
            Diagnostic::error("ref.transformFailed", "Reference input transform failed.")
                .with_path("notes/linked.md")
                .with_actual("unknown transform `badTransform`"),
        ];

        let result = build_knowledge_health_result("Synthetic Workspace", &entries, &diagnostics);

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "ref.transformFailed")
        );
        assert!(!result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::ConfigDiagnostic
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::NoOutgoingReferences
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::NoBacklinks
                && finding.path == "notes/linked.md"
        }));
    }

    #[test]
    fn knowledge_health_preserves_unclassified_discovery_diagnostics() {
        let root = fixture_root("knowledge-health-unclassified-diagnostic");
        fs::create_dir_all(root.join("assets")).unwrap();
        init_workspace(&root, "Knowledge Health Unclassified", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("assets/missing.png.md"),
            "---\nkind: resourceDescription\ntitle: Missing Image\n---\n\n# Missing Image\n",
        )
        .unwrap();

        let result = knowledge_health(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "resource.description.missingTarget")
        );
        assert!(!result.findings.iter().any(|finding| {
            finding.category == KnowledgeHealthCategory::ConfigDiagnostic
                && finding.path == "assets/missing.png.md"
        }));
        assert_eq!(result.summary.errors, 1);

        fs::remove_dir_all(root).unwrap();
    }

    fn repository_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .and_then(Path::parent)
            .expect("crate should live under repository crates directory")
            .to_path_buf()
    }

    fn copy_dir_all(source: impl AsRef<Path>, target: impl AsRef<Path>) -> std::io::Result<()> {
        fs::create_dir_all(target.as_ref())?;
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            let file_type = entry.file_type()?;
            let target_path = target.as_ref().join(entry.file_name());
            if file_type.is_dir() {
                copy_dir_all(entry.path(), target_path)?;
            } else {
                fs::copy(entry.path(), target_path)?;
            }
        }
        Ok(())
    }

    fn fixture_root(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-operations-{name}-{unique}"))
    }
}
