use forma_core::{SkillProjection, SkillSource, docs_get, skills_get, skills_list};
use markdown::{ParseOptions, mdast::Node, to_mdast};

#[test]
fn modeling_skill_is_discoverable_and_reachable_from_default_routes() {
    // Built-ins must remain discoverable before workspace initialization.
    let root = std::env::temp_dir().join(format!(
        "forma-uninitialized-modeling-skill-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let registry = skills_list(&root).unwrap();
    let builtin_ids = registry
        .skills
        .iter()
        .filter(|skill| skill.source == SkillSource::BuiltIn)
        .map(|skill| skill.id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        builtin_ids,
        [
            "forma-cli-core",
            "forma-workspace-design",
            "forma-workspace-bootstrap",
            "forma-guided-modeling",
            "forma-workspace-maintenance",
            "forma-workspace-troubleshooting",
        ]
    );
    let entry = registry
        .skills
        .iter()
        .find(|s| s.id == "forma-guided-modeling")
        .unwrap();
    assert_eq!(entry.source, SkillSource::BuiltIn);
    assert_eq!(entry.projection, SkillProjection::Section);
    for id in ["forma-cli-core", "forma-workspace-bootstrap"] {
        let route = skills_get(&root, id, false).unwrap().skill.unwrap();
        assert!(
            route
                .content
                .contains("forma skills get forma-guided-modeling"),
            "{id}"
        );
    }
    let compact = skills_get(&root, &entry.id, false).unwrap().skill.unwrap();
    assert!(compact.content.contains("forma-source-ref: docs:cli.model"));
    for required in [
        "empty configured corpus",
        "forma-workspace-bootstrap",
        "forma docs get cli.model",
        "forma docs get workspace.templates",
        "model prepare --choices",
        "--output",
        "model apply --plan",
        "--confirm",
        "partial",
        "verificationFailed",
        "authorization",
        "forma create",
        "--preview --json",
        "forma list --space",
        "forma view render",
        "forma check --json",
        "forma workspace health --json",
        "### Completion Criteria",
    ] {
        assert!(
            compact.content.contains(required),
            "missing projected workflow step: {required}"
        );
    }
    assert!(!compact.content.contains("```json"));
    let full = skills_get(&root, &entry.id, true).unwrap().skill.unwrap();
    assert!(full.content.contains("```json"));
    assert!(full.content.contains("## Confirmation And Recovery"));
}

#[test]
fn modeling_reference_example_compiles_through_the_public_contract() {
    let doc = docs_get("cli.model").unwrap().doc.unwrap();
    let Node::Root(root) = to_mdast(&doc.body, &ParseOptions::gfm()).unwrap() else {
        panic!()
    };
    let json = root
        .children
        .into_iter()
        .find_map(|node| match node {
            Node::Code(code) if code.lang.as_deref() == Some("json") => Some(code.value),
            _ => None,
        })
        .unwrap();
    let choice: forma_core::guided_modeling::SliceChoice = serde_json::from_str(&json).unwrap();
    let files = forma_core::guided_modeling::compile_slice(&choice).unwrap();
    assert_eq!(files.len(), 4);
    assert!(
        files
            .iter()
            .any(|file| file.content.contains("templateMode: structuredMarkdown"))
    );
}
