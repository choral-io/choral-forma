use std::collections::BTreeSet;
use std::fmt;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

use crate::markdown::FormaMarkdownDocument;

include!(concat!(env!("OUT_DIR"), "/embedded_docs_registry.rs"));

static EMBEDDED_DOCS: OnceLock<Result<Vec<EmbeddedDoc>, DocsError>> = OnceLock::new();

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
pub struct EmbeddedDocSummary {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub audience: Vec<String>,
    pub surfaces: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill: Option<EmbeddedSkill>,
    pub order: i64,
    pub path: String,
}

impl From<&EmbeddedDoc> for EmbeddedDocSummary {
    fn from(doc: &EmbeddedDoc) -> Self {
        Self {
            id: doc.id.clone(),
            title: doc.title.clone(),
            summary: doc.summary.clone(),
            audience: doc.audience.clone(),
            surfaces: doc.surfaces.clone(),
            skill: doc.skill.clone(),
            order: doc.order,
            path: doc.path.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
    EMBEDDED_DOCS.get_or_init(load_embedded_docs).clone()
}

pub fn embedded_doc(id: &str) -> Result<Option<EmbeddedDoc>, DocsError> {
    Ok(embedded_docs()?.into_iter().find(|doc| doc.id == id))
}

fn load_embedded_docs() -> Result<Vec<EmbeddedDoc>, DocsError> {
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
        assert!(core.body.contains("## Agent Skill"));
    }

    #[test]
    fn embedded_doc_lookup_returns_doc_by_id() {
        let cases = [
            (
                "agents.workspace-design-discovery",
                "docs/agents/workspace-design-discovery.md",
                "# Workspace Design Discovery",
            ),
            (
                "agents.workspace-example-accelerator",
                "docs/agents/workspace-example-accelerator.md",
                "# Workspace Example Accelerator",
            ),
        ];

        for (id, expected_path, expected_heading) in cases {
            let doc = embedded_doc(id)
                .expect("embedded docs should parse")
                .expect("agent doc should exist");

            assert_eq!(doc.path, expected_path);
            assert!(doc.surfaces.contains(&"docs".to_string()));
            assert!(doc.body.contains(expected_heading));
        }
    }
}
