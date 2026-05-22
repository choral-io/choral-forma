pub mod config;
pub mod diagnostics;
pub mod index;
pub mod markdown;
pub mod operations;
pub mod path;
pub mod render;
pub mod schema;

pub use config::{
    CollectionDefinition, ConfigError, FormaWorkspace, LoadMode, WorkspaceConfig, load_workspace,
};
pub use diagnostics::{
    Diagnostic, DiagnosticLocation, DiagnosticSeverity, DiagnosticSummary, OperationStatus,
};
pub use index::{
    CheckResult, Discovery, IndexCollection, IndexEntry, IndexRebuildResult, IndexReference,
    IndexView, IndexWorkspace, ReferenceIntent, ReferenceSource, SummaryIndex, check_workspace,
    discover_workspace, index_check, index_rebuild, summary_index_json,
};
pub use markdown::{
    FormaMarkdownDocument, FormaReference, FormaReferenceIntent, FormaReferenceSource,
    FormaReferenceSyntax, ParsedFrontmatter, SourceSpan, split_frontmatter,
};
pub use operations::{
    ConfigInspectResult, ConfigSource, ConfigSourceKind, CreateIndexStatus, CreateInputResult,
    CreateInputSource, CreateResult, CreatedEntry, FilesListResult, InitResult, InspectEntry,
    InspectResult, ListEntry, ListResult, ListedCollection, ListedFile, ListedFileKind,
    OperationError, WorkspaceSummary, create_entry, detect_environment_timezone, init_workspace,
    inspect_config, inspect_entry_by_collection, inspect_entry_by_path, list_collection,
    list_files, operation_error_diagnostic,
};
pub use path::{
    FORMA_COLLECTIONS_PATH, FORMA_DIR, FORMA_GITIGNORE_PATH, FORMA_INDEX_SUMMARY_PATH,
    FORMA_LOCAL_OVERRIDES_PATH, FORMA_TEMPLATES_DIR, FORMA_TYPES_PATH, FORMA_VIEWS_DIR,
    FORMA_WORKSPACE_PATH, PathError, WorkspacePath, normalize_cli_path, slugify_path_segment,
};
pub use render::{
    EntryRenderOutput, EntryRenderResult, KanbanRenderColumn, RenderedEntry, RenderedView,
    ViewRenderItem, ViewRenderOutput, ViewRenderResult, render_entry, render_view,
};
pub use schema::{
    PlaceholderContext, RenderedTemplate, ResolvedCreateInputs, RuntimeValues, SchemaNode,
    TemplateValueResolver, Transform, render_placeholder_template, resolve_create_inputs,
    resolve_runtime_values, validate_collection_schemas, validate_schema_value,
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
