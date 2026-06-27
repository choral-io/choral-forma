pub mod config;
pub mod diagnostics;
pub mod docs;
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
pub use docs::{DocsError, EmbeddedDoc, EmbeddedSkill, embedded_doc, embedded_docs};
pub use index::{
    CheckResult, Discovery, IndexEntry, IndexReference, IndexSpace, IndexView, IndexWorkspace,
    ReferenceIntent, ReferenceSource, SummaryIndex, check_workspace, discover_workspace,
};
pub use markdown::{
    FormaMarkdownDocument, FormaReference, FormaReferenceIntent, FormaReferenceSource,
    FormaReferenceSyntax, ParsedFrontmatter, SourceSpan, split_frontmatter,
};
pub use operations::{
    BoardColumn, BoardShowResult, ConfigInspectResult, ConfigSource, CreateInputResult,
    CreateInputSource, CreateResult, CreatedEntry, DashboardEntrySummary, DashboardSpace,
    DashboardViewSummary, FileReferencesResult, FilesListResult, InitResult, InspectEntry,
    InspectResult, ListEntry, ListResult, ListedSpace, OperationError, ReferenceEdge,
    ReferenceFile, SkillDetail, SkillSource, SkillSummary, SkillsGetResult, SkillsListResult,
    TaskSummary, TasksInspectResult, TasksListResult, WorkspaceDashboardResult, WorkspaceFile,
    WorkspaceFileFeature, WorkspaceFileKind, WorkspaceLogoSummary, WorkspaceSummary, board_show,
    create_entry, detect_environment_timezone, init_workspace, inspect_config,
    inspect_entry_by_path, inspect_entry_by_space, is_public_workspace_path_allowed,
    is_raw_workspace_path_allowed, list_file_references, list_files, list_space,
    media_type_for_workspace_path, operation_error_diagnostic, skills_get, skills_list,
    tasks_inspect, tasks_list, workspace_dashboard,
};
pub use path::{
    FORMA_CONFIG_PATH, PathError, WorkspacePath, normalize_cli_path, slugify_path_segment,
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
