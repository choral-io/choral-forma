use std::collections::BTreeSet;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::markdown::FormaMarkdownDocument;

const EMBEDDED_DOC_SOURCES: &[(&str, &str)] = &[
    ("docs/index.md", include_str!("../../../docs/index.md")),
    (
        "docs/getting-started.md",
        include_str!("../../../docs/getting-started.md"),
    ),
    (
        "docs/cli/init.md",
        include_str!("../../../docs/cli/init.md"),
    ),
    (
        "docs/cli/config.md",
        include_str!("../../../docs/cli/config.md"),
    ),
    (
        "docs/cli/check.md",
        include_str!("../../../docs/cli/check.md"),
    ),
    (
        "docs/cli/serve.md",
        include_str!("../../../docs/cli/serve.md"),
    ),
    (
        "docs/cli/skills.md",
        include_str!("../../../docs/cli/skills.md"),
    ),
    (
        "docs/workspace/configuration.md",
        include_str!("../../../docs/workspace/configuration.md"),
    ),
    (
        "docs/workspace/spaces.md",
        include_str!("../../../docs/workspace/spaces.md"),
    ),
    (
        "docs/workspace/schemas.md",
        include_str!("../../../docs/workspace/schemas.md"),
    ),
    (
        "docs/workspace/templates.md",
        include_str!("../../../docs/workspace/templates.md"),
    ),
    (
        "docs/workspace/views.md",
        include_str!("../../../docs/workspace/views.md"),
    ),
    (
        "docs/workspace/guidelines.md",
        include_str!("../../../docs/workspace/guidelines.md"),
    ),
    (
        "docs/agents/forma-cli-core.md",
        include_str!("../../../docs/agents/forma-cli-core.md"),
    ),
    (
        "docs/agents/workspace-bootstrap.md",
        include_str!("../../../docs/agents/workspace-bootstrap.md"),
    ),
    (
        "docs/agents/knowledge-maintenance.md",
        include_str!("../../../docs/agents/knowledge-maintenance.md"),
    ),
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedDoc {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub audience: Vec<String>,
    pub surfaces: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill: Option<EmbeddedSkill>,
    pub order: i64,
    pub path: String,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedSkill {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub triggers: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocsError {
    MissingRequiredField { path: String, field: String },
    DuplicateId { id: String },
}

impl fmt::Display for DocsError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingRequiredField { path, field } => {
                write!(formatter, "embedded doc `{path}` is missing `{field}`")
            }
            Self::DuplicateId { id } => write!(formatter, "embedded doc id `{id}` is duplicated"),
        }
    }
}

impl std::error::Error for DocsError {}

pub fn embedded_docs() -> Result<Vec<EmbeddedDoc>, DocsError> {
    let mut docs = Vec::new();
    let mut ids = BTreeSet::new();

    for (path, source) in EMBEDDED_DOC_SOURCES {
        let doc = parse_embedded_doc(path, source)?;
        if !ids.insert(doc.id.clone()) {
            return Err(DocsError::DuplicateId { id: doc.id });
        }
        docs.push(doc);
    }

    docs.sort_by(|a, b| a.order.cmp(&b.order).then_with(|| a.id.cmp(&b.id)));
    Ok(docs)
}

pub fn embedded_doc(id: &str) -> Result<Option<EmbeddedDoc>, DocsError> {
    Ok(embedded_docs()?.into_iter().find(|doc| doc.id == id))
}

fn parse_embedded_doc(path: &str, source: &str) -> Result<EmbeddedDoc, DocsError> {
    let document = FormaMarkdownDocument::parse(source);
    let metadata = document
        .frontmatter
        .value
        .ok_or_else(|| missing(path, "frontmatter"))?;
    let metadata =
        serde_yml::from_value::<DocMetadata>(metadata).map_err(|_| missing(path, "frontmatter"))?;

    if metadata.id.trim().is_empty() {
        return Err(missing(path, "id"));
    }
    if metadata.title.trim().is_empty() {
        return Err(missing(path, "title"));
    }
    if metadata.summary.trim().is_empty() {
        return Err(missing(path, "summary"));
    }
    if metadata.audience.is_empty() {
        return Err(missing(path, "audience"));
    }
    if metadata.surfaces.is_empty() {
        return Err(missing(path, "surfaces"));
    }

    Ok(EmbeddedDoc {
        id: metadata.id,
        title: metadata.title,
        summary: metadata.summary,
        audience: metadata.audience,
        surfaces: metadata.surfaces,
        skill: metadata.skill,
        order: metadata.order,
        path: path.to_string(),
        body: document.body.trim_start_matches('\n').to_string(),
    })
}

fn missing(path: &str, field: &str) -> DocsError {
    DocsError::MissingRequiredField {
        path: path.to_string(),
        field: field.to_string(),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocMetadata {
    #[serde(default)]
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    audience: Vec<String>,
    #[serde(default)]
    surfaces: Vec<String>,
    #[serde(default)]
    skill: Option<EmbeddedSkill>,
    #[serde(default)]
    order: i64,
}

#[cfg(test)]
mod tests {
    use super::{embedded_doc, embedded_docs};

    #[test]
    fn embedded_docs_include_agent_core_doc() {
        let docs = embedded_docs().expect("embedded docs should parse");

        let core = docs
            .iter()
            .find(|doc| doc.id == "agents.forma-cli-core")
            .expect("forma-cli-core doc should be embedded");
        assert_eq!(core.path, "docs/agents/forma-cli-core.md");
        assert!(core.audience.contains(&"agent".to_string()));
        assert!(core.surfaces.contains(&"skill".to_string()));
        assert!(core.body.contains("# Forma CLI Core"));
        assert!(core.body.contains("## Agent Guidance"));
    }

    #[test]
    fn embedded_doc_lookup_returns_doc_by_id() {
        let doc = embedded_doc("workspace.configuration")
            .expect("embedded docs should parse")
            .expect("workspace configuration doc should exist");

        assert_eq!(doc.path, "docs/workspace/configuration.md");
        assert!(doc.surfaces.contains(&"docs".to_string()));
        assert!(doc.body.contains("workspace-relative POSIX paths"));
    }
}
