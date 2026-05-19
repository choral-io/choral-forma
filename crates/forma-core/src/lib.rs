pub mod config;
pub mod diagnostics;
pub mod markdown;
pub mod path;
pub mod schema;

pub use config::{
    CollectionDefinition, ConfigError, FormaWorkspace, LoadMode, WorkspaceConfig, load_workspace,
};
pub use diagnostics::{
    Diagnostic, DiagnosticLocation, DiagnosticSeverity, DiagnosticSummary, OperationStatus,
};
pub use markdown::{
    FormaMarkdownDocument, FormaReference, FormaReferenceIntent, FormaReferenceSource,
    FormaReferenceSyntax, ParsedFrontmatter, SourceSpan, split_frontmatter,
};
pub use path::{PathError, WorkspacePath, normalize_cli_path, slugify_path_segment};
pub use schema::{
    PlaceholderContext, ResolvedCreateInputs, RuntimeValues, SchemaNode, TemplateValueResolver,
    Transform, resolve_create_inputs, resolve_runtime_values, validate_collection_schemas,
    validate_schema_value,
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
