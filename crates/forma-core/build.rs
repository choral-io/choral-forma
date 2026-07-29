use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

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
#[serde(rename_all = "camelCase")]
struct SkillMetadata {
    #[serde(default)]
    id: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: String,
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
        let (frontmatter, body) = split_frontmatter(&source)
            .unwrap_or_else(|| panic!("canonical doc {} is missing frontmatter", path.display()));
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
            if !has_agent_skill_section(body) {
                panic!(
                    "canonical skill doc {logical_path} must contain a compact `## Agent Skill` section"
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

fn split_frontmatter(source: &str) -> Option<(&str, &str)> {
    let source = source.strip_prefix("---\n")?;
    let end = source.find("\n---\n")?;
    Some((&source[..end], &source[end + 5..]))
}

fn require(path: &str, field: &str, value: &str) {
    if value.trim().is_empty() {
        panic!("canonical doc {path} is missing {field}");
    }
}

fn has_agent_skill_section(body: &str) -> bool {
    body.lines().any(|line| line.trim() == "## Agent Skill")
}
