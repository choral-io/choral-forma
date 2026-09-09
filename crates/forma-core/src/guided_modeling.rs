//! Guided creation of one explicitly chosen content group.
//!
//! `compile_slice` produces workspace-independent file previews. `prepare_plan`
//! validates those files against an initialized empty corpus; `apply_plan`
//! requires the exact plan id and rechecks preconditions before create-only
//! writes. These are experimental Core/CLI interfaces, not published RPC methods.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::path::WorkspacePath;

/// Supported field choices for the first vertical case, not the full Schema DSL.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FieldKind {
    Text,
    Date,
}

impl FieldKind {
    fn schema_type(self) -> &'static str {
        match self {
            Self::Text => "string",
            Self::Date => "date",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FieldChoice {
    pub kind: FieldKind,
    pub label: String,
    pub required: bool,
    /// The stated need for this field; it is explanation, not proof of approval.
    pub reason: String,
}

/// Every physical destination is explicit. No directory name is a product rule.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SliceLayout {
    pub taxonomy_file: String,
    pub group_file: String,
    pub template_file: String,
    pub view_file: String,
    pub content_directory: String,
}

/// The chosen model, before compilation. Fields belong to this group, not to
/// separate file artifacts. Removing a field recompiles all affected files.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SliceChoice {
    pub outcome: String,
    pub taxonomy_id: String,
    pub group_id: String,
    pub title: String,
    pub fields: BTreeMap<String, FieldChoice>,
    /// Ordered field names; title is always the first column.
    pub view_columns: Vec<String>,
    pub layout: SliceLayout,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FilePreview {
    pub path: String,
    pub content: String,
}

#[derive(Debug, thiserror::Error)]
pub enum CompileError {
    #[error("Invalid modeling choice at {field}: {reason}")]
    InvalidChoice { field: String, reason: String },
    #[error("Cannot encode the generated configuration: {0}")]
    Encoding(#[from] serde_yml::Error),
}

fn invalid(field: impl Into<String>, reason: &str) -> CompileError {
    CompileError::InvalidChoice {
        field: field.into(),
        reason: reason.into(),
    }
}

fn identifier(value: &str, field: &str) -> Result<(), CompileError> {
    if value.is_empty()
        || !value.as_bytes()[0].is_ascii_alphabetic()
        || !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
    {
        return Err(invalid(
            field,
            "use a letter followed by letters, digits, underscores or hyphens",
        ));
    }
    Ok(())
}

fn literal_path(value: &str, field: &str) -> Result<String, CompileError> {
    let path = WorkspacePath::parse_config(value)
        .map_err(|_| invalid(field, "expected a workspace-relative path"))?;
    if path.as_str() == "."
        || value
            .chars()
            .any(|c| c.is_control() || "*?[]{}".contains(c))
    {
        return Err(invalid(
            field,
            "expected a literal non-root path, without glob or template syntax",
        ));
    }
    Ok(path.to_string())
}

fn document(value: &Value) -> Result<String, CompileError> {
    Ok(format!("---\n{}---\n", serde_yml::to_string(value)?))
}

/// Compile all file contents from explicit choices. The return value is a
/// preview only: in particular, it makes no claim about the current workspace.
pub fn compile_slice(choice: &SliceChoice) -> Result<Vec<FilePreview>, CompileError> {
    identifier(&choice.group_id, "groupId")?;
    identifier(&choice.taxonomy_id, "taxonomyId")?;
    if choice.title.trim().is_empty() || choice.outcome.trim().is_empty() {
        return Err(invalid(
            "title/outcome",
            "both must describe the intended content and use",
        ));
    }
    let mut targets = BTreeSet::new();
    let mut paths = Vec::new();
    for (name, path) in [
        ("taxonomyFile", &choice.layout.taxonomy_file),
        ("groupFile", &choice.layout.group_file),
        ("templateFile", &choice.layout.template_file),
        ("viewFile", &choice.layout.view_file),
    ] {
        let path = literal_path(path, name)?;
        if path == ".forma.md" || !path.ends_with(".md") || !targets.insert(path.clone()) {
            return Err(invalid(
                name,
                "expected a distinct Markdown target other than the entry point",
            ));
        }
        paths.push(path);
    }
    let directory = literal_path(&choice.layout.content_directory, "contentDirectory")?;
    if targets
        .iter()
        .any(|p| p == &directory || p.starts_with(&format!("{directory}/")))
    {
        return Err(invalid(
            "contentDirectory",
            "generated control files must not be classified as entries",
        ));
    }
    for left in &targets {
        if targets
            .iter()
            .any(|right| right.starts_with(&format!("{left}/")))
        {
            return Err(invalid(
                "layout",
                "a file cannot be another file's parent directory",
            ));
        }
    }

    let mut schema = BTreeMap::from([(
        "title".to_string(),
        json!({"type":"string", "required":true}),
    )]);
    let mut inputs = BTreeMap::from([
        (
            "title".to_string(),
            json!({"type":"string", "required":true, "label":"Title"}),
        ),
        (
            "slug".to_string(),
            json!({"type":"string", "default":"{{ input.title }}", "transform":"slugify"}),
        ),
    ]);
    let mut template = BTreeMap::from([("title".to_string(), json!("{{ input.title }}"))]);
    for (name, field) in &choice.fields {
        identifier(name, "fields")?;
        if name == "title"
            || name == "slug"
            || field.label.trim().is_empty()
            || field.reason.trim().is_empty()
        {
            return Err(invalid(
                format!("fields.{name}"),
                "title/slug are reserved; each additional field needs a label and reason",
            ));
        }
        schema.insert(
            name.clone(),
            json!({"type":field.kind.schema_type(),"required":field.required,"label":field.label}),
        );
        inputs.insert(
            name.clone(),
            json!({"type":field.kind.schema_type(),"required":field.required,"label":field.label}),
        );
        template.insert(name.clone(), json!(format!("{{{{ input.{name} }}}}")));
    }
    let mut columns =
        vec![json!({"field":"fields.title","label":"Title","link":{"target":"entry"}})];
    let mut seen = BTreeSet::new();
    for name in &choice.view_columns {
        let field = choice
            .fields
            .get(name)
            .ok_or_else(|| invalid("viewColumns", "a column must refer to a selected field"))?;
        if !seen.insert(name) {
            return Err(invalid("viewColumns", "a field cannot appear twice"));
        }
        columns.push(json!({"field":format!("fields.{name}"),"label":field.label}));
    }
    let taxonomy = json!({"schemaVersion":1,"kind":"taxonomy","id":choice.taxonomy_id,"projection":"contentGroups","title":choice.taxonomy_id,"mode":"primary"});
    let group = json!({
        "schemaVersion":1,"kind":"term","id":choice.group_id,"taxonomy":choice.taxonomy_id,
        "title":choice.title,"description":choice.outcome,"include":[format!("{directory}/**/*.md")],
        "schema":{"type":"object","fields":schema},
        "create":{"directory":directory,"filename":"{{ input.slug }}.md","template":paths[2],"templateMode":"structuredMarkdown","inputs":inputs},
        "conventions":{"titleField":"fields.title"}
    });
    let view = json!({
        "schemaVersion":1,"kind":"view","mode":"table","title":choice.title,
        "source":{"type":"pages","taxonomy":{&choice.taxonomy_id:[&choice.group_id]}},
        "table":{"columns":columns}
    });
    let contents = [
        document(&taxonomy)?,
        document(&group)?,
        document(&json!(template))?,
        document(&view)?,
    ];
    Ok(paths
        .into_iter()
        .zip(contents)
        .map(|(path, content)| FilePreview { path, content })
        .collect())
}

#[cfg(test)]
mod tests;

mod plan;
pub use plan::{
    ApplyReport, ApplyStatus, FilePlan, PlanAdvisory, PlanError, apply_plan, prepare_plan,
};
