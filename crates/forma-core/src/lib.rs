pub mod config;
pub mod diagnostics;
pub mod index;
pub mod markdown;
pub mod operations;
pub mod path;
pub mod render;
pub mod schema;

pub use config::{
    ConfigError, FormaWorkspace, LoadMode, SpaceDefinition, WorkspaceConfig, load_workspace,
};
pub use diagnostics::{
    Diagnostic, DiagnosticLocation, DiagnosticSeverity, DiagnosticSummary, OperationStatus,
};
pub use index::{
    CheckResult, Discovery, IndexEntry, IndexRebuildResult, IndexReference, IndexSpace, IndexView,
    IndexWorkspace, ReferenceIntent, ReferenceSource, SummaryIndex, check_workspace,
    discover_workspace, index_check, index_rebuild, summary_index_json,
};
pub use markdown::{
    FormaMarkdownDocument, FormaReference, FormaReferenceIntent, FormaReferenceSource,
    FormaReferenceSyntax, ParsedFrontmatter, SourceSpan, split_frontmatter,
};
pub use operations::{
    ConfigInspectResult, ConfigSource, ConfigSourceKind, CreateIndexStatus, CreateInputResult,
    CreateInputSource, CreateResult, CreatedEntry, DashboardEntrySummary, DashboardSpace,
    DashboardViewSummary, FileReferencesResult, FilesListResult, InitResult, InspectEntry,
    InspectResult, ListEntry, ListResult, ListedSpace, OperationError, ReferenceEdge,
    ReferenceFile, WorkspaceDashboardResult, WorkspaceFile, WorkspaceFileFeature,
    WorkspaceFileKind, WorkspaceLogoSummary, WorkspaceSummary, create_entry,
    detect_environment_timezone, init_workspace, inspect_config, inspect_entry_by_path,
    inspect_entry_by_space, is_raw_workspace_path_allowed, list_file_references, list_files,
    list_space, media_type_for_workspace_path, operation_error_diagnostic, workspace_dashboard,
};
pub use path::{
    FORMA_DIR, FORMA_GITIGNORE_PATH, FORMA_INDEX_SUMMARY_PATH, FORMA_LOCAL_OVERRIDES_PATH,
    FORMA_SETTINGS_PATH, FORMA_SPACES_PATH, FORMA_TEMPLATES_DIR, FORMA_TYPES_PATH, FORMA_VIEWS_DIR,
    PathError, WorkspacePath, normalize_cli_path, slugify_path_segment,
};
pub use render::{
    FileRenderOutput, FileRenderResult, GraphRenderEdge, GraphRenderNode, KanbanRenderColumn,
    RenderedFile, RenderedHeading, RenderedView, ViewRenderItem, ViewRenderOutput,
    ViewRenderResult, render_file, render_view,
};
pub use schema::{
    PlaceholderContext, RenderedTemplate, ResolvedCreateInputs, RuntimeValues, SchemaNode,
    TemplateValueResolver, Transform, render_placeholder_template, resolve_create_inputs,
    resolve_runtime_values, validate_schema_value, validate_space_schemas,
};

/// Returns the current Forma core crate version.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::version;

    #[test]
    fn exposes_package_version() {
        assert_eq!(version(), "0.1.0");
    }
}
