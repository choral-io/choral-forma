use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use chrono_tz::Tz;
use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::config::{ConfigError, LoadMode, load_workspace};
use crate::diagnostics::{Diagnostic, DiagnosticSummary, OperationStatus};
use crate::index::{
    IndexEntry, IndexReference, ReferenceIntent, ReferenceSource, config_error_diagnostic,
    discover_workspace, index_rebuild,
};
use crate::markdown::FormaMarkdownDocument;
use crate::path::{
    FORMA_COLLECTIONS_PATH, FORMA_DIR, FORMA_GITIGNORE_PATH, FORMA_INDEX_SUMMARY_PATH,
    FORMA_LOCAL_OVERRIDES_PATH, FORMA_TEMPLATES_DIR, FORMA_TYPES_PATH, FORMA_VIEWS_DIR,
    FORMA_WORKSPACE_PATH, PathError, WorkspacePath,
};
use crate::schema::{
    PlaceholderContext, render_placeholder_template, resolve_create_inputs, resolve_runtime_values,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub root: String,
    pub name: String,
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
    pub index: CreateIndexStatus,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedEntry {
    pub path: String,
    pub collection: String,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIndexStatus {
    pub stale: bool,
    pub suggested_command: String,
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
    pub collection: String,
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
    pub collection: ListedCollection,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceFile {
    pub path: String,
    pub collection: String,
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
    pub collection: Option<String>,
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
    Index,
    Resource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorkspaceFileFeature {
    #[serde(rename = "render.html")]
    RenderHtml,
    #[serde(rename = "render.source")]
    RenderSource,
    #[serde(rename = "render.view")]
    RenderView,
    #[serde(rename = "preview.media")]
    PreviewMedia,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedCollection {
    pub id: String,
    pub title: String,
    pub include: String,
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

#[derive(Debug, Error)]
pub enum OperationError {
    #[error("configuration error: {0}")]
    Config(#[from] ConfigError),
    #[error("workspace already contains .forma")]
    WorkspaceExists,
    #[error("collection `{0}` was not found")]
    CollectionNotFound(String),
    #[error("collection `{0}` does not define create behavior")]
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
        FORMA_TEMPLATES_DIR,
        FORMA_VIEWS_DIR,
        "notes",
        "todos",
        "users",
    ] {
        fs::create_dir_all(root.join(directory)).map_err(|source| OperationError::Io {
            path: directory.to_string(),
            source,
        })?;
    }

    write_file(root, FORMA_GITIGNORE_PATH, STARTER_GITIGNORE, &mut created)?;
    write_file(
        root,
        FORMA_WORKSPACE_PATH,
        &starter_workspace_yml(name, language, &timezone),
        &mut created,
    )?;
    write_file(root, FORMA_TYPES_PATH, STARTER_TYPES_YML, &mut created)?;
    write_file(
        root,
        FORMA_COLLECTIONS_PATH,
        &starter_collections_yml(),
        &mut created,
    )?;
    for (path, source) in starter_templates() {
        write_file(root, &path, source, &mut created)?;
    }
    for (path, source) in starter_views() {
        write_file(root, &path, source, &mut created)?;
    }

    let rebuild = index_rebuild(root)?;
    if !created.iter().any(|path| path == FORMA_INDEX_SUMMARY_PATH) {
        created.push(FORMA_INDEX_SUMMARY_PATH.to_string());
    }

    Ok(InitResult {
        schema_version: 1,
        operation: "init".to_string(),
        status: rebuild.status,
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: name.to_string(),
        },
        created,
        summary: rebuild.summary,
        diagnostics: rebuild.diagnostics,
    })
}

pub fn create_entry(
    root: impl AsRef<Path>,
    collection_id: &str,
    provided: BTreeMap<String, Value>,
) -> Result<CreateResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::WithLocalOverrides)?;
    let collection = workspace
        .config
        .collections
        .get(collection_id)
        .ok_or_else(|| OperationError::CollectionNotFound(collection_id.to_string()))?;
    let create = collection
        .create
        .as_ref()
        .ok_or_else(|| OperationError::CreateNotConfigured(collection_id.to_string()))?;

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

    let template_path = WorkspacePath::parse_config(&collection.template)?;
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

    diagnostics.push(
        Diagnostic::warning(
            "index.stale",
            "Summary index is stale after creating an entry.",
        )
        .with_path(FORMA_INDEX_SUMMARY_PATH),
    );
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
        },
        created: CreatedEntry {
            path: public_path,
            collection: collection_id.to_string(),
            template: collection.template.clone(),
        },
        inputs,
        index: CreateIndexStatus {
            stale: true,
            suggested_command: "forma index rebuild".to_string(),
        },
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

pub fn inspect_entry_by_collection(
    root: impl AsRef<Path>,
    collection: &str,
    entry: &str,
) -> Result<InspectResult, OperationError> {
    let discovery = discover_workspace(root.as_ref())?;
    let path = resolve_collection_entry_path(&discovery.index.entries, collection, entry)?;
    inspect_entry(root, &path)
}

pub fn list_collection(
    root: impl AsRef<Path>,
    collection_id: &str,
) -> Result<ListResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let collection = workspace
        .config
        .collections
        .get(collection_id)
        .ok_or_else(|| OperationError::CollectionNotFound(collection_id.to_string()))?;
    let discovery = discover_workspace(root.as_ref())?;
    let mut diagnostics = discovery.diagnostics;
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let entries = discovery
        .index
        .entries
        .iter()
        .filter(|entry| entry.collection == collection_id)
        .map(|entry| ListEntry {
            path: entry.path.clone(),
            kind: entry.kind.clone(),
            title: entry.title.clone(),
            summary: entry.summary.clone(),
            fields: Value::Mapping(Default::default()),
        })
        .collect::<Vec<_>>();

    Ok(ListResult {
        schema_version: 1,
        operation: "list".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        collection: ListedCollection {
            id: collection_id.to_string(),
            title: collection.title.clone(),
            include: collection.include.clone(),
            entry_count: entries.len(),
        },
        entries,
        summary,
        diagnostics,
    })
}

pub fn inspect_config(
    root: impl AsRef<Path>,
    path: Option<&str>,
) -> Result<ConfigInspectResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::WithLocalOverrides)?;
    let path = path.map(validate_config_inspect_path).transpose()?;
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
    let mut diagnostics = discovery.diagnostics;
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
            file.collection = Some(entry.collection.clone());
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
        },
        files,
        summary,
        diagnostics,
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
    let mut diagnostics = discovery.diagnostics;
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let mut outgoing = index_entry
        .refs
        .iter()
        .map(|reference| reference_edge(index_entry, reference, &discovery.index.entries))
        .collect::<Vec<_>>();
    let mut backlinks = discovery
        .index
        .entries
        .iter()
        .filter(|entry| entry.path != path)
        .flat_map(|entry| {
            entry
                .refs
                .iter()
                .filter(|reference| reference.target_path == path)
                .map(|reference| reference_edge(entry, reference, &discovery.index.entries))
        })
        .collect::<Vec<_>>();
    outgoing.sort_by_key(reference_edge_sort_key);
    backlinks.sort_by_key(reference_edge_sort_key);

    Ok(FileReferencesResult {
        schema_version: 1,
        operation: "file.references".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        file: ReferenceFile {
            path: index_entry.path.clone(),
            collection: index_entry.collection.clone(),
            kind: index_entry.kind.clone(),
            title: index_entry.title.clone(),
        },
        outgoing,
        backlinks,
        summary,
        diagnostics,
    })
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
        target_title: target_entry.and_then(|entry| entry.title.clone()),
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
    let mut diagnostics = discovery.diagnostics;
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

    Ok(InspectResult {
        schema_version: 1,
        operation: "inspect".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
        },
        entry: InspectEntry {
            path: path.to_string(),
            collection: index_entry.collection.clone(),
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

fn config_sources(root: &Path) -> Vec<ConfigSource> {
    [
        (FORMA_WORKSPACE_PATH, ConfigSourceKind::Shared),
        (FORMA_TYPES_PATH, ConfigSourceKind::Shared),
        (FORMA_COLLECTIONS_PATH, ConfigSourceKind::Shared),
        (FORMA_LOCAL_OVERRIDES_PATH, ConfigSourceKind::Local),
    ]
    .into_iter()
    .map(|(path, kind)| ConfigSource {
        path: path.to_string(),
        kind,
        present: root.join(path).exists(),
    })
    .collect()
}

fn validate_config_inspect_path(path: &str) -> Result<String, OperationError> {
    let path = WorkspacePath::parse_cli(path)?;
    let path = path.as_str();
    if matches!(
        path,
        FORMA_WORKSPACE_PATH
            | FORMA_TYPES_PATH
            | FORMA_COLLECTIONS_PATH
            | FORMA_LOCAL_OVERRIDES_PATH
    ) {
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
        || path.ends_with(FORMA_LOCAL_OVERRIDES_PATH)
        || path.components().any(|component| {
            component.as_os_str() == "local"
                && path.components().any(|part| part.as_os_str() == FORMA_DIR)
        })
}

fn should_skip_workspace_file(_name: &str, path: &Path) -> bool {
    path.ends_with(FORMA_LOCAL_OVERRIDES_PATH)
}

fn workspace_file_from_path(root: &Path, path: PathBuf) -> Option<WorkspaceFile> {
    let relative = path
        .strip_prefix(root)
        .ok()?
        .to_string_lossy()
        .replace('\\', "/");
    let media_type = media_type_for_workspace_path(&relative)?;
    let kind = if relative == FORMA_INDEX_SUMMARY_PATH {
        WorkspaceFileKind::Index
    } else if matches!(
        relative.as_str(),
        FORMA_WORKSPACE_PATH | FORMA_TYPES_PATH | FORMA_COLLECTIONS_PATH
    ) {
        WorkspaceFileKind::Config
    } else if relative.starts_with(&format!("{FORMA_TEMPLATES_DIR}/"))
        && media_type == "text/markdown"
    {
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
        collection: None,
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

fn features_for_media_type(kind: WorkspaceFileKind, media_type: &str) -> Vec<WorkspaceFileFeature> {
    match kind {
        WorkspaceFileKind::Knowledge => vec![
            WorkspaceFileFeature::RenderHtml,
            WorkspaceFileFeature::RenderSource,
        ],
        WorkspaceFileKind::View => vec![
            WorkspaceFileFeature::RenderView,
            WorkspaceFileFeature::RenderSource,
        ],
        WorkspaceFileKind::Template
        | WorkspaceFileKind::Markdown
        | WorkspaceFileKind::Config
        | WorkspaceFileKind::Index => vec![WorkspaceFileFeature::RenderSource],
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

fn resolve_collection_entry_path(
    entries: &[IndexEntry],
    collection: &str,
    entry: &str,
) -> Result<String, OperationError> {
    let entry = entry.strip_suffix(".md").unwrap_or(entry);
    let matches = entries
        .iter()
        .filter(|candidate| {
            candidate.collection == collection
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

fn starter_workspace_yml(name: &str, language: &str, timezone: &str) -> String {
    STARTER_WORKSPACE_YML
        .replace("__WORKSPACE_NAME__", &yaml_string(name))
        .replace("__LANGUAGE__", &yaml_string(language))
        .replace("__TIMEZONE__", &yaml_string(timezone))
}

fn starter_collections_yml() -> String {
    STARTER_COLLECTIONS_YML.replace("__TEMPLATES_DIR__", FORMA_TEMPLATES_DIR)
}

fn starter_templates() -> Vec<(String, &'static str)> {
    vec![
        (
            format!("{FORMA_TEMPLATES_DIR}/note.md"),
            "---\nkind: note\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\ncreatedAt: \"{{ input.createdAt }}\"\n---\n\n# {{ input.title }}\n",
        ),
        (
            format!("{FORMA_TEMPLATES_DIR}/todo.md"),
            "---\nkind: todo\ntitle: \"{{ input.title }}\"\nsummary: \"{{ input.summary }}\"\nstatus: \"{{ input.status }}\"\nassignees: []\ncreatedAt: \"{{ input.createdAt }}\"\n---\n\n# {{ input.title }}\n",
        ),
        (
            format!("{FORMA_TEMPLATES_DIR}/user.md"),
            "---\nkind: user\nname: \"{{ input.name }}\"\ndescription: \"{{ input.description }}\"\nresponsibilities: \"{{ input.responsibilities }}\"\ncreatedAt: \"{{ input.createdAt }}\"\n---\n\n# {{ input.name }}\n",
        ),
    ]
}

fn starter_views() -> Vec<(String, &'static str)> {
    vec![
        (
            format!("{FORMA_VIEWS_DIR}/notes.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: notes\n  title: Notes\n  description: General knowledge notes.\n  table:\n    columns:\n      - title\n      - summary\n      - createdAt\n  sort:\n    - field: createdAt\n      direction: desc\n---\n\n# Notes\n\n<!-- forma-view -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/todos.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: kanban\n  collection: todos\n  title: Todos\n  description: Lightweight action items.\n  kanban:\n    card:\n      titleField: title\n      subtitleFields:\n        - summary\n        - assignees\n      badgeFields:\n        - dueDate\n    columns:\n      - id: todo\n        label: To Do\n        query:\n          all:\n            - target: frontmatter.status\n              op: equals\n              value: todo\n      - id: doing\n        label: Doing\n        query:\n          all:\n            - target: frontmatter.status\n              op: equals\n              value: doing\n      - id: done\n        label: Done\n        query:\n          all:\n            - target: frontmatter.status\n              op: equals\n              value: done\n---\n\n# Todos\n\n<!-- forma-view -->\n",
        ),
        (
            format!("{FORMA_VIEWS_DIR}/users.md"),
            "---\nkind: forma-view\n\nview:\n  surface: page\n  mode: table\n  collection: users\n  title: Users\n  description: People referenced by this workspace.\n  table:\n    columns:\n      - name\n      - description\n      - createdAt\n  sort:\n    - field: name\n      direction: asc\n---\n\n# Users\n\n<!-- forma-view -->\n",
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
        OperationError::CollectionNotFound(collection) => Diagnostic::error(
            "collection.notFound",
            format!("Collection `{collection}` was not found."),
        ),
        OperationError::CreateNotConfigured(collection) => Diagnostic::error(
            "create.notConfigured",
            format!("Collection `{collection}` does not define create behavior."),
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

const STARTER_GITIGNORE: &str = "overrides/local.yml\nlocal/\n";

const STARTER_WORKSPACE_YML: &str = r#"schemaVersion: 1

workspace:
  name: __WORKSPACE_NAME__
  canonicalLanguage: __LANGUAGE__
  supportedLanguages:
    - __LANGUAGE__
  timezone: __TIMEZONE__

runtime:
  values:
    currentDate:
      kind: currentDate
    currentDateTime:
      kind: currentDateTime
    workspaceRoot:
      kind: workspaceRoot
    currentUserId:
      kind: gitConfig
      key: user.name
      transform: slugify
      required: true
"#;

const STARTER_TYPES_YML: &str = r#"schemaVersion: 1

types:
  note:
    kind: collection
    collection: notes
    input:
      transform: slugify

  todo:
    kind: collection
    collection: todos
    input:
      transform: slugify

  user:
    kind: collection
    collection: users
    input:
      transform: slugify

  todoStatus:
    kind: enum
    values:
      - todo
      - doing
      - done
"#;

const STARTER_COLLECTIONS_YML: &str = r#"schemaVersion: 1

collections:
  notes:
    title: Notes
    description: General knowledge notes.
    include: notes/**/*.md
    template: __TEMPLATES_DIR__/note.md
    create:
      directory: notes
      filename: "{{ input.slug }}.md"
      inputs:
        title:
          field: title
          required: true
        summary:
          field: summary
          default: ""
        slug:
          label: Slug
          type: string
          default: "{{ input.title }}"
          transform: slugify
        createdAt:
          field: createdAt
          default: "{{ runtime.values.currentDateTime }}"
    conventions:
      titleField: title
      summaryField: summary
      createdAtField: createdAt
    schema:
      type: object
      fields:
        kind:
          type: const
          value: note
          required: true
        title:
          type: string
          label: Title
          required: true
        summary:
          type: string
          label: Summary
        createdAt:
          type: datetime
          label: Created At
          required: true
        updatedAt:
          type: datetime
          label: Updated At

  todos:
    title: Todos
    description: Lightweight action items.
    include: todos/**/*.md
    template: __TEMPLATES_DIR__/todo.md
    create:
      directory: todos
      filename: "{{ input.slug }}.md"
      inputs:
        title:
          field: title
          required: true
        summary:
          field: summary
          default: ""
        slug:
          label: Slug
          type: string
          default: "{{ input.title }}"
          transform: slugify
        status:
          field: status
          default: todo
        createdAt:
          field: createdAt
          default: "{{ runtime.values.currentDateTime }}"
    conventions:
      titleField: title
      summaryField: summary
      createdAtField: createdAt
    schema:
      type: object
      fields:
        kind:
          type: const
          value: todo
          required: true
        title:
          type: string
          label: Title
          required: true
        summary:
          type: string
          label: Summary
        status:
          type: enum
          enum: todoStatus
          label: Status
          required: true
        assignees:
          type: list
          label: Assignees
          items:
            type: ref
            target: user
        dueDate:
          type: date
          label: Due Date
        createdAt:
          type: datetime
          label: Created At
          required: true

  users:
    title: Users
    description: People who can be referenced in this workspace.
    include: users/**/*.md
    template: __TEMPLATES_DIR__/user.md
    create:
      directory: users
      filename: "{{ input.slug }}.md"
      inputs:
        name:
          field: name
          required: true
        description:
          field: description
          default: ""
        responsibilities:
          field: responsibilities
          default: ""
        slug:
          label: Slug
          type: string
          default: "{{ input.name }}"
          transform: slugify
        createdAt:
          field: createdAt
          default: "{{ runtime.values.currentDateTime }}"
    conventions:
      titleField: name
      summaryField: description
      createdAtField: createdAt
    schema:
      type: object
      fields:
        kind:
          type: const
          value: user
          required: true
        name:
          type: string
          label: Name
          required: true
        description:
          type: string
          label: Description
        responsibilities:
          type: string
          label: Responsibilities
        createdAt:
          type: datetime
          label: Created At
          required: true
"#;

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_yml::Value;

    use super::{
        OperationError, WorkspaceFileFeature, create_entry, init_workspace, inspect_config,
        list_file_references, list_files,
    };
    use crate::{OperationStatus, ReferenceIntent, WorkspaceFileKind};

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
                .any(|source| source.path == ".forma/workspace.yml" && source.present)
        );
        assert!(
            result
                .sources
                .iter()
                .any(|source| source.path == ".forma/overrides/local.yml" && !source.present)
        );

        let narrowed = inspect_config(&root, Some(".forma/workspace.yml")).unwrap();
        assert_eq!(
            narrowed.config["workspace"]["name"],
            Value::String("Config Test".to_string())
        );
        assert!(narrowed.config.get("collections").is_none());

        fs::write(root.join("notes.yml"), "secret: value").unwrap();
        assert!(matches!(
            inspect_config(&root, Some("notes.yml")),
            Err(OperationError::ConfigPathNotInspectable(path)) if path == "notes.yml"
        ));

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
                        WorkspaceFileFeature::RenderHtml,
                        WorkspaceFileFeature::RenderSource,
                    ]
                && file.collection.as_deref() == Some("notes")
                && file.title.as_deref() == Some("Navigation Note")
                && file
                    .frontmatter
                    .as_ref()
                    .and_then(|value| value.get("title"))
                    == Some(&Value::String("Navigation Note".to_string()))
        }));
        assert!(result.files.iter().any(|file| {
            file.path == ".forma/views/notes.md"
                && file.name == "notes.md"
                && file.parent == ".forma/views"
                && file.depth == 2
                && file.kind == WorkspaceFileKind::View
                && file.features
                    == vec![
                        WorkspaceFileFeature::RenderView,
                        WorkspaceFileFeature::RenderSource,
                    ]
        }));
        assert!(result.files.iter().any(|file| {
            file.path == ".forma/templates/note.md"
                && file.name == "note.md"
                && file.parent == ".forma/templates"
                && file.depth == 2
                && file.kind == WorkspaceFileKind::Template
                && file.features == vec![WorkspaceFileFeature::RenderSource]
                && file
                    .frontmatter
                    .as_ref()
                    .and_then(|value| value.get("kind"))
                    == Some(&Value::String("note".to_string()))
        }));
        assert!(result.files.iter().any(|file| {
            file.path == ".forma/index.summary.json"
                && file.name == "index.summary.json"
                && file.parent == ".forma"
                && file.depth == 1
                && file.kind == WorkspaceFileKind::Index
                && file.features == vec![WorkspaceFileFeature::RenderSource]
        }));

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
        assert_eq!(knowledge.collection.as_deref(), Some("notes"));
        assert_eq!(knowledge.title.as_deref(), Some("Neutral File Model"));

        let view = result
            .files
            .iter()
            .find(|file| file.path == ".forma/views/notes.md")
            .unwrap();
        assert_eq!(view.kind, WorkspaceFileKind::View);

        let template = result
            .files
            .iter()
            .find(|file| file.path == ".forma/templates/note.md")
            .unwrap();
        assert_eq!(template.kind, WorkspaceFileKind::Template);

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
        fs::create_dir_all(root.join(".forma/overrides")).unwrap();
        fs::write(root.join(".forma/overrides/local.yml"), "collections: {}\n").unwrap();

        let result = list_files(&root).unwrap();

        assert!(
            !result
                .files
                .iter()
                .any(|file| file.path == ".forma/overrides/local.yml")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_references_returns_outgoing_references_and_backlinks() {
        let root = fixture_root("references-list");
        fs::create_dir_all(&root).unwrap();
        init_workspace(&root, "References Test", "en", Some("UTC")).unwrap();
        fs::write(
            root.join("notes/alpha.md"),
            "---\nkind: note\ntitle: Alpha\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Alpha\n\nSee [[notes/beta|Beta]].\n",
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
        assert_eq!(result.outgoing.len(), 1);
        assert_eq!(result.outgoing[0].source_path, "notes/alpha.md");
        assert_eq!(result.outgoing[0].target_path, "notes/beta.md");
        assert_eq!(result.outgoing[0].target_title.as_deref(), Some("Beta"));
        assert_eq!(result.outgoing[0].intent, ReferenceIntent::Link);
        assert_eq!(result.backlinks.len(), 1);
        assert_eq!(result.backlinks[0].source_path, "notes/gamma.md");
        assert_eq!(result.backlinks[0].source_title.as_deref(), Some("Gamma"));
        assert_eq!(result.backlinks[0].target_path, "notes/alpha.md");

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

    fn fixture_root(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("forma-operations-{name}-{unique}"))
    }
}
