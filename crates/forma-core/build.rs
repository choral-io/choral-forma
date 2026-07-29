use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use markdown::{ParseOptions, mdast, to_mdast};
use serde::Deserialize;

#[path = "src/frontmatter.rs"]
mod frontmatter;

use frontmatter::split_frontmatter_slices;

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
    skill: Option<SkillMetadata>,
    order: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SkillMetadata {
    #[serde(default)]
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    triggers: Vec<String>,
    #[serde(default, rename = "order")]
    _order: Option<i64>,
}

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let repository_root = manifest_dir.join("../..");
    let docs_root = repository_root.join("docs");
    println!("cargo:rerun-if-changed={}", docs_root.display());

    let mut paths = Vec::new();
    collect_markdown_files(&docs_root, &mut paths).expect("scan canonical docs");
    paths.sort();

    let mut document_ids = BTreeMap::new();
    let mut skill_ids = BTreeMap::new();
    let mut registry = String::from("pub const EMBEDDED_DOC_SOURCES: &[(&str, &str)] = &[\n");

    for path in paths {
        println!("cargo:rerun-if-changed={}", path.display());
        let source = fs::read_to_string(&path)
            .unwrap_or_else(|error| panic!("read canonical doc {}: {error}", path.display()));
        let split = split_frontmatter_slices(&source);
        let frontmatter = split
            .frontmatter
            .unwrap_or_else(|| panic!("canonical doc {} is missing frontmatter", path.display()));
        let body = split.body;
        let metadata = serde_yml::from_str::<DocMetadata>(frontmatter)
            .unwrap_or_else(|error| panic!("parse frontmatter in {}: {error}", path.display()));
        let logical_path = path
            .strip_prefix(&repository_root)
            .expect("docs are inside the repository")
            .to_string_lossy()
            .replace('\\', "/");

        require(&logical_path, "id", &metadata.id);
        require(&logical_path, "title", &metadata.title);
        require(&logical_path, "summary", &metadata.summary);
        if metadata.audience.is_empty() {
            panic!("canonical doc {logical_path} is missing audience");
        }
        if metadata.surfaces.is_empty() {
            panic!("canonical doc {logical_path} is missing surfaces");
        }
        if metadata.order.is_none() {
            panic!("canonical doc {logical_path} is missing order");
        }
        if let Some(previous) = document_ids.insert(metadata.id.clone(), logical_path.clone()) {
            panic!(
                "duplicate canonical doc id `{}` in {previous} and {logical_path}",
                metadata.id
            );
        }

        if let Some(skill) = metadata.skill {
            require(&logical_path, "skill.id", &skill.id);
            require(&logical_path, "skill.title", &skill.title);
            require(&logical_path, "skill.description", &skill.description);
            validate_skill_name(&logical_path, &skill.id);
            validate_skill_description(&logical_path, &skill.description);
            validate_skill_triggers(&logical_path, &skill.triggers);
            let section_count = agent_skill_section_count(body);
            if section_count != 1 {
                panic!(
                    "canonical skill doc {logical_path} must contain exactly one compact `## Agent Skill` section; found {section_count}"
                );
            }
            if let Some(previous) = skill_ids.insert(skill.id.clone(), logical_path.clone()) {
                panic!(
                    "duplicate built-in skill id `{}` in {previous} and {logical_path}",
                    skill.id
                );
            }
        }

        registry.push_str(&format!(
            "    ({logical_path:?}, include_str!(concat!(env!(\"CARGO_MANIFEST_DIR\"), \"/../../{logical_path}\"))),\n"
        ));
    }
    registry.push_str("];\n");

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    fs::write(out_dir.join("embedded_docs_registry.rs"), registry)
        .expect("write generated embedded docs registry");
}

fn collect_markdown_files(directory: &Path, paths: &mut Vec<PathBuf>) -> std::io::Result<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();
        if entry.file_type()?.is_dir() {
            collect_markdown_files(&path, paths)?;
        } else if path.extension().is_some_and(|extension| extension == "md") {
            paths.push(path);
        }
    }
    Ok(())
}

fn require(path: &str, field: &str, value: &str) {
    if value.trim().is_empty() {
        panic!("canonical doc {path} is missing {field}");
    }
}

fn validate_skill_triggers(path: &str, triggers: &[String]) {
    let mut seen = BTreeMap::new();
    for trigger in triggers {
        let normalized = trigger.trim();
        if normalized.is_empty() {
            panic!("canonical skill doc {path} contains an empty skill trigger");
        }
        if seen.insert(normalized, ()).is_some() {
            panic!("canonical skill doc {path} contains duplicate skill trigger `{normalized}`");
        }
    }
}

// Keep these built-in checks aligned with workspace validation in operations.rs
// and https://agentskills.io/specification.
fn validate_skill_name(path: &str, name: &str) {
    if name.len() > 64 {
        panic!("canonical skill doc {path} skill id exceeds 64 characters");
    }
    if name.starts_with('-') || name.ends_with('-') {
        panic!("canonical skill doc {path} skill id must not start or end with a hyphen");
    }
    if name.contains("--") {
        panic!("canonical skill doc {path} skill id must not contain consecutive hyphens");
    }
    if !name
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        panic!(
            "canonical skill doc {path} skill id may contain only lowercase ASCII letters, numbers, and hyphens"
        );
    }
}

fn validate_skill_description(path: &str, description: &str) {
    if description.chars().count() > 1024 {
        panic!("canonical skill doc {path} skill description exceeds 1024 characters");
    }
}

fn agent_skill_section_count(body: &str) -> usize {
    let ast = to_mdast(body, &ParseOptions::gfm())
        .unwrap_or_else(|error| panic!("parse canonical skill Markdown: {error}"));
    let mdast::Node::Root(root) = ast else {
        panic!("canonical skill Markdown did not produce a document root");
    };
    root.children
        .iter()
        .filter_map(|node| {
            let mdast::Node::Heading(heading) = node else {
                return None;
            };
            Some((heading.depth, markdown_plain_text(&heading.children)))
        })
        .filter(|(depth, text)| *depth == 2 && text.trim() == "Agent Skill")
        .count()
}

fn markdown_plain_text(nodes: &[mdast::Node]) -> String {
    let mut output = String::new();
    for node in nodes {
        match node {
            mdast::Node::Text(text) => output.push_str(&text.value),
            mdast::Node::InlineCode(code) => output.push_str(&code.value),
            mdast::Node::Break(_) => output.push(' '),
            _ => {
                if let Some(children) = node.children() {
                    output.push_str(&markdown_plain_text(children));
                }
            }
        }
    }
    output
}
