use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use globset::{Glob, GlobSetBuilder};
use serde::{Deserialize, Serialize};
use serde_yml::Value;
use thiserror::Error;

use crate::config::{
    ConfigError, ConfigSourcePath, FormaWorkspace, LoadMode, TaxonomyTermDefinition,
    WorkspaceConfig, WorkspaceSettings, config_source_paths, load_workspace,
};
use crate::diagnostics::{Diagnostic, DiagnosticSeverity, DiagnosticSummary, OperationStatus};
use crate::docs::embedded_doc;
use crate::index::{
    Discovery, IndexEntry, IndexReference, ReferenceIntent, ReferenceSource,
    config_error_diagnostic, discover_loaded_workspace,
};
use crate::markdown::FormaMarkdownDocument;
use crate::path::{FORMA_CONFIG_PATH, PathError, WorkspacePath, glob_scan_root};
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillsListResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub skills: Vec<SkillSummary>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillsGetResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill: Option<SkillDetail>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub source: SkillSource,
    pub source_path: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub triggers: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDetail {
    pub id: String,
    pub title: String,
    pub description: String,
    pub source: SkillSource,
    pub source_path: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub triggers: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
    pub content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SkillSource {
    BuiltIn,
    Guideline,
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub written_paths: Vec<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
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
    pub source_patterns: Vec<String>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigSource {
    pub path: String,
    pub present: bool,
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
    pub taxonomies: Vec<DashboardTaxonomy>,
    pub spaces: Vec<DashboardSpace>,
    pub entries: Vec<DashboardEntrySummary>,
    pub views: Vec<DashboardViewSummary>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplorerResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub taxonomies: Vec<ExplorerTaxonomy>,
    pub views: Vec<DashboardViewSummary>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTaxonomy {
    pub id: String,
    pub title: String,
    pub mode: String,
    #[serde(
        default,
        skip_serializing_if = "crate::config::DisplayOptions::is_empty"
    )]
    pub display: crate::config::DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub terms: Vec<ExplorerTaxonomyTerm>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerTaxonomyTerm {
    pub id: String,
    pub title: String,
    #[serde(
        default,
        skip_serializing_if = "crate::config::DisplayOptions::is_empty"
    )]
    pub display: crate::config::DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub entry_count: usize,
    pub status: OperationStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExplorerEntriesResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub taxonomy_id: String,
    pub term_id: String,
    pub entries: Vec<DashboardEntrySummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    pub total: usize,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardTaxonomy {
    pub id: String,
    pub title: String,
    pub mode: String,
    #[serde(
        default,
        skip_serializing_if = "crate::config::DisplayOptions::is_empty"
    )]
    pub display: crate::config::DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub terms: Vec<DashboardTaxonomyTerm>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardTaxonomyTerm {
    pub id: String,
    pub title: String,
    #[serde(
        default,
        skip_serializing_if = "crate::config::DisplayOptions::is_empty"
    )]
    pub display: crate::config::DisplayOptions,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub entry_count: usize,
    pub status: OperationStatus,
    pub entries: Vec<DashboardEntrySummary>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub space: Option<String>,
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
pub struct ReferenceResolveResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub source_path: String,
    pub raw_target: String,
    pub intent: ReferenceIntent,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<ResolvedReferenceTarget>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub candidates: Vec<ReferenceResolveCandidate>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedReferenceTarget {
    pub path: String,
    pub space: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_kind: Option<crate::index::ReferenceFragmentKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_location: Option<ReferenceFragmentLocation>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceResolveCandidate {
    pub path: String,
    pub space: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceFragmentLocation {
    pub line: usize,
    pub column: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceHealthResult {
    pub schema_version: u16,
    pub operation: String,
    pub status: OperationStatus,
    pub workspace: WorkspaceSummary,
    pub findings: Vec<WorkspaceHealthFinding>,
    pub summary: DiagnosticSummary,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceHealthFinding {
    pub category: WorkspaceHealthCategory,
    pub severity: DiagnosticSeverity,
    pub path: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceHealthCategory {
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
    Content,
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

#[derive(Debug, Error)]
pub enum OperationError {
    #[error("configuration error: {0}")]
    Config(#[from] ConfigError),
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
    #[error("entry was not found")]
    EntryNotFound,
    #[error("entry locator matched multiple files")]
    EntryAmbiguous,
    #[error("view `{0}` was not found")]
    ViewNotFound(String),
    #[error("view `{0}` matched multiple files")]
    ViewAmbiguous(String),
    #[error("path already exists: {0}")]
    PathConflict(String),
    #[error("file operation failed for {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
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
    let directory = render_placeholder_template(&create.directory, &context);
    diagnostics.extend(directory.diagnostics);
    let Some(directory) = directory.value else {
        return Err(OperationError::InvalidInput("directory".to_string()));
    };
    let rendered_path = WorkspacePath::parse_config(format!("{directory}/{filename}"))?;
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
            path: directory.clone(),
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

pub fn init_workspace(
    root: impl AsRef<Path>,
    name: &str,
    canonical_language: &str,
    timezone: &str,
) -> Result<InitResult, OperationError> {
    let root = root.as_ref();
    let workspace_name = if name.trim().is_empty() {
        "Untitled Forma Workspace"
    } else {
        name.trim()
    };
    let language = if canonical_language.trim().is_empty() {
        "en"
    } else {
        canonical_language.trim()
    };
    let timezone = if timezone.trim().is_empty() {
        "UTC"
    } else {
        timezone.trim()
    };

    let target_paths = [FORMA_CONFIG_PATH, ".agents/skills/forma-cli/SKILL.md"];
    let existing = target_paths
        .iter()
        .find(|path| root.join(path).exists())
        .copied();

    if let Some(path) = existing {
        let diagnostics = vec![
            Diagnostic::error("init.pathExists", "Initialization target already exists.")
                .with_path(path)
                .with_expected("Run init in a directory without existing Forma bootstrap files."),
        ];
        let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
        return Ok(InitResult {
            schema_version: 1,
            operation: "init".to_string(),
            status: summary.status(),
            workspace: WorkspaceSummary {
                root: ".".to_string(),
                name: workspace_name.to_string(),
                logo: None,
            },
            written_paths: Vec::new(),
            summary,
            diagnostics,
        });
    }

    let config = minimal_config_source(workspace_name, language, timezone);
    let skill = forma_cli_runtime_skill_source();

    write_workspace_file(root, FORMA_CONFIG_PATH, &config)?;
    write_workspace_file(root, ".agents/skills/forma-cli/SKILL.md", skill)?;

    let diagnostics = Vec::new();
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    Ok(InitResult {
        schema_version: 1,
        operation: "init".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace_name.to_string(),
            logo: None,
        },
        written_paths: target_paths.iter().map(|path| path.to_string()).collect(),
        summary,
        diagnostics,
    })
}

pub fn skills_list(root: impl AsRef<Path>) -> Result<SkillsListResult, OperationError> {
    let root = root.as_ref();
    let mut skills = builtin_skills();
    let mut diagnostics = Vec::new();
    let mut config = None;

    match load_workspace(root, LoadMode::SharedOnly) {
        Ok(workspace) => {
            let (workspace_skills, workspace_diagnostics) =
                collect_workspace_skills(root, &workspace.config, false);
            config = Some(workspace.config);
            skills.extend(workspace_skills);
            diagnostics.extend(workspace_diagnostics);
        }
        Err(error) => diagnostics.push(workspace_skill_discovery_warning(error.into())),
    }

    diagnostics.extend(duplicate_skill_id_diagnostics(&skills));
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let workspace = workspace_summary_from_config_or_fallback(config.as_ref());

    Ok(SkillsListResult {
        schema_version: 1,
        operation: "skills.list".to_string(),
        status: summary.status(),
        workspace,
        skills: skills
            .into_iter()
            .map(|skill| SkillSummary {
                id: skill.id,
                title: skill.title,
                description: skill.description,
                source: skill.source,
                source_path: skill.source_path,
                triggers: skill.triggers,
                order: skill.order,
            })
            .collect(),
        summary,
        diagnostics,
    })
}

pub fn skills_get(
    root: impl AsRef<Path>,
    id: &str,
    full: bool,
) -> Result<SkillsGetResult, OperationError> {
    let root = root.as_ref();
    let mut skills = builtin_skills();
    let mut diagnostics = Vec::new();
    let mut config = None;

    if skills.iter().any(|skill| skill.id == id) {
        if let Ok(workspace) = load_workspace(root, LoadMode::SharedOnly) {
            let (workspace_skills, workspace_diagnostics) =
                collect_workspace_skills(root, &workspace.config, full);
            config = Some(workspace.config);
            skills.extend(workspace_skills);
            diagnostics.extend(workspace_diagnostics);
        }
    } else {
        match load_workspace(root, LoadMode::SharedOnly) {
            Ok(workspace) => {
                let (workspace_skills, workspace_diagnostics) =
                    collect_workspace_skills(root, &workspace.config, full);
                config = Some(workspace.config);
                skills.extend(workspace_skills);
                diagnostics.extend(workspace_diagnostics);
            }
            Err(error) => diagnostics.push(operation_error_diagnostic(error.into())),
        }
    }

    diagnostics.extend(duplicate_skill_id_diagnostics(&skills));
    let mut matches = skills
        .into_iter()
        .filter(|skill| skill.id == id)
        .collect::<Vec<_>>();
    if matches.is_empty() {
        diagnostics.push(
            Diagnostic::error("skills.notFound", "Skill was not found.")
                .with_actual(id.to_string()),
        );
    }
    let skill = if matches.len() == 1 {
        Some(matches.remove(0))
    } else {
        None
    };
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let workspace = workspace_summary_from_config_or_fallback(config.as_ref());

    Ok(SkillsGetResult {
        schema_version: 1,
        operation: "skills.get".to_string(),
        status: summary.status(),
        workspace,
        skill,
        summary,
        diagnostics,
    })
}

pub fn inspect_entry_by_path(
    root: impl AsRef<Path>,
    path: &str,
) -> Result<InspectResult, OperationError> {
    let path = normalize_entry_path(path)?;
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_loaded_workspace(&workspace);
    inspect_entry(&workspace, discovery, &path)
}

pub fn inspect_entry_by_space(
    root: impl AsRef<Path>,
    space: &str,
    entry: &str,
) -> Result<InspectResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_loaded_workspace(&workspace);
    let path = resolve_space_entry_path(&discovery.index.entries, space, entry)?;
    inspect_entry(&workspace, discovery, &path)
}

pub fn list_space(root: impl AsRef<Path>, space_id: &str) -> Result<ListResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let space = workspace
        .config
        .spaces
        .get(space_id)
        .ok_or_else(|| OperationError::SpaceNotFound(space_id.to_string()))?;
    let discovery = discover_loaded_workspace(&workspace);
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

pub fn inspect_config(
    root: impl AsRef<Path>,
    path: Option<&str>,
) -> Result<ConfigInspectResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::WithLocalOverrides)?;
    let path = path
        .map(|path| validate_config_inspect_path(path, &workspace.config_sources))
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
            name: workspace.config.workspace.name.clone(),
            logo: None,
        },
        config,
        sources: workspace
            .config_sources
            .into_iter()
            .map(|source| ConfigSource {
                path: source.path,
                present: source.present,
            })
            .collect(),
        source_patterns: workspace.config_source_patterns,
        summary,
        diagnostics,
    })
}

pub fn list_files(root: impl AsRef<Path>) -> Result<FilesListResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_loaded_workspace(&workspace);
    let mut diagnostics = read_operation_diagnostics(discovery.diagnostics);
    diagnostics.sort_by_key(|diagnostic| {
        (
            diagnostic.path.clone().unwrap_or_default(),
            diagnostic.code.clone(),
            diagnostic.message.clone(),
        )
    });
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let config_paths = workspace_config_paths(&workspace);
    let mut files = collect_workspace_files(root.as_ref(), &workspace.config, &config_paths);
    let template_paths = workspace
        .config
        .spaces
        .values()
        .filter_map(|space| WorkspacePath::parse_config(&space.template).ok())
        .map(|path| path.as_str().to_string())
        .collect::<BTreeSet<_>>();

    for file in &mut files {
        if let Some(entry) = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == file.path)
        {
            file.kind = WorkspaceFileKind::Content;
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
        } else if template_paths.contains(&file.path) {
            file.kind = WorkspaceFileKind::Template;
            file.features = features_for_media_type(file.kind, &file.media_type);
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
    let discovery = discover_loaded_workspace(&workspace);
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

    let mut entries = discovery
        .index
        .entries
        .iter()
        .map(|entry| dashboard_entry_summary(root.as_ref(), entry, &diagnostics))
        .collect::<Vec<_>>();

    let config_paths = workspace_config_paths(&workspace);
    let workspace_files = collect_workspace_files(root.as_ref(), &workspace.config, &config_paths);
    let taxonomies = dashboard_taxonomies(
        root.as_ref(),
        &workspace.config,
        &workspace_files,
        &config_paths,
        &entries,
        &diagnostics,
    );
    for entry in taxonomies
        .iter()
        .flat_map(|taxonomy| taxonomy.terms.iter())
        .flat_map(|term| term.entries.iter())
    {
        if !entries.iter().any(|existing| existing.path == entry.path) {
            entries.push(entry.clone());
        }
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));

    let views = dashboard_view_summaries(&discovery.index.views);

    Ok(WorkspaceDashboardResult {
        schema_version: 1,
        operation: "workspace.dashboard".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name.clone(),
            logo: workspace_logo_summary(root.as_ref(), &workspace.config.workspace),
        },
        taxonomies,
        spaces,
        entries,
        views,
        summary,
        diagnostics,
    })
}

pub fn workspace_explorer(
    root: impl AsRef<Path>,
) -> Result<WorkspaceExplorerResult, OperationError> {
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_loaded_workspace(&workspace);
    let mut all_diagnostics = read_operation_diagnostics(discovery.diagnostics);
    all_diagnostics.sort_by_key(diagnostic_sort_key);
    let diagnostics = all_diagnostics
        .iter()
        .filter(|diagnostic| is_config_health_diagnostic(diagnostic))
        .cloned()
        .collect::<Vec<_>>();
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);
    let config_paths = workspace_config_paths(&workspace);
    let workspace_files = collect_workspace_files(root.as_ref(), &workspace.config, &config_paths);
    let taxonomies = explorer_taxonomies(
        &workspace.config,
        &workspace_files,
        &config_paths,
        &all_diagnostics,
    );
    let views = dashboard_view_summaries(&discovery.index.views);

    Ok(WorkspaceExplorerResult {
        schema_version: 1,
        operation: "workspace.explorer".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name.clone(),
            logo: workspace_logo_summary(root.as_ref(), &workspace.config.workspace),
        },
        taxonomies,
        views,
        summary,
        diagnostics,
    })
}

pub fn workspace_explorer_entries(
    root: impl AsRef<Path>,
    taxonomy_id: &str,
    term_id: &str,
    cursor: Option<&str>,
    limit: usize,
) -> Result<WorkspaceExplorerEntriesResult, OperationError> {
    if limit == 0 || limit > 500 {
        return Err(OperationError::InvalidInput("limit".to_string()));
    }
    let offset = cursor
        .unwrap_or("0")
        .parse::<usize>()
        .map_err(|_| OperationError::InvalidInput("cursor".to_string()))?;
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let term = workspace
        .config
        .terms
        .get(taxonomy_id)
        .and_then(|terms| terms.get(term_id))
        .ok_or_else(|| OperationError::InvalidInput("taxonomy term".to_string()))?;
    let discovery = discover_loaded_workspace(&workspace);
    let config_paths = workspace_config_paths(&workspace);
    let workspace_files = collect_workspace_files(root.as_ref(), &workspace.config, &config_paths);
    let indexed_entries = discovery
        .index
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry))
        .collect::<BTreeMap<_, _>>();
    let all_diagnostics = read_operation_diagnostics(discovery.diagnostics);
    let mut entries = taxonomy_term_files(term, &workspace_files, &config_paths)
        .into_iter()
        .map(|file| {
            indexed_entries
                .get(file.path.as_str())
                .map(|entry| dashboard_entry_summary(root.as_ref(), entry, &all_diagnostics))
                .unwrap_or_else(|| {
                    dashboard_entry_summary_from_file(
                        root.as_ref(),
                        taxonomy_id,
                        term_id,
                        file,
                        &all_diagnostics,
                    )
                })
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        left.title
            .as_deref()
            .unwrap_or(&left.path)
            .cmp(right.title.as_deref().unwrap_or(&right.path))
            .then_with(|| left.path.cmp(&right.path))
    });
    let total = entries.len();
    let entries = entries
        .into_iter()
        .skip(offset)
        .take(limit)
        .collect::<Vec<_>>();
    let next_offset = offset.saturating_add(entries.len());
    let next_cursor = (next_offset < total).then(|| next_offset.to_string());
    let mut diagnostics = read_operation_diagnostics_for_paths(
        all_diagnostics,
        entries.iter().map(|entry| entry.path.as_str()),
    );
    diagnostics.sort_by_key(diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(WorkspaceExplorerEntriesResult {
        schema_version: 1,
        operation: "workspace.explorerEntries".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name.clone(),
            logo: workspace_logo_summary(root.as_ref(), &workspace.config.workspace),
        },
        taxonomy_id: taxonomy_id.to_string(),
        term_id: term_id.to_string(),
        entries,
        next_cursor,
        total,
        summary,
        diagnostics,
    })
}

fn explorer_taxonomies(
    config: &WorkspaceConfig,
    files: &[WorkspaceFile],
    config_paths: &BTreeSet<String>,
    diagnostics: &[Diagnostic],
) -> Vec<ExplorerTaxonomy> {
    let mut taxonomies = config
        .taxonomies
        .iter()
        .map(|(taxonomy_id, value)| {
            let mut terms = config
                .terms
                .get(taxonomy_id)
                .into_iter()
                .flat_map(|terms| terms.iter())
                .map(|(term_id, term)| {
                    let paths = taxonomy_term_files(term, files, config_paths)
                        .into_iter()
                        .map(|file| file.path.as_str())
                        .collect::<Vec<_>>();
                    ExplorerTaxonomyTerm {
                        id: term_id.clone(),
                        title: term.title.clone(),
                        display: term.display.clone(),
                        description: term.description.clone(),
                        entry_count: paths.len(),
                        status: status_for_paths(diagnostics, paths.into_iter()),
                    }
                })
                .collect::<Vec<_>>();
            terms.sort_by_key(|term| {
                (
                    term.display.order.is_none(),
                    term.display.order.unwrap_or(0),
                    term.title.clone(),
                    term.id.clone(),
                )
            });
            ExplorerTaxonomy {
                id: taxonomy_id.clone(),
                title: config_value_string(value, "title").unwrap_or_else(|| taxonomy_id.clone()),
                mode: config_value_string(value, "mode").unwrap_or_else(|| "multiple".to_string()),
                display: config_value_display(value),
                description: config_value_string(value, "description"),
                terms,
            }
        })
        .collect::<Vec<_>>();
    taxonomies.sort_by_key(|taxonomy| {
        (
            taxonomy.display.order.is_none(),
            taxonomy.display.order.unwrap_or(0),
            taxonomy.title.clone(),
            taxonomy.id.clone(),
        )
    });
    taxonomies
}

fn dashboard_view_summaries(views: &[crate::index::IndexView]) -> Vec<DashboardViewSummary> {
    views
        .iter()
        .map(|view| DashboardViewSummary {
            id: view.id.clone(),
            path: view.path.clone(),
            kind: view.mode.clone(),
            title: view.title.clone(),
            display: view.display.clone(),
            space: view.space.clone().or_else(|| view_taxonomy_space(view)),
        })
        .collect()
}

fn dashboard_taxonomies(
    root: &Path,
    config: &WorkspaceConfig,
    files: &[WorkspaceFile],
    config_paths: &BTreeSet<String>,
    indexed_entries: &[DashboardEntrySummary],
    diagnostics: &[Diagnostic],
) -> Vec<DashboardTaxonomy> {
    let mut taxonomies = config
        .taxonomies
        .iter()
        .map(|(taxonomy_id, value)| {
            let mut terms = config
                .terms
                .get(taxonomy_id)
                .into_iter()
                .flat_map(|terms| terms.iter())
                .map(|(term_id, term)| {
                    let entries = dashboard_term_entries(
                        root,
                        taxonomy_id,
                        term_id,
                        term,
                        files,
                        config_paths,
                        indexed_entries,
                        diagnostics,
                    );
                    DashboardTaxonomyTerm {
                        id: term_id.clone(),
                        title: term.title.clone(),
                        display: term.display.clone(),
                        description: term.description.clone(),
                        entry_count: entries.len(),
                        status: status_for_paths(
                            diagnostics,
                            entries.iter().map(|entry| entry.path.as_str()),
                        ),
                        entries,
                    }
                })
                .collect::<Vec<_>>();
            terms.sort_by_key(taxonomy_term_sort_key);
            DashboardTaxonomy {
                id: taxonomy_id.clone(),
                title: config_value_string(value, "title").unwrap_or_else(|| taxonomy_id.clone()),
                mode: config_value_string(value, "mode").unwrap_or_else(|| "multiple".to_string()),
                display: config_value_display(value),
                description: config_value_string(value, "description"),
                terms,
            }
        })
        .collect::<Vec<_>>();
    taxonomies.sort_by_key(taxonomy_sort_key);
    taxonomies
}

#[allow(clippy::too_many_arguments)]
fn dashboard_term_entries(
    root: &Path,
    taxonomy_id: &str,
    term_id: &str,
    term: &TaxonomyTermDefinition,
    files: &[WorkspaceFile],
    config_paths: &BTreeSet<String>,
    indexed_entries: &[DashboardEntrySummary],
    diagnostics: &[Diagnostic],
) -> Vec<DashboardEntrySummary> {
    let mut entries = taxonomy_term_files(term, files, config_paths)
        .into_iter()
        .map(|file| {
            indexed_entries
                .iter()
                .find(|entry| entry.path == file.path)
                .cloned()
                .unwrap_or_else(|| {
                    dashboard_entry_summary_from_file(root, taxonomy_id, term_id, file, diagnostics)
                })
        })
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| {
        left.title
            .as_deref()
            .unwrap_or(&left.path)
            .cmp(right.title.as_deref().unwrap_or(&right.path))
            .then_with(|| left.path.cmp(&right.path))
    });
    entries
}

fn taxonomy_term_files<'a>(
    term: &TaxonomyTermDefinition,
    files: &'a [WorkspaceFile],
    config_paths: &BTreeSet<String>,
) -> Vec<&'a WorkspaceFile> {
    let mut builder = GlobSetBuilder::new();
    let mut pattern_count = 0;
    for pattern in &term.include_patterns {
        if let Ok(glob) = Glob::new(pattern) {
            builder.add(glob);
            pattern_count += 1;
        }
    }
    if pattern_count == 0 {
        return Vec::new();
    }
    let Ok(matcher) = builder.build() else {
        return Vec::new();
    };
    files
        .iter()
        .filter(|file| {
            file.media_type == "text/markdown"
                && !config_paths.contains(&file.path)
                && matcher.is_match(&file.path)
        })
        .collect()
}

fn dashboard_entry_summary(
    root: &Path,
    entry: &IndexEntry,
    diagnostics: &[Diagnostic],
) -> DashboardEntrySummary {
    DashboardEntrySummary {
        id: document_id_for_path(&entry.path),
        path: entry.path.clone(),
        route_path: entry_route_path_for_path(&entry.path),
        raw_path: entry_raw_path_for_path(&entry.path),
        space: Some(entry.space.clone()),
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
        status: status_for_paths(diagnostics, std::iter::once(entry.path.as_str())),
        updated_at: file_modified_at(root, &entry.path),
        renderable: true,
    }
}

fn dashboard_entry_summary_from_file(
    root: &Path,
    taxonomy_id: &str,
    term_id: &str,
    file: &WorkspaceFile,
    diagnostics: &[Diagnostic],
) -> DashboardEntrySummary {
    DashboardEntrySummary {
        id: document_id_for_path(&file.path),
        path: file.path.clone(),
        route_path: entry_route_path_for_path(&file.path),
        raw_path: entry_raw_path_for_path(&file.path),
        space: (taxonomy_id == "spaces").then(|| term_id.to_string()),
        kind: file
            .frontmatter
            .as_ref()
            .and_then(|value| config_value_string(value, "kind")),
        title: file
            .frontmatter
            .as_ref()
            .and_then(|value| config_value_string(value, "title")),
        summary: file
            .frontmatter
            .as_ref()
            .and_then(|value| config_value_string(value, "summary")),
        variants: Vec::new(),
        status: status_for_paths(diagnostics, std::iter::once(file.path.as_str())),
        updated_at: file_modified_at(root, &file.path),
        renderable: true,
    }
}

fn config_value_string(value: &Value, field: &str) -> Option<String> {
    value.get(field)?.as_str().map(ToOwned::to_owned)
}

fn config_value_display(value: &Value) -> crate::config::DisplayOptions {
    value
        .get("display")
        .cloned()
        .and_then(|value| serde_yml::from_value(value).ok())
        .unwrap_or_default()
}

fn taxonomy_sort_key(taxonomy: &DashboardTaxonomy) -> (bool, i64, String, String) {
    (
        taxonomy.display.order.is_none(),
        taxonomy.display.order.unwrap_or(0),
        taxonomy.title.clone(),
        taxonomy.id.clone(),
    )
}

fn taxonomy_term_sort_key(term: &DashboardTaxonomyTerm) -> (bool, i64, String, String) {
    (
        term.display.order.is_none(),
        term.display.order.unwrap_or(0),
        term.title.clone(),
        term.id.clone(),
    )
}

fn view_taxonomy_space(view: &crate::index::IndexView) -> Option<String> {
    let terms = view.source.as_ref()?.taxonomy.get("spaces")?;
    (terms.len() == 1).then(|| terms[0].clone())
}

fn workspace_logo_summary(
    root: &Path,
    workspace: &WorkspaceSettings,
) -> Option<WorkspaceLogoSummary> {
    let logo = workspace.logo.as_ref()?;
    let path = WorkspacePath::parse_config(&logo.path).ok()?;
    let path = path.as_str();
    if !is_public_workspace_path_allowed(root, path) {
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
    let discovery = discover_loaded_workspace(&workspace);
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

pub fn resolve_reference(
    root: impl AsRef<Path>,
    source_path: &str,
    raw_target: &str,
    intent: ReferenceIntent,
    explicit_fragment: Option<String>,
) -> Result<ReferenceResolveResult, OperationError> {
    let source_path = normalize_entry_path(source_path)?;
    let workspace = load_workspace(root.as_ref(), LoadMode::SharedOnly)?;
    let discovery = discover_loaded_workspace(&workspace);
    let source_entry = discovery
        .index
        .entries
        .iter()
        .find(|entry| entry.path == source_path)
        .ok_or(OperationError::EntryNotFound)?;

    let (target_text, inline_fragment) = split_resolve_target(raw_target);
    let fragment = explicit_fragment.or(inline_fragment);
    let fragment_kind = fragment.as_deref().map(|value| {
        if value.starts_with('^') {
            crate::index::ReferenceFragmentKind::Block
        } else {
            crate::index::ReferenceFragmentKind::Heading
        }
    });
    let fragment = fragment.map(|value| value.trim_start_matches('^').to_string());
    let mut diagnostics = Vec::new();
    let semantic_matches = (intent == ReferenceIntent::Reference)
        .then(|| semantic_reference_candidates(source_entry, &target_text))
        .unwrap_or_default();
    let matches = if semantic_matches.is_empty() {
        resolve_reference_candidates(&discovery.index.entries, &source_path, &target_text)
    } else {
        semantic_matches
    };
    let mut candidates = if matches.len() > 1 {
        matches
            .iter()
            .filter_map(|path| {
                discovery
                    .index
                    .entries
                    .iter()
                    .find(|entry| &entry.path == path)
                    .map(reference_candidate)
            })
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    candidates.sort_by(|left, right| left.path.cmp(&right.path));

    let target = if matches.len() == 1 {
        let entry = discovery
            .index
            .entries
            .iter()
            .find(|entry| entry.path == matches[0])
            .expect("resolved reference candidate should exist");
        let fragment_location = fragment.as_deref().and_then(|fragment| {
            resolve_fragment_location(root.as_ref(), &entry.path, fragment, fragment_kind)
        });
        if fragment.is_some() && fragment_location.is_none() {
            diagnostics.push(
                Diagnostic::error(
                    "reference.fragmentUnresolved",
                    "Reference fragment cannot be resolved.",
                )
                .with_path(source_path.clone())
                .with_actual(fragment.clone().unwrap_or_default()),
            );
        }
        Some(ResolvedReferenceTarget {
            path: entry.path.clone(),
            space: entry.space.clone(),
            kind: entry.kind.clone(),
            title: entry.title.clone(),
            fragment,
            fragment_kind,
            fragment_location,
        })
    } else {
        let (code, message) = if matches.is_empty() {
            ("reference.unresolved", "Reference cannot be resolved.")
        } else {
            (
                "reference.ambiguous",
                "Reference resolves to multiple entries.",
            )
        };
        diagnostics.push(
            Diagnostic::error(code, message)
                .with_path(source_path.clone())
                .with_actual(raw_target.to_string()),
        );
        None
    };
    diagnostics.sort_by_key(diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    Ok(ReferenceResolveResult {
        schema_version: 1,
        operation: "reference.resolve".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name,
            logo: None,
        },
        source_path,
        raw_target: raw_target.to_string(),
        intent,
        target,
        candidates,
        summary,
        diagnostics,
    })
}

fn split_resolve_target(raw_target: &str) -> (String, Option<String>) {
    let mut target = raw_target.trim();
    target = target.strip_prefix('!').unwrap_or(target);
    if let Some(inner) = target
        .strip_prefix("[[")
        .and_then(|value| value.strip_suffix("]]"))
    {
        target = inner;
    }
    target = target.split('|').next().unwrap_or(target).trim();
    let (path, fragment) = target.split_once('#').unwrap_or((target, ""));
    (
        path.to_string(),
        (!fragment.trim().is_empty()).then(|| fragment.trim().to_string()),
    )
}

fn resolve_reference_candidates(
    entries: &[IndexEntry],
    source_path: &str,
    raw_target: &str,
) -> Vec<String> {
    if raw_target.is_empty() {
        return vec![source_path.to_string()];
    }
    if raw_target.contains("://") || raw_target.starts_with("mailto:") {
        return Vec::new();
    }

    let paths = entries
        .iter()
        .map(|entry| entry.path.as_str())
        .collect::<BTreeSet<_>>();
    let mut direct_candidates = Vec::new();
    if let Some(relative) = normalized_relative_target(source_path, raw_target) {
        direct_candidates.extend(reference_path_variants(&relative));
    }
    direct_candidates.extend(reference_path_variants(raw_target.trim_start_matches("./")));
    direct_candidates.dedup();
    for candidate in direct_candidates {
        if paths.contains(candidate.as_str()) {
            return vec![candidate];
        }
    }

    let normalized = raw_target.trim_start_matches("./").trim_end_matches(".md");
    let mut matches = entries
        .iter()
        .filter(|entry| {
            let without_extension = entry.path.strip_suffix(".md").unwrap_or(&entry.path);
            if normalized.contains('/') {
                without_extension == normalized
                    || without_extension.ends_with(&format!("/{normalized}"))
            } else {
                without_extension
                    .rsplit('/')
                    .next()
                    .is_some_and(|basename| basename == normalized)
            }
        })
        .map(|entry| entry.path.clone())
        .collect::<Vec<_>>();
    matches.sort();
    matches.dedup();
    matches
}

fn semantic_reference_candidates(source: &IndexEntry, raw_target: &str) -> Vec<String> {
    let normalized = raw_target.trim_start_matches("./").trim_end_matches(".md");
    let mut matches = source
        .refs
        .iter()
        .filter(|reference| {
            reference.source == ReferenceSource::Frontmatter
                && reference.intent == ReferenceIntent::Reference
        })
        .filter(|reference| {
            let without_extension = reference
                .target_path
                .strip_suffix(".md")
                .unwrap_or(&reference.target_path);
            without_extension == normalized
                || without_extension.ends_with(&format!("/{normalized}"))
        })
        .map(|reference| reference.target_path.clone())
        .collect::<Vec<_>>();
    matches.sort();
    matches.dedup();
    matches
}

fn normalized_relative_target(source_path: &str, target: &str) -> Option<String> {
    let mut segments = source_path
        .rsplit_once('/')
        .map(|(parent, _)| parent.split('/').collect::<Vec<_>>())
        .unwrap_or_default();
    let normalized_target = target.replace('\\', "/");
    for segment in normalized_target.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop()?;
            }
            value => segments.push(value),
        }
    }
    (!segments.is_empty()).then(|| segments.join("/"))
}

fn reference_path_variants(target: &str) -> Vec<String> {
    if target.ends_with(".md") {
        vec![target.to_string()]
    } else {
        vec![format!("{target}.md"), target.to_string()]
    }
}

fn reference_candidate(entry: &IndexEntry) -> ReferenceResolveCandidate {
    ReferenceResolveCandidate {
        path: entry.path.clone(),
        space: entry.space.clone(),
        kind: entry.kind.clone(),
        title: entry.title.clone(),
    }
}

fn resolve_fragment_location(
    root: &Path,
    path: &str,
    fragment: &str,
    kind: Option<crate::index::ReferenceFragmentKind>,
) -> Option<ReferenceFragmentLocation> {
    let source = fs::read_to_string(root.join(path)).ok()?;
    if kind == Some(crate::index::ReferenceFragmentKind::Block) {
        return source.lines().enumerate().find_map(|(line, value)| {
            value
                .trim_end()
                .ends_with(&format!(" ^{fragment}"))
                .then_some(ReferenceFragmentLocation {
                    line: line + 1,
                    column: value.find('^').map_or(1, |column| column + 1),
                })
        });
    }
    source.lines().enumerate().find_map(|(line, value)| {
        let trimmed = value.trim_start();
        let level = trimmed
            .chars()
            .take_while(|character| *character == '#')
            .count();
        if !(1..=6).contains(&level)
            || !trimmed
                .as_bytes()
                .get(level)
                .is_some_and(u8::is_ascii_whitespace)
        {
            return None;
        }
        let text = trimmed[level..].trim().trim_end_matches('#').trim();
        (text == fragment || heading_slug(text) == fragment).then_some(ReferenceFragmentLocation {
            line: line + 1,
            column: value.len() - trimmed.len() + 1,
        })
    })
}

fn heading_slug(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || character == '_' || character == '-' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

pub fn workspace_health(root: impl AsRef<Path>) -> Result<WorkspaceHealthResult, OperationError> {
    let workspace = match load_workspace(root.as_ref(), LoadMode::SharedOnly) {
        Ok(workspace) => workspace,
        Err(error) => {
            return Ok(workspace_health_failure_result(
                "Unknown Workspace",
                config_error_diagnostic(error),
            ));
        }
    };
    let discovery = discover_loaded_workspace(&workspace);
    Ok(build_workspace_health_result(
        &workspace.config.workspace.name,
        &discovery.index.entries,
        &discovery.diagnostics,
    ))
}

fn workspace_health_failure_result(
    workspace_name: &str,
    diagnostic: Diagnostic,
) -> WorkspaceHealthResult {
    let finding = workspace_health_config_finding_from_diagnostic(&diagnostic);
    let diagnostics = vec![workspace_health_diagnostic(&finding)];
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    WorkspaceHealthResult {
        schema_version: 1,
        operation: "workspace.health".to_string(),
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

fn build_workspace_health_result(
    workspace_name: &str,
    entries: &[IndexEntry],
    discovery_diagnostics: &[Diagnostic],
) -> WorkspaceHealthResult {
    let mut findings = discovery_diagnostics
        .iter()
        .filter_map(workspace_health_finding_from_diagnostic)
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
            findings.push(WorkspaceHealthFinding {
                category: WorkspaceHealthCategory::NoOutgoingReferences,
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
            findings.push(WorkspaceHealthFinding {
                category: WorkspaceHealthCategory::NoBacklinks,
                severity: DiagnosticSeverity::Warning,
                path: entry.path.clone(),
                message: "Entry has no inbound internal references.".to_string(),
                target: None,
            });
        }
    }

    findings.sort_by_key(workspace_health_finding_sort_key);

    let mut diagnostics = findings
        .iter()
        .map(workspace_health_diagnostic)
        .collect::<Vec<_>>();
    diagnostics.extend(
        discovery_diagnostics
            .iter()
            .filter(|diagnostic| workspace_health_finding_from_diagnostic(diagnostic).is_none())
            .cloned(),
    );
    diagnostics.sort_by_key(workspace_health_diagnostic_sort_key);
    let summary = DiagnosticSummary::from_diagnostics(&diagnostics);

    WorkspaceHealthResult {
        schema_version: 1,
        operation: "workspace.health".to_string(),
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

fn workspace_health_finding_from_diagnostic(
    diagnostic: &Diagnostic,
) -> Option<WorkspaceHealthFinding> {
    let path = diagnostic.path.clone().unwrap_or_else(|| ".".to_string());
    match diagnostic.code.as_str() {
        "entryRef.unresolved" => Some(WorkspaceHealthFinding {
            category: WorkspaceHealthCategory::BrokenReference,
            severity: DiagnosticSeverity::Warning,
            path,
            message: "Reference cannot be resolved.".to_string(),
            target: diagnostic.actual.clone(),
        }),
        "entryRef.ambiguous" => Some(WorkspaceHealthFinding {
            category: WorkspaceHealthCategory::AmbiguousReference,
            severity: DiagnosticSeverity::Warning,
            path,
            message: "Reference resolves to multiple entries.".to_string(),
            target: diagnostic.actual.clone(),
        }),
        _ if is_config_health_diagnostic(diagnostic) => {
            Some(workspace_health_config_finding_from_diagnostic(diagnostic))
        }
        _ => None,
    }
}

fn workspace_health_config_finding_from_diagnostic(
    diagnostic: &Diagnostic,
) -> WorkspaceHealthFinding {
    WorkspaceHealthFinding {
        category: WorkspaceHealthCategory::ConfigDiagnostic,
        severity: diagnostic.severity,
        path: diagnostic.path.clone().unwrap_or_else(|| ".".to_string()),
        message: diagnostic.message.clone(),
        target: diagnostic.actual.clone(),
    }
}

fn is_reference_problem_diagnostic(diagnostic: &Diagnostic) -> bool {
    matches!(
        diagnostic.code.as_str(),
        "entryRef.unresolved" | "entryRef.ambiguous" | "entryRef.transformFailed"
    )
}

fn read_operation_diagnostics(diagnostics: Vec<Diagnostic>) -> Vec<Diagnostic> {
    diagnostics
        .into_iter()
        .map(|mut diagnostic| {
            if matches!(
                diagnostic.code.as_str(),
                "entryRef.unresolved" | "entryRef.ambiguous"
            ) {
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

fn workspace_health_finding_sort_key(
    finding: &WorkspaceHealthFinding,
) -> (String, WorkspaceHealthCategory, String, Option<String>) {
    (
        finding.path.clone(),
        finding.category,
        finding.message.clone(),
        finding.target.clone(),
    )
}

fn workspace_health_diagnostic(finding: &WorkspaceHealthFinding) -> Diagnostic {
    let diagnostic = match finding.severity {
        DiagnosticSeverity::Error => Diagnostic::error(
            workspace_health_diagnostic_code(finding.category),
            &finding.message,
        ),
        DiagnosticSeverity::Warning => Diagnostic::warning(
            workspace_health_diagnostic_code(finding.category),
            &finding.message,
        ),
        DiagnosticSeverity::Info => Diagnostic {
            severity: DiagnosticSeverity::Info,
            code: workspace_health_diagnostic_code(finding.category).to_string(),
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

fn workspace_health_diagnostic_code(category: WorkspaceHealthCategory) -> &'static str {
    match category {
        WorkspaceHealthCategory::BrokenReference => "workspaceHealth.brokenReference",
        WorkspaceHealthCategory::AmbiguousReference => "workspaceHealth.ambiguousReference",
        WorkspaceHealthCategory::NoOutgoingReferences => "workspaceHealth.noOutgoingReferences",
        WorkspaceHealthCategory::NoBacklinks => "workspaceHealth.noBacklinks",
        WorkspaceHealthCategory::ConfigDiagnostic => "workspaceHealth.configDiagnostic",
    }
}

fn workspace_health_diagnostic_sort_key(diagnostic: &Diagnostic) -> (String, String, String) {
    (
        diagnostic.path.clone().unwrap_or_default(),
        diagnostic.code.clone(),
        diagnostic.message.clone(),
    )
}

fn inspect_entry(
    workspace: &FormaWorkspace,
    discovery: Discovery,
    path: &str,
) -> Result<InspectResult, OperationError> {
    let (space, kind, title, entry_summary, refs) = if let Some(entry) = discovery
        .index
        .entries
        .iter()
        .find(|entry| entry.path == path)
    {
        (
            Some(entry.space.clone()),
            entry.kind.clone(),
            entry.title.clone(),
            entry.summary.clone(),
            entry.refs.clone(),
        )
    } else if let Some(view) = discovery.index.views.iter().find(|view| view.path == path) {
        (
            None,
            Some("view".to_string()),
            view.title.clone(),
            None,
            Vec::new(),
        )
    } else {
        return Err(OperationError::EntryNotFound);
    };
    let source =
        fs::read_to_string(workspace.root.join(path)).map_err(|source| OperationError::Io {
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
    let guidelines = applicable_guidelines(&workspace.config, space.as_deref().unwrap_or_default());

    Ok(InspectResult {
        schema_version: 1,
        operation: "inspect".to_string(),
        status: summary.status(),
        workspace: WorkspaceSummary {
            root: ".".to_string(),
            name: workspace.config.workspace.name.clone(),
            logo: None,
        },
        entry: InspectEntry {
            path: path.to_string(),
            space,
            guidelines,
            kind,
            title,
            summary: entry_summary,
            metadata: document
                .frontmatter
                .value
                .unwrap_or(Value::Mapping(Default::default())),
            headings: Vec::new(),
            refs,
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

fn workspace_config_paths(workspace: &FormaWorkspace) -> BTreeSet<String> {
    workspace
        .config_sources
        .iter()
        .map(|source| source.path.clone())
        .collect()
}

fn validate_config_inspect_path(
    path: &str,
    sources: &[ConfigSourcePath],
) -> Result<String, OperationError> {
    let path = WorkspacePath::parse_cli(path)?;
    let path = path.as_str();
    let inspectable = sources.iter().any(|source| source.path == path);
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

fn collect_workspace_files(
    root: &Path,
    config: &WorkspaceConfig,
    config_paths: &BTreeSet<String>,
) -> Vec<WorkspaceFile> {
    let mut patterns = config
        .spaces
        .values()
        .flat_map(|space| {
            if space.include_patterns.is_empty() {
                std::slice::from_ref(&space.include).iter()
            } else {
                space.include_patterns.iter()
            }
        })
        .cloned()
        .collect::<Vec<_>>();
    patterns.extend(
        config
            .terms
            .values()
            .flat_map(BTreeMap::values)
            .flat_map(|term| term.include_patterns.iter().cloned()),
    );

    let mut matcher_builder = GlobSetBuilder::new();
    let mut scan_roots = Vec::new();
    for pattern in &patterns {
        if let Ok(glob) = Glob::new(pattern) {
            matcher_builder.add(glob);
            scan_roots.push(glob_scan_root(root, pattern));
        }
    }
    let matcher = matcher_builder.build().ok();
    scan_roots.sort();
    scan_roots.dedup();
    let mut minimal_roots = Vec::<PathBuf>::new();
    for candidate in scan_roots {
        if minimal_roots
            .iter()
            .any(|existing| candidate.starts_with(existing))
        {
            continue;
        }
        minimal_roots.retain(|existing| !existing.starts_with(&candidate));
        minimal_roots.push(candidate);
    }

    let mut files = BTreeMap::<String, WorkspaceFile>::new();
    if let Some(matcher) = matcher.as_ref() {
        for scan_root in minimal_roots {
            collect_workspace_files_inner(root, &scan_root, matcher, &mut files);
        }
    }

    let mut known_paths = config_paths.clone();
    known_paths.extend(
        config
            .spaces
            .values()
            .filter_map(|space| WorkspacePath::parse_config(&space.template).ok())
            .map(|path| path.as_str().to_string()),
    );
    if let Some(logo) = &config.workspace.logo {
        known_paths.insert(logo.path.clone());
    }
    for path in known_paths {
        let candidate = root.join(&path);
        if candidate.is_file()
            && let Some(file) = workspace_file_from_path(root, candidate)
        {
            files.insert(file.path.clone(), file);
        }
    }
    files.into_values().collect()
}

fn collect_workspace_files_inner(
    root: &Path,
    path: &Path,
    matcher: &globset::GlobSet,
    files: &mut BTreeMap<String, WorkspaceFile>,
) {
    if path.is_file() {
        if let Some(file) = workspace_file_from_path(root, path.to_path_buf())
            && matcher.is_match(&file.path)
        {
            files.insert(file.path.clone(), file);
        }
        return;
    }

    let dir = path;
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            if should_skip_file_dir(name, &path) {
                continue;
            }
            collect_workspace_files_inner(root, &path, matcher, files);
        } else if should_skip_workspace_file(name, &path) {
            continue;
        } else if file_type.is_file()
            && let Some(file) = workspace_file_from_path(root, path)
            && matcher.is_match(&file.path)
        {
            files.insert(file.path.clone(), file);
        }
    }
}

fn should_skip_file_dir(name: &str, path: &Path) -> bool {
    let _ = path;
    matches!(name, ".git" | "target" | "node_modules")
}

fn should_skip_workspace_file(_name: &str, _path: &Path) -> bool {
    false
}

fn workspace_file_from_path(root: &Path, path: PathBuf) -> Option<WorkspaceFile> {
    let relative = workspace_relative_path(root, &path)?;
    let media_type = media_type_for_workspace_path(&relative)?;
    let kind = if matches!(relative.as_str(), FORMA_CONFIG_PATH) {
        WorkspaceFileKind::Config
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
    normalized != FORMA_CONFIG_PATH
}

pub fn is_public_workspace_path_allowed(root: impl AsRef<Path>, path: &str) -> bool {
    let root = root.as_ref();
    let lowercase_path = path.to_ascii_lowercase();
    is_raw_workspace_path_allowed(path)
        && !is_config_source_path(root, path)
        && !is_config_source_path(root, &lowercase_path)
}

fn is_config_source_path(root: &Path, path: &str) -> bool {
    config_source_paths(root, LoadMode::SharedOnly)
        .map(|sources| sources.into_iter().any(|source| source.path == path))
        .unwrap_or(false)
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillMetadata {
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    triggers: Vec<String>,
    order: Option<i64>,
}

fn builtin_skills() -> Vec<SkillDetail> {
    let doc = embedded_doc("agents.forma-cli-core")
        .expect("embedded docs should parse")
        .expect("forma-cli-core embedded doc should exist");
    let skill = doc
        .skill
        .expect("forma-cli-core embedded doc should declare skill metadata");
    vec![SkillDetail {
        id: skill.id,
        title: skill.title,
        description: skill.description,
        source: SkillSource::BuiltIn,
        source_path: "builtin:forma-cli-core".to_string(),
        triggers: skill.triggers,
        order: skill.order,
        content: builtin_skill_markdown_content("builtin:forma-cli-core", &doc.body),
    }]
}

fn workspace_summary_from_config_or_fallback(config: Option<&WorkspaceConfig>) -> WorkspaceSummary {
    WorkspaceSummary {
        root: ".".to_string(),
        name: config
            .map(|config| config.workspace.name.clone())
            .unwrap_or_else(|| "Forma Workspace".to_string()),
        logo: None,
    }
}

fn workspace_skill_discovery_warning(error: OperationError) -> Diagnostic {
    Diagnostic::warning(
        "skills.workspaceUnavailable",
        "Workspace skills could not be discovered; built-in skills are still available.",
    )
    .with_actual(error.to_string())
}

fn configured_guideline_paths(config: &WorkspaceConfig) -> Vec<String> {
    let mut paths = Vec::new();
    for path in config.guidelines.iter().chain(
        config
            .spaces
            .values()
            .flat_map(|space| space.guidelines.iter()),
    ) {
        if !paths.contains(path) {
            paths.push(path.clone());
        }
    }
    paths
}

fn skill_markdown_content(
    source_path: &str,
    document: &FormaMarkdownDocument,
    full: bool,
) -> String {
    let body = document.body.trim_start_matches('\n').trim_end();
    let body = if full {
        body
    } else {
        agent_skill_section(body).unwrap_or(body)
    };
    format!(
        "---\nsource: {source_path}\n---\n\n<!-- Source guideline: {source_path} -->\n\n{body}\n"
    )
}

fn agent_skill_section(body: &str) -> Option<&str> {
    let mut section_start = None;
    let mut section_end = body.len();
    let mut offset = 0;

    for line in body.split_inclusive('\n') {
        if markdown_heading_level(line) == Some(2) && line.trim() == "## Agent Skill" {
            section_start = Some(offset);
            offset += line.len();
            continue;
        }

        if section_start.is_some() && matches!(markdown_heading_level(line), Some(1 | 2)) {
            section_end = offset;
            break;
        }
        offset += line.len();
    }

    section_start.map(|start| body[start..section_end].trim_end())
}

fn markdown_heading_level(line: &str) -> Option<usize> {
    let trimmed = line.trim_start();
    let hashes = trimmed
        .chars()
        .take_while(|character| *character == '#')
        .count();
    if hashes == 0 || hashes > 6 {
        return None;
    }
    if trimmed.as_bytes().get(hashes) == Some(&b' ') {
        Some(hashes)
    } else {
        None
    }
}

fn builtin_skill_markdown_content(source_path: &str, body: &str) -> String {
    let body = body.trim_start_matches('\n').trim_end();
    format!("---\nsource: {source_path}\n---\n\n{body}\n")
}

fn write_workspace_file(root: &Path, path: &str, content: &str) -> Result<(), OperationError> {
    let target = root.join(path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|source| ConfigError::Write {
            path: parent.to_string_lossy().replace('\\', "/"),
            source,
        })?;
    }
    fs::write(&target, content).map_err(|source| ConfigError::Write {
        path: path.to_string(),
        source,
    })?;
    Ok(())
}

fn minimal_config_source(name: &str, language: &str, timezone: &str) -> String {
    format!(
        r#"---
schemaVersion: 1

workspace:
  name: "{name}"
  canonicalLanguage: "{language}"
  supportedLanguages:
    - "{language}"
  timezone: "{timezone}"

runtime:
  values:
    currentDateTime:
      kind: currentDateTime
    workspaceRoot:
      kind: workspaceRoot

imports:
  - ".forma/*.md"
  - ".forma/spaces/*.md"
  - ".forma/views/*.md"
  - ".forma/local/*.md"
---

# {name}

This file is the Forma workspace entry point. Its frontmatter defines the workspace configuration; this body is for Human and Agent-readable notes.
"#,
        name = yaml_double_quoted(name),
        language = yaml_double_quoted(language),
        timezone = yaml_double_quoted(timezone)
    )
}

fn yaml_double_quoted(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn forma_cli_runtime_skill_source() -> &'static str {
    r#"---
name: forma-cli
description: Use for Forma workspace bootstrap, content operations, and Agent-facing read workflows through the local `forma` binary.
---

# Forma CLI

Run `forma` commands from the target workspace root. If you cannot guarantee the current working directory, pass `--workspace <path>` explicitly.

Before Forma workspace or configuration work, load the built-in guide:

```sh
forma skills get forma-cli-core
```

Then inspect the workspace:

```sh
forma skills list --json
forma config inspect --json
forma workspace health --json
```

Use the built-in guide and any workspace-projected skills before creating spaces, templates, views, guidelines, or shared Markdown content.
"#
}

fn collect_workspace_skills(
    root: &Path,
    config: &WorkspaceConfig,
    full: bool,
) -> (Vec<SkillDetail>, Vec<Diagnostic>) {
    let mut skills = Vec::new();
    let mut diagnostics = Vec::new();

    for source_path in configured_guideline_paths(config) {
        if media_type_for_workspace_path(&source_path) != Some("text/markdown") {
            continue;
        }
        let source = match fs::read_to_string(root.join(&source_path)) {
            Ok(source) => source,
            Err(error) => {
                diagnostics.push(
                    Diagnostic::warning(
                        "skills.guidelineReadFailed",
                        "Configured guideline could not be read for skill discovery.",
                    )
                    .with_path(source_path.clone())
                    .with_actual(error.to_string()),
                );
                continue;
            }
        };
        let document = FormaMarkdownDocument::parse(&source);
        diagnostics.extend(
            document
                .diagnostics
                .iter()
                .cloned()
                .map(|diagnostic| diagnostic.with_path(source_path.clone())),
        );
        let Some(frontmatter) = document.frontmatter.value.clone() else {
            continue;
        };
        let Some(skill_value) = skill_value_from_frontmatter(&frontmatter) else {
            continue;
        };
        let metadata = match serde_yml::from_value::<SkillMetadata>(skill_value) {
            Ok(metadata) => metadata,
            Err(error) => {
                diagnostics.push(
                    Diagnostic::error(
                        "skills.invalidMetadata",
                        "Guideline skill metadata is invalid.",
                    )
                    .with_path(source_path.clone())
                    .with_actual(error.to_string())
                    .with_expected("skill.id must be a non-empty string"),
                );
                continue;
            }
        };
        if metadata.id.trim().is_empty() {
            diagnostics.push(
                Diagnostic::error("skills.invalidId", "Skill id must not be empty.")
                    .with_path(source_path.clone()),
            );
            continue;
        }

        let title = if metadata.title.trim().is_empty() {
            metadata.id.clone()
        } else {
            metadata.title
        };
        skills.push(SkillDetail {
            id: metadata.id,
            title,
            description: metadata.description,
            source: SkillSource::Guideline,
            source_path: source_path.clone(),
            triggers: metadata.triggers,
            order: metadata.order,
            content: skill_markdown_content(&source_path, &document, full),
        });
    }

    skills.sort_by(|a, b| {
        a.order
            .unwrap_or(i64::MAX)
            .cmp(&b.order.unwrap_or(i64::MAX))
            .then_with(|| a.id.cmp(&b.id))
            .then_with(|| a.source_path.cmp(&b.source_path))
    });

    (skills, diagnostics)
}

pub(crate) fn workspace_skill_diagnostics(
    root: &Path,
    config: &WorkspaceConfig,
) -> Vec<Diagnostic> {
    let mut skills = builtin_skills();
    let (workspace_skills, mut diagnostics) = collect_workspace_skills(root, config, false);
    skills.extend(workspace_skills);
    diagnostics.extend(duplicate_skill_id_diagnostics(&skills));
    diagnostics
}

fn skill_value_from_frontmatter(frontmatter: &Value) -> Option<Value> {
    let Value::Mapping(mapping) = frontmatter else {
        return None;
    };
    mapping.get(&Value::String("skill".to_string())).cloned()
}

fn duplicate_skill_id_diagnostics(skills: &[SkillDetail]) -> Vec<Diagnostic> {
    let mut seen: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    for skill in skills {
        seen.entry(skill.id.as_str())
            .or_default()
            .push(skill.source_path.as_str());
    }
    seen.into_iter()
        .filter(|(_, paths)| paths.len() > 1)
        .map(|(id, paths)| {
            Diagnostic::error("skills.duplicateId", "Skill id must be unique.")
                .with_expected(format!("unique skill id `{id}`"))
                .with_actual(paths.join(", "))
        })
        .collect()
}

fn workspace_relative_path(root: &Path, path: &Path) -> Option<String> {
    path.strip_prefix(root)
        .ok()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
}

fn features_for_media_type(kind: WorkspaceFileKind, media_type: &str) -> Vec<WorkspaceFileFeature> {
    match kind {
        WorkspaceFileKind::Content => vec![
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

pub fn operation_error_diagnostic(error: OperationError) -> Diagnostic {
    match error {
        OperationError::Config(error) => config_error_diagnostic(error),
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
        OperationError::EntryNotFound => {
            Diagnostic::error("entry.notFound", "Entry was not found.")
        }
        OperationError::EntryAmbiguous => {
            Diagnostic::error("entry.ambiguous", "Entry locator matched multiple files.")
        }
        OperationError::ViewNotFound(view) => {
            Diagnostic::error("view.notFound", "View was not found.").with_actual(view)
        }
        OperationError::ViewAmbiguous(view) => {
            Diagnostic::error("view.ambiguous", "View locator matched multiple files.")
                .with_actual(view)
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

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_yml::Value;

    use super::{
        OperationError, SkillSource, WorkspaceFileFeature, WorkspaceHealthCategory,
        build_workspace_health_result, create_entry, inspect_config, inspect_entry_by_path,
        is_public_workspace_path_allowed, is_raw_workspace_path_allowed, list_file_references,
        list_files, resolve_reference, skills_get, skills_list, workspace_dashboard,
        workspace_explorer, workspace_explorer_entries, workspace_health,
    };
    use crate::{Diagnostic, IndexEntry, OperationStatus, ReferenceIntent, WorkspaceFileKind};

    const FIXTURE_VIEWS_DIR: &str = ".forma/views";

    fn copy_starter_workspace(root: &Path) {
        let source = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("examples/getting-started-workspace");
        copy_dir_recursive(&source, root);
        remove_guideline_references(root);
        clear_starter_content(root);
    }

    fn copy_dir_recursive(source: &Path, target: &Path) {
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

    fn clear_starter_content(root: &Path) {
        for directory in ["notes", "tasks", "members", "guidelines"] {
            let path = root.join(directory);
            if path.exists() {
                fs::remove_dir_all(&path).unwrap();
            }
            fs::create_dir_all(path).unwrap();
        }
    }

    fn remove_guideline_references(root: &Path) {
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

    fn write_config(root: &Path, yaml: impl AsRef<str>) {
        fs::write(
            root.join(".forma.md"),
            format!("---\n{}---\n\n# Forma Workspace\n", yaml.as_ref()),
        )
        .unwrap();
    }

    #[test]
    fn config_inspect_returns_effective_config_sources_and_diagnostics() {
        let root = fixture_root("config-inspect");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);

        let result = inspect_config(&root, None).unwrap();

        assert_eq!(result.operation, "config.inspect");
        assert_eq!(result.status, OperationStatus::Passed);
        assert_eq!(
            result.workspace.name,
            "Choral Forma Getting Started Workspace"
        );
        assert_eq!(
            result.config["workspace"]["timezone"],
            Value::String("UTC".to_string())
        );
        assert!(
            result
                .sources
                .iter()
                .any(|source| source.path == ".forma.md" && source.present)
        );
        assert!(result.sources.iter().all(|source| source.present));
        assert_eq!(
            result.source_patterns,
            vec![
                ".forma/local/*.md".to_string(),
                ".forma/spaces/*.md".to_string(),
                ".forma/views/*.md".to_string(),
            ]
        );

        let narrowed = inspect_config(&root, Some(".forma.md")).unwrap();
        assert_eq!(
            narrowed.config["workspace"]["name"],
            Value::String("Choral Forma Getting Started Workspace".to_string())
        );
        assert!(narrowed.config.get("imports").is_some());

        fs::write(root.join("notes.yml"), "secret: value").unwrap();
        assert!(matches!(
            inspect_config(&root, Some("notes.yml")),
            Err(OperationError::ConfigPathNotInspectable(path)) if path == "notes.yml"
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn inspect_by_path_returns_view_metadata_without_requiring_a_content_mount() {
        let root = fixture_root("inspect-view-metadata");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        let view_path = root.join(".forma/views/recent.md");
        let source = fs::read_to_string(&view_path).unwrap();
        fs::write(&view_path, source.replace("\n<!-- forma:content -->", "")).unwrap();

        let result = inspect_entry_by_path(&root, ".forma/views/recent.md").unwrap();

        assert_eq!(result.entry.kind.as_deref(), Some("view"));
        assert_eq!(result.entry.space, None);
        assert_eq!(result.entry.path, ".forma/views/recent.md");
        assert_eq!(
            result.entry.metadata["kind"],
            Value::String("view".to_string())
        );
    }

    #[test]
    fn config_inspect_returns_all_space_include_patterns() {
        let root = fixture_root("config-inspect-space-include-patterns");
        fs::create_dir_all(root.join(".forma/spaces")).unwrap();
        write_config(
            &root,
            r#"schemaVersion: 1
workspace:
  name: Include Pattern Inspect
  canonicalLanguage: en
  supportedLanguages:
    - en
  timezone: UTC
imports:
  - .forma/spaces/*.md
"#,
        );
        fs::write(
            root.join(".forma/spaces/notes.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
  - notes/**/*.md
  - research/**/*.md
schema:
  type: object
  fields:
    title:
      type: string
---

# Notes
"#,
        )
        .unwrap();

        let result = inspect_config(&root, None).unwrap();

        assert_eq!(
            result.config["spaces"]["notes"]["include"],
            Value::String("notes/**/*.md".to_string())
        );
        assert_eq!(
            result.config["spaces"]["notes"]["includePatterns"],
            Value::Sequence(vec![
                Value::String("notes/**/*.md".to_string()),
                Value::String("research/**/*.md".to_string()),
            ])
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_get_builtin_cli_core_without_workspace_config() {
        let root = fixture_root("skills-builtin-no-config");
        fs::create_dir_all(&root).unwrap();

        let result = skills_get(&root, "forma-cli-core", false).unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        let skill = result.skill.expect("built-in skill should be returned");
        assert_eq!(skill.id, "forma-cli-core");
        assert_eq!(skill.source, SkillSource::BuiltIn);
        assert!(skill.content.contains("# Forma CLI Core"));
        assert!(skill.content.contains("Built-in skill: forma-cli-core"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_get_builtin_cli_core_with_malformed_workspace_config() {
        let root = fixture_root("skills-builtin-malformed-config");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join(".forma.md"), "---\nschemaVersion: [\n---\n").unwrap();

        let result = skills_get(&root, "forma-cli-core", false).unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        let skill = result.skill.expect("built-in skill should be returned");
        assert_eq!(skill.id, "forma-cli-core");
        assert_eq!(skill.source, SkillSource::BuiltIn);
        assert!(skill.content.contains("Built-in skill: forma-cli-core"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_list_discovers_skill_metadata_from_configured_guidelines() {
        let root = fixture_root("skills-list");
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
        );
        fs::write(
            root.join("knowledge/guidelines/authoring.md"),
            "---\ntitle: Content Capture\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n  triggers:\n    - create shared content\n  order: 20\n---\n\n# Content Capture\n\n## Agent Skill\n\nFollow the workflow.\n",
        )
        .unwrap();

        let result = skills_list(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        assert!(
            result
                .skills
                .iter()
                .any(|skill| skill.id == "forma-cli-core")
        );
        let skill = result
            .skills
            .iter()
            .find(|skill| skill.id == "markdown-authoring")
            .expect("workspace skill should be discovered");
        assert_eq!(skill.source, SkillSource::Guideline);
        assert_eq!(skill.source_path, "knowledge/guidelines/authoring.md");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_list_returns_builtin_skills_when_workspace_config_is_missing() {
        let root = fixture_root("skills-list-no-config");
        fs::create_dir_all(&root).unwrap();

        let result = skills_list(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Warning);
        assert!(
            result
                .skills
                .iter()
                .any(|skill| skill.id == "forma-cli-core")
        );
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "skills.workspaceUnavailable")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_list_keeps_builtins_when_configured_guideline_is_missing() {
        let root = fixture_root("skills-list-missing-guideline");
        fs::create_dir_all(&root).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/missing.md\n",
        );

        let result = skills_list(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Warning);
        assert!(
            result
                .skills
                .iter()
                .any(|skill| skill.id == "forma-cli-core")
        );
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "skills.guidelineReadFailed")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_list_reports_invalid_skill_metadata() {
        let root = fixture_root("skills-list-invalid-metadata");
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/invalid.md\n",
        );
        fs::write(
            root.join("knowledge/guidelines/invalid.md"),
            "---\nskill:\n  title: Missing Id\n---\n\n# Invalid\n",
        )
        .unwrap();

        let result = skills_list(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "skills.invalidMetadata")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_list_fails_when_workspace_reuses_builtin_id() {
        let root = fixture_root("skills-duplicate-builtin");
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/core.md\n",
        );
        fs::write(
            root.join("knowledge/guidelines/core.md"),
            "---\nskill:\n  id: forma-cli-core\n  title: Bad Override\n  description: Should not override built-in.\n---\n\n# Bad\n",
        )
        .unwrap();

        let result = skills_list(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "skills.duplicateId")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_get_builtin_fails_when_workspace_reuses_builtin_id() {
        let root = fixture_root("skills-get-duplicate-builtin");
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/core.md\n",
        );
        fs::write(
            root.join("knowledge/guidelines/core.md"),
            "---\nskill:\n  id: forma-cli-core\n  title: Bad Override\n  description: Should not override built-in.\n---\n\n# Bad\n",
        )
        .unwrap();

        let result = skills_get(&root, "forma-cli-core", false).unwrap();

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(result.skill.is_none());
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "skills.duplicateId")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_get_returns_markdown_content_for_workspace_skill() {
        let root = fixture_root("skills-get");
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
        );
        fs::write(
            root.join("knowledge/guidelines/authoring.md"),
            "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Content Capture\n\n## Purpose\n\nHuman-facing background.\n\n## Agent Skill\n\nFollow the workflow.\n\n### Details\n\nKeep agent details.\n\n## Reference\n\nFull reference material.\n",
        )
        .unwrap();

        let result = skills_get(&root, "markdown-authoring", false).unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        let skill = result.skill.unwrap();
        assert_eq!(skill.source, SkillSource::Guideline);
        assert!(
            skill
                .content
                .contains("Source guideline: knowledge/guidelines/authoring.md")
        );
        assert!(skill.content.contains("## Agent Skill"));
        assert!(skill.content.contains("Follow the workflow."));
        assert!(skill.content.contains("Keep agent details."));
        assert!(!skill.content.contains("Human-facing background."));
        assert!(!skill.content.contains("Full reference material."));

        let full_result = skills_get(&root, "markdown-authoring", true).unwrap();
        let full_skill = full_result.skill.unwrap();
        assert!(full_skill.content.contains("Human-facing background."));
        assert!(full_skill.content.contains("Full reference material."));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_get_falls_back_to_full_guideline_when_agent_skill_section_is_missing() {
        let root = fixture_root("skills-get-without-agent-section");
        fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
        );
        fs::write(
            root.join("knowledge/guidelines/authoring.md"),
            "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Content Capture\n\n## Purpose\n\nLegacy guideline body.\n",
        )
        .unwrap();

        let result = skills_get(&root, "markdown-authoring", false).unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        let skill = result.skill.unwrap();
        assert!(skill.content.contains("Legacy guideline body."));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skills_get_fails_when_skill_is_missing() {
        let root = fixture_root("skills-missing");
        fs::create_dir_all(&root).unwrap();
        write_config(
            &root,
            "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\n",
        );

        let result = skills_get(&root, "missing", false).unwrap();

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "skills.notFound")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_uses_path_derived_entry_ids() {
        let root = fixture_root("dashboard-entry-ids");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
    fn workspace_explorer_returns_compact_term_summaries_without_entries() {
        let root = fixture_root("workspace-explorer-compact");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/guide.md"),
            "---\nkind: note\ntitle: Guide\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n",
        )
        .unwrap();

        let result = workspace_explorer(&root).unwrap();
        let value = serde_json::to_value(&result).unwrap();
        let notes = result
            .taxonomies
            .iter()
            .flat_map(|taxonomy| taxonomy.terms.iter())
            .find(|term| term.id == "notes")
            .unwrap();

        assert_eq!(result.operation, "workspace.explorer");
        assert_eq!(notes.entry_count, 1);
        assert!(value["taxonomies"][0]["terms"][0].get("entries").is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_explorer_entries_paginates_term_entries() {
        let root = fixture_root("workspace-explorer-pagination");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        for index in 0..3 {
            fs::write(
                root.join(format!("notes/note-{index}.md")),
                format!(
                    "---\nkind: note\ntitle: Note {index}\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n"
                ),
            )
            .unwrap();
        }

        let first = workspace_explorer_entries(&root, "spaces", "notes", None, 2).unwrap();
        let second =
            workspace_explorer_entries(&root, "spaces", "notes", first.next_cursor.as_deref(), 2)
                .unwrap();

        assert_eq!(first.entries.len(), 2);
        assert_eq!(first.next_cursor.as_deref(), Some("2"));
        assert_eq!(first.total, 3);
        assert_eq!(second.entries.len(), 1);
        assert_eq!(second.next_cursor, None);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_exposes_configured_taxonomies_without_spaces() {
        let root = fixture_root("dashboard-generic-taxonomy");
        fs::create_dir_all(root.join(".forma/classification")).unwrap();
        fs::create_dir_all(root.join("docs")).unwrap();
        write_config(
            &root,
            r#"schemaVersion: 1
workspace:
  name: Generic Taxonomy
  canonicalLanguage: en
  supportedLanguages: [en]
  timezone: UTC
imports:
  - .forma/classification/*.md
"#,
        );
        fs::write(
            root.join(".forma/classification/topics.md"),
            "---\nschemaVersion: 1\nkind: taxonomy\nid: topics\ntitle: Topics\nmode: multiple\ndisplay:\n  order: 5\n---\n",
        )
        .unwrap();
        fs::write(
            root.join(".forma/classification/guides.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: topics\ntitle: Guides\ninclude:\n  - docs/**/*.md\n---\n",
        )
        .unwrap();
        fs::write(
            root.join("docs/getting-started.md"),
            "---\ntitle: Getting Started\nsummary: First guide.\n---\n\n# Getting Started\n",
        )
        .unwrap();

        let result = workspace_dashboard(&root).unwrap();

        assert!(result.spaces.is_empty());
        assert_eq!(result.taxonomies.len(), 1);
        assert_eq!(result.taxonomies[0].id, "topics");
        assert_eq!(result.taxonomies[0].title, "Topics");
        assert_eq!(result.taxonomies[0].terms[0].id, "guides");
        assert_eq!(result.taxonomies[0].terms[0].title, "Guides");
        assert_eq!(result.taxonomies[0].terms[0].entry_count, 1);
        assert_eq!(
            result.taxonomies[0].terms[0].entries[0].path,
            "docs/getting-started.md"
        );
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].space, None);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_exposes_page_and_raw_paths_for_markdown_entries() {
        let root = fixture_root("dashboard-page-paths");
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join("notes/nested")).unwrap();
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
        copy_starter_workspace(&root);
        write_config(
            &root,
            r#"schemaVersion: 1
workspace:
  name: Dashboard Language Variants
  canonicalLanguage: en
  supportedLanguages:
    - en
    - zh-Hans
  timezone: UTC
imports:
  - .forma/spaces/*.md
  - .forma/views/*.md
"#,
        );
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
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join("assets")).unwrap();
        write_config(
            &root,
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
imports:
  - ".forma/spaces/*.md"
  - ".forma/views/*.md"
"#,
        );
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
        copy_starter_workspace(&root);

        let result = workspace_dashboard(&root).unwrap();
        let notes_view = result
            .views
            .iter()
            .find(|view| view.id == ".forma/views/notes")
            .unwrap();
        let value = serde_json::to_value(notes_view).unwrap();

        assert_eq!(value["space"], serde_json::json!("notes"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_dashboard_sorts_spaces_and_views_by_display_order() {
        let root = fixture_root("dashboard-display-order");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);

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
        fs::remove_dir_all(root.join(FIXTURE_VIEWS_DIR)).unwrap();
        fs::create_dir_all(root.join(FIXTURE_VIEWS_DIR)).unwrap();
        fs::write(
            root.join(format!("{FIXTURE_VIEWS_DIR}/alpha.md")),
            "---\nkind: view\nmode: table\ntitle: Alpha\ndisplay:\n  order: 20\nsource:\n  type: pages\n---\n\n# Alpha\n\n<!-- forma:content -->\n",
        )
        .unwrap();
        fs::write(
            root.join(format!("{FIXTURE_VIEWS_DIR}/beta.md")),
            "---\nkind: view\nmode: table\ntitle: Beta\nsource:\n  type: pages\n---\n\n# Beta\n\n<!-- forma:content -->\n",
        )
        .unwrap();
        fs::write(
            root.join(format!("{FIXTURE_VIEWS_DIR}/zeta.md")),
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
            vec!["tasks", "members", "notes", "guidelines"]
        );
        assert_eq!(
            result
                .views
                .iter()
                .map(|view| view.id.as_str())
                .collect::<Vec<_>>(),
            vec![
                ".forma/views/zeta",
                ".forma/views/alpha",
                ".forma/views/beta"
            ]
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_returns_navigation_files_with_entry_and_view_classification() {
        let root = fixture_root("files-list");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
                && file.kind == WorkspaceFileKind::Content
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
        assert!(
            result
                .files
                .iter()
                .any(|file| { file.path == ".forma.md" && file.kind == WorkspaceFileKind::Config })
        );
        assert!(result.files.iter().any(|file| {
            file.path == ".forma/views/notes.md" && file.kind == WorkspaceFileKind::View
        }));
        assert!(result.files.iter().any(|file| {
            file.path == ".forma/spaces/templates/note.md"
                && file.kind == WorkspaceFileKind::Template
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_entry_from_repository_starter_templates_uses_in_memory_index() {
        let root = fixture_root("repository-starter-create");
        copy_dir_all(
            repository_root().join("examples/getting-started-workspace"),
            &root,
        )
        .unwrap();

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
        assert!(source.contains("title: \"Review Starter Create\""));
        assert!(source.contains("assignees: []"));

        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.diagnostics.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_entry_uses_starter_templates() {
        let root = fixture_root("create-starter-templates");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);

        create_entry(
            &root,
            "notes",
            [(
                "title".to_string(),
                Value::String("Created Note".to_string()),
            )]
            .into(),
        )
        .unwrap();
        create_entry(
            &root,
            "tasks",
            [(
                "title".to_string(),
                Value::String("Created Task".to_string()),
            )]
            .into(),
        )
        .unwrap();
        create_entry(
            &root,
            "members",
            [(
                "name".to_string(),
                Value::String("Created Member".to_string()),
            )]
            .into(),
        )
        .unwrap();

        let task = fs::read_to_string(root.join("tasks/created-task.md")).unwrap();
        assert!(root.join("notes/created-note.md").is_file());
        assert!(root.join("members/created-member.md").is_file());
        assert!(task.contains("priority: \"medium\""));
        assert!(root.join(".forma/views/tasks.md").is_file());
        assert!(root.join(".forma/spaces/templates/guideline.md").is_file());
        assert!(root.join("tasks").is_dir());
        assert!(root.join("members").is_dir());
        assert!(root.join("guidelines").is_dir());
        assert!(!root.join("todos").exists());
        assert!(!root.join("users").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_entry_renders_directory_and_filename_templates_with_same_inputs() {
        let root = fixture_root("create-directory-template");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/spaces/notes.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
  - notes/**/*.md
create:
  directory: "notes/{{ input.collection }}"
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/note.md
  inputs:
    title:
      required: true
    collection:
      required: true
      transform: slugify
    summary:
      default: ""
    slug:
      default: "{{ input.title }}"
      transform: slugify
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Notes
"#,
        )
        .unwrap();

        let result = create_entry(
            &root,
            "notes",
            [
                (
                    "title".to_string(),
                    Value::String("Directory Template".to_string()),
                ),
                (
                    "collection".to_string(),
                    Value::String("Research Notes".to_string()),
                ),
            ]
            .into(),
        )
        .unwrap();

        assert_eq!(
            result.created.path,
            "notes/research-notes/directory-template.md"
        );
        assert!(
            root.join("notes/research-notes/directory-template.md")
                .is_file()
        );
        assert!(!root.join("notes/{{ input.collection }}").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn create_entry_rejects_unresolved_directory_template() {
        let root = fixture_root("create-directory-template-unresolved");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/spaces/notes.md"),
            r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
include:
  - notes/**/*.md
create:
  directory: "notes/{{ input.collection }}"
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/note.md
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      default: "{{ input.title }}"
      transform: slugify
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Notes
"#,
        )
        .unwrap();

        let error = create_entry(
            &root,
            "notes",
            [(
                "title".to_string(),
                Value::String("Directory Template".to_string()),
            )]
            .into(),
        )
        .unwrap_err();

        assert!(matches!(
            error,
            OperationError::InvalidInput(field) if field == "directory"
        ));
        assert!(!root.join("notes/{{ input.collection }}").exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_returns_workspace_files_with_neutral_kinds() {
        let root = fixture_root("workspace-file-kinds");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
        assert_eq!(knowledge.kind, WorkspaceFileKind::Content);
        let knowledge_json = serde_json::to_value(knowledge).unwrap();
        assert_eq!(knowledge_json["kind"], serde_json::json!("content"));
        assert_eq!(knowledge.space.as_deref(), Some("notes"));
        assert_eq!(knowledge.title.as_deref(), Some("Neutral File Model"));

        assert!(
            result
                .files
                .iter()
                .any(|file| { file.path == ".forma.md" && file.kind == WorkspaceFileKind::Config })
        );
        assert!(result.files.iter().any(|file| {
            file.path == ".forma/views/notes.md" && file.kind == WorkspaceFileKind::View
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_reports_media_type_and_resource_preview_features() {
        let root = fixture_root("workspace-file-media-types");
        fs::create_dir_all(root.join("assets")).unwrap();
        copy_starter_workspace(&root);
        let notes_config = root.join(".forma/spaces/notes.md");
        let source = fs::read_to_string(&notes_config).unwrap();
        fs::write(
            &notes_config,
            source.replace(
                "include:\n  - \"notes/**/*.md\"",
                "include:\n  - \"notes/**/*.md\"\n  - \"assets/**/*\"",
            ),
        )
        .unwrap();
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
    fn files_list_classifies_templates_from_space_configuration() {
        let root = fixture_root("files-list-configured-template");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join(".forma/spaces/notes.md"),
            "---\nschemaVersion: 1\nkind: term\ntaxonomy: spaces\ntitle: Notes\ninclude:\n  - notes/**/*.md\ncreate:\n  directory: notes\n  filename: \"{{ input.slug }}.md\"\n  template: templates/note.md\n  inputs:\n    title:\n      required: true\nconventions:\n  titleField: fields.title\n  summaryField: fields.summary\n---\n\n# Notes\n",
        )
        .unwrap();
        fs::create_dir_all(root.join("templates")).unwrap();
        fs::write(
            root.join("templates/note.md"),
            "---\ntitle: Template\n---\n",
        )
        .unwrap();

        let result = list_files(&root).unwrap();

        let template = result
            .files
            .iter()
            .find(|file| file.path == "templates/note.md")
            .unwrap();
        assert_eq!(template.kind, WorkspaceFileKind::Template);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_does_not_treat_forma_local_as_intrinsically_private() {
        let root = fixture_root("files-list-forma-local-public");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join(".forma/local")).unwrap();
        fs::write(
            root.join(".forma/local/profile.md"),
            "---\nspaces: {}\n---\n",
        )
        .unwrap();

        let result = list_files(&root).unwrap();

        assert!(
            result
                .files
                .iter()
                .any(|file| file.path == ".forma/local/profile.md")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn files_list_ignores_files_outside_configured_includes() {
        let root = fixture_root("files-list-gitignore-not-special");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(root.join(".gitignore"), "private/\n").unwrap();
        fs::create_dir_all(root.join("private")).unwrap();
        fs::write(root.join("private/secret.md"), "# Secret\n").unwrap();

        let result = list_files(&root).unwrap();

        assert!(
            result
                .files
                .iter()
                .all(|file| file.path != "private/secret.md")
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn raw_workspace_path_policy_excludes_config_entry_path() {
        assert!(!is_raw_workspace_path_allowed(".forma.md"));
        assert!(is_raw_workspace_path_allowed(".forma/local/profile.md"));
        assert!(is_raw_workspace_path_allowed(".forma/assets/logo.svg"));
        assert!(is_raw_workspace_path_allowed("notes/public.md"));
    }

    #[test]
    fn public_workspace_paths_exclude_config_sources_not_forma_directory_names() {
        let root = fixture_root("public-forma-assets");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::create_dir_all(root.join(".forma/assets")).unwrap();
        fs::write(root.join(".forma/assets/logo.svg"), "<svg></svg>").unwrap();

        assert!(is_public_workspace_path_allowed(
            &root,
            ".forma/assets/logo.svg"
        ));
        assert!(!is_public_workspace_path_allowed(&root, ".forma.md"));
        assert!(!is_public_workspace_path_allowed(
            &root,
            ".forma/views/notes.md"
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn file_references_returns_outgoing_references_and_backlinks() {
        let root = fixture_root("references-list");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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
        copy_starter_workspace(&root);
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
        copy_starter_workspace(&root);
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
        copy_starter_workspace(&root);

        assert!(matches!(
            list_file_references(&root, "notes/missing.md"),
            Err(OperationError::EntryNotFound)
        ));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_resolve_handles_relative_paths_and_heading_fragments() {
        let root = fixture_root("reference-resolve");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();
        fs::create_dir_all(root.join("notes/guides")).unwrap();
        fs::write(
            root.join("notes/guides/target.md"),
            "---\nkind: note\ntitle: Target\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Target\n\n## Getting Started\n",
        )
        .unwrap();

        let result = resolve_reference(
            &root,
            "notes/source.md",
            "guides/target.md#Getting Started",
            ReferenceIntent::Link,
            None,
        )
        .unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        let target = result.target.unwrap();
        assert_eq!(target.path, "notes/guides/target.md");
        assert_eq!(target.fragment.as_deref(), Some("Getting Started"));
        assert!(target.fragment_location.is_some());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_resolve_reports_ambiguity_without_guessing() {
        let root = fixture_root("reference-resolve-ambiguous");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();
        for directory in ["notes/a", "notes/b"] {
            fs::create_dir_all(root.join(directory)).unwrap();
            fs::write(
                root.join(directory).join("same.md"),
                format!("---\nkind: note\ntitle: {directory}\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Same\n"),
            )
            .unwrap();
        }

        let result = resolve_reference(
            &root,
            "notes/source.md",
            "same",
            ReferenceIntent::Reference,
            None,
        )
        .unwrap();

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(result.target.is_none());
        assert_eq!(result.candidates.len(), 2);
        assert_eq!(result.diagnostics[0].code, "reference.ambiguous");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_resolve_uses_schema_informed_semantic_references() {
        let root = fixture_root("reference-resolve-semantic");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("members/tiscs.md"),
            "---\nname: Tiscs\ndescription: \"\"\nresponsibilities: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\nupdatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Tiscs\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/tiscs.md"),
            "---\ntitle: Tiscs Note\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\nupdatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Tiscs Note\n",
        )
        .unwrap();
        fs::write(
            root.join("tasks/source.md"),
            "---\ntitle: Source\nsummary: \"\"\nstatus: todo\npriority: medium\nowners: []\nassignees: [tiscs]\nreviewers: []\nblockedBy: []\ndueDate: \"\"\n---\n\n# Source\n",
        )
        .unwrap();

        let result = resolve_reference(
            &root,
            "tasks/source.md",
            "tiscs",
            ReferenceIntent::Reference,
            None,
        )
        .unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        assert_eq!(
            result.target.map(|target| target.path),
            Some("members/tiscs.md".to_string())
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reference_resolve_preserves_case_and_rejects_source_path_escape() {
        let root = fixture_root("reference-resolve-path-safety");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/source.md"),
            "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
        )
        .unwrap();
        fs::write(
            root.join("notes/Target.md"),
            "---\nkind: note\ntitle: Target\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Target\n",
        )
        .unwrap();

        let case_mismatch = resolve_reference(
            &root,
            "notes/source.md",
            "target",
            ReferenceIntent::Link,
            None,
        )
        .unwrap();
        assert_eq!(case_mismatch.status, OperationStatus::Failed);
        assert!(case_mismatch.target.is_none());
        assert!(matches!(
            resolve_reference(
                &root,
                "../outside.md",
                "target",
                ReferenceIntent::Link,
                None,
            ),
            Err(OperationError::InvalidPath(_))
        ));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_health_reports_broken_references_and_orphan_pages() {
        let root = fixture_root("workspace-health-broken");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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

        let result = workspace_health(&root).unwrap();

        assert_eq!(result.operation, "workspace.health");
        assert_eq!(result.status, OperationStatus::Warning);
        assert_eq!(result.workspace.root, ".");
        assert_eq!(
            result.workspace.name,
            "Choral Forma Getting Started Workspace"
        );
        assert!(result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::BrokenReference
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::NoOutgoingReferences
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::NoBacklinks
                && finding.path == "notes/linked.md"
        }));
        assert!(result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::NoBacklinks
                && finding.path == "notes/orphan.md"
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_health_reports_self_links_as_isolated() {
        let root = fixture_root("workspace-health-self-link");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("notes/self.md"),
            "---\nkind: note\ntitle: Self\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Self\n\nSee [[notes/self]].\n",
        )
        .unwrap();

        let result = workspace_health(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Warning);
        assert!(result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::NoOutgoingReferences
                && finding.path == "notes/self.md"
        }));
        assert!(result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::NoBacklinks
                && finding.path == "notes/self.md"
        }));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_health_reports_config_diagnostic_for_missing_workspace_root() {
        let root = fixture_root("workspace-health-missing-forma");
        fs::create_dir_all(&root).unwrap();

        let result = workspace_health(&root).unwrap();

        assert_eq!(result.operation, "workspace.health");
        assert_eq!(result.status, OperationStatus::Failed);
        assert_eq!(result.workspace.root, ".");
        assert_eq!(result.workspace.name, "Unknown Workspace");
        assert_eq!(result.findings.len(), 1);
        assert_eq!(
            result.findings[0].category,
            WorkspaceHealthCategory::ConfigDiagnostic
        );
        assert_eq!(result.findings[0].path, ".forma.md");
        assert_eq!(result.summary.errors, 1);
        assert_eq!(result.summary.warnings, 0);
        assert_eq!(result.diagnostics.len(), 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_health_passes_for_clean_workspace() {
        let root = fixture_root("workspace-health-clean");
        fs::create_dir_all(&root).unwrap();
        copy_starter_workspace(&root);
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

        let result = workspace_health(&root).unwrap();

        assert_eq!(result.operation, "workspace.health");
        assert_eq!(result.status, OperationStatus::Passed);
        assert!(result.findings.is_empty());
        assert!(result.diagnostics.is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_health_preserves_transform_failed_diagnostics_without_isolation_findings() {
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
            Diagnostic::error(
                "entryRef.transformFailed",
                "Reference input transform failed.",
            )
            .with_path("notes/linked.md")
            .with_actual("unknown transform `badTransform`"),
        ];

        let result = build_workspace_health_result("Synthetic Workspace", &entries, &diagnostics);

        assert_eq!(result.status, OperationStatus::Failed);
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "entryRef.transformFailed")
        );
        assert!(!result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::ConfigDiagnostic
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::NoOutgoingReferences
                && finding.path == "notes/linked.md"
        }));
        assert!(!result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::NoBacklinks
                && finding.path == "notes/linked.md"
        }));
    }

    #[test]
    fn workspace_health_ignores_markdown_outside_configured_includes() {
        let root = fixture_root("workspace-health-unclassified-diagnostic");
        fs::create_dir_all(root.join("assets")).unwrap();
        copy_starter_workspace(&root);
        fs::write(
            root.join("assets/missing.png.md"),
            "---\nkind: resourceDescription\ntitle: Missing Image\n---\n\n# Missing Image\n",
        )
        .unwrap();

        let result = workspace_health(&root).unwrap();

        assert_eq!(result.status, OperationStatus::Passed);
        assert!(
            result
                .diagnostics
                .iter()
                .all(|diagnostic| diagnostic.code != "resource.description.missingTarget")
        );
        assert!(!result.findings.iter().any(|finding| {
            finding.category == WorkspaceHealthCategory::ConfigDiagnostic
                && finding.path == "assets/missing.png.md"
        }));
        assert_eq!(result.summary.errors, 0);

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
