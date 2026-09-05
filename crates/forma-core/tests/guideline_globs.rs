use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use forma_core::{WorkspaceSnapshot, load_workspace, skills_list, summarize_config};

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let fixture = Self(std::env::temp_dir().join(format!(
            "forma-guideline-globs-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )));
        fixture.write(".forma.md", "---\nschemaVersion: 1\nworkspace:\n  name: Fixture\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nimports: [config/*.md]\nguidelines: [guidance/base.md, 'guidance/*.md']\n---\n# Fixture\n");
        fixture.write("config/groups.md", "---\nschemaVersion: 1\nkind: taxonomy\nid: groups\nprojection: contentGroups\ntitle: Groups\n---\n# Groups\n");
        fixture.write("config/notes.md", "---\nschemaVersion: 1\nkind: term\ntaxonomy: groups\nid: notes\ntitle: Notes\ninclude: ['notes/**/*.md']\nguidelines: ['guidance/nested/**/*.md']\n---\n# Notes\n");
        fixture.skill("guidance/base.md", "base-rule");
        fixture.skill("guidance/other.md", "other-rule");
        fixture.skill("guidance/nested/local/rule.md", "nested-rule");
        fixture.write("notes/entry.md", "# Entry\n");
        fixture
    }

    fn write(&self, path: &str, content: &str) {
        let path = self.0.join(path);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, content).unwrap();
    }

    fn skill(&self, path: &str, id: &str) {
        self.write(path, &format!("---\nskill:\n  id: {id}\n  title: Rule\n  description: Guide fixture work.\n  projection: section\n---\n# Rule\n\n## Agent Skill\n\nApply the rule.\n"));
    }

    fn root(&self) -> &Path {
        &self.0
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn guideline_globs_resolve_once_for_config_skills_and_applicability() {
    let fixture = Fixture::new();
    let workspace = load_workspace(fixture.root()).unwrap();
    assert!(
        workspace.diagnostics.is_empty(),
        "{:?}",
        workspace.diagnostics
    );
    assert_eq!(
        workspace.config.guidelines,
        ["guidance/base.md", "guidance/other.md"]
    );
    assert_eq!(
        workspace.model.content_group("notes").unwrap().guidelines,
        ["guidance/nested/local/rule.md"]
    );
    let summary = summarize_config(fixture.root(), None, true).unwrap();
    assert_eq!(summary.guidelines, workspace.config.guidelines);
    let sources = summary.guideline_sources.unwrap();
    assert_eq!(sources[1].pattern, "guidance/*.md");
    assert_eq!(sources[1].paths, ["guidance/base.md", "guidance/other.md"]);
    assert_eq!(sources[2].source_path, "config/notes.md");
    assert_eq!(sources[2].content_group.as_deref(), Some("notes"));
    assert!(
        summarize_config(fixture.root(), None, false)
            .unwrap()
            .guideline_sources
            .is_none()
    );
    let inspected = forma_core::inspect_config(fixture.root(), None).unwrap();
    let inspected = serde_json::to_value(inspected.config).unwrap();
    assert_eq!(
        inspected["guidelines"],
        serde_json::json!(["guidance/base.md", "guidance/*.md"])
    );
    assert_eq!(
        inspected["spaces"]["notes"]["guidelines"],
        serde_json::json!(["guidance/nested/**/*.md"])
    );
    let skills = skills_list(fixture.root()).unwrap();
    assert_eq!(
        skills
            .skills
            .iter()
            .filter(|s| s.id.ends_with("-rule"))
            .count(),
        3
    );
    let explain =
        forma_core::workspace_explain::explain_workspace_path(fixture.root(), "notes/entry.md")
            .unwrap();
    assert_eq!(
        explain.effective.guidelines,
        [
            "guidance/base.md",
            "guidance/other.md",
            "guidance/nested/local/rule.md"
        ]
    );
}

#[test]
fn guideline_globs_watch_new_and_removed_files_outside_content() {
    let fixture = Fixture::new();
    let snapshot = WorkspaceSnapshot::load(fixture.root()).unwrap();
    assert_eq!(
        snapshot.document_kind("guidance/other.md").unwrap(),
        forma_core::ManagedDocumentKind::Control
    );
    assert!(
        snapshot
            .scan_plan()
            .watch_patterns()
            .is_match("guidance/new.md")
    );
    assert!(snapshot.affects_configuration("guidance/new.md").unwrap());
    fixture.skill("guidance/new.md", "new-rule");
    assert!(
        skills_list(fixture.root())
            .unwrap()
            .skills
            .iter()
            .any(|s| s.id == "new-rule")
    );
    fs::remove_file(fixture.root().join("guidance/new.md")).unwrap();
    assert!(
        !skills_list(fixture.root())
            .unwrap()
            .skills
            .iter()
            .any(|s| s.id == "new-rule")
    );
}

#[test]
fn guideline_globs_distinguish_empty_patterns_invalid_patterns_and_missing_files() {
    let fixture = Fixture::new();
    let config = fs::read_to_string(fixture.root().join(".forma.md")).unwrap();
    fixture.write(
        ".forma.md",
        &config.replace("guidance/*.md", "missing/*.md"),
    );
    let workspace = load_workspace(fixture.root()).unwrap();
    assert!(
        workspace
            .diagnostics
            .iter()
            .any(|d| d.code == "config.guidelineGlobNoMatches")
    );
    assert!(
        !workspace
            .diagnostics
            .iter()
            .any(|d| d.code == "config.guidelineMissing")
    );
    assert!(
        workspace
            .model
            .scan_plan()
            .watch_patterns()
            .is_match("missing/new.md")
    );
    fixture.write(
        ".forma.md",
        &config.replace("guidance/*.md", "missing/file.md"),
    );
    assert!(
        load_workspace(fixture.root())
            .unwrap()
            .diagnostics
            .iter()
            .any(|d| d.code == "config.guidelineMissing")
    );
    fixture.write(
        ".forma.md",
        &config.replace("guidance/*.md", "guidance/[.md"),
    );
    assert!(
        load_workspace(fixture.root())
            .unwrap()
            .diagnostics
            .iter()
            .any(|d| d.code == "config.globInvalid")
    );
    fixture.write(
        ".forma.md",
        &config.replace("guidance/*.md", "../outside/*.md"),
    );
    assert!(
        load_workspace(fixture.root())
            .unwrap()
            .diagnostics
            .iter()
            .any(|d| d.code == "config.globInvalid")
    );
}

#[test]
fn guideline_globs_deduplicate_paths_but_reject_duplicate_skill_ids() {
    let fixture = Fixture::new();
    fixture.skill("guidance/duplicate.md", "base-rule");
    let result = skills_list(fixture.root()).unwrap();
    assert!(
        result
            .diagnostics
            .iter()
            .any(|d| d.code == "skills.duplicateId"),
        "{:?}",
        result.diagnostics
    );
}

#[test]
fn guideline_globs_keep_overlay_provenance_and_ignore_unprojected_terms() {
    let fixture = Fixture::new();
    fixture.write(
        "config/overlay.md",
        "---\nguidelines: ['guidance/nested/**/*.md']\n---\n",
    );
    fixture.write(
        "config/tags.md",
        "---\nschemaVersion: 1\nkind: taxonomy\nid: tags\ntitle: Tags\n---\n",
    );
    fixture.write("config/tag.md", "---\nschemaVersion: 1\nkind: term\ntaxonomy: tags\nid: tag\ntitle: Tag\ninclude: ['notes/**/*.md']\nguidelines: ['unrelated/*.md']\n---\n");
    let workspace = load_workspace(fixture.root()).unwrap();
    assert!(
        workspace.diagnostics.is_empty(),
        "{:?}",
        workspace.diagnostics
    );
    assert_eq!(
        workspace.guideline_sources[0].source_path,
        "config/overlay.md"
    );
    assert_eq!(
        workspace.config.guidelines,
        ["guidance/nested/local/rule.md"]
    );
    assert!(
        !workspace
            .guideline_sources
            .iter()
            .any(|s| s.pattern == "unrelated/*.md")
    );
}

#[test]
fn guideline_globs_select_markdown_with_ignore_independent_and_component_semantics() {
    let fixture = Fixture::new();
    fixture.write(".gitignore", "guidance/\n");
    fixture.write("guidance/readme.txt", "not a guideline\n");
    fixture.skill("guidance/extra.mdx", "mdx-rule");
    let config = fs::read_to_string(fixture.root().join(".forma.md")).unwrap();
    fixture.write(".forma.md", &config.replace("guidance/*.md", "guidance/*"));
    let workspace = load_workspace(fixture.root()).unwrap();
    assert_eq!(
        workspace.config.guidelines,
        [
            "guidance/base.md",
            "guidance/extra.mdx",
            "guidance/other.md"
        ]
    );
    assert!(
        workspace.diagnostics.is_empty(),
        "{:?}",
        workspace.diagnostics
    );
}

#[cfg(unix)]
#[test]
fn guideline_globs_do_not_read_through_symlink_ancestors() {
    let fixture = Fixture::new();
    fixture.skill("actual/deep/hidden.md", "hidden-rule");
    std::os::unix::fs::symlink(fixture.root().join("actual"), fixture.root().join("alias"))
        .unwrap();
    let config = fs::read_to_string(fixture.root().join(".forma.md")).unwrap();
    fixture.write(
        ".forma.md",
        &config.replace("guidance/*.md", "alias/deep/*.md"),
    );
    let workspace = load_workspace(fixture.root()).unwrap();
    assert!(
        !workspace
            .model
            .scan_plan()
            .watch_patterns()
            .matching_files()
            .unwrap()
            .iter()
            .any(|path| path.to_string_lossy().contains("hidden"))
    );
    assert!(
        !workspace
            .diagnostics
            .iter()
            .any(|d| d.actual.as_deref().is_some_and(|v| v.contains("hidden")))
    );
    assert!(
        !workspace
            .config
            .guidelines
            .iter()
            .any(|p| p.contains("hidden"))
    );
    assert!(
        workspace
            .diagnostics
            .iter()
            .any(|d| d.code == "config.pathBoundary")
    );
    assert!(
        !skills_list(fixture.root())
            .unwrap()
            .skills
            .iter()
            .any(|s| s.id == "hidden-rule")
    );
}

#[test]
fn guideline_diagnostics_keep_authored_index_and_overlay_source() {
    let fixture = Fixture::new();
    fixture.write(
        "config/overlay.md",
        "---\nguidelines: ['guidance/*.md', 'missing.md']\n---\n",
    );
    let workspace = load_workspace(fixture.root()).unwrap();
    let missing = workspace
        .diagnostics
        .iter()
        .find(|d| d.code == "config.guidelineMissing")
        .unwrap();
    assert_eq!(missing.path.as_deref(), Some("config/overlay.md"));
    assert_eq!(
        missing.location,
        Some(forma_core::DiagnosticLocation::Config {
            field: "guidelines[1]".to_string()
        })
    );
    let node = fs::read_to_string(fixture.root().join("config/notes.md")).unwrap();
    fixture.write(
        "config/notes.md",
        &node.replace(
            "'guidance/nested/**/*.md'",
            "'guidance/nested/**/*.md', 'missing-group.md'",
        ),
    );
    let workspace = load_workspace(fixture.root()).unwrap();
    let missing = workspace
        .diagnostics
        .iter()
        .find(|d| d.actual.as_deref() == Some("missing-group.md"))
        .unwrap();
    assert_eq!(missing.path.as_deref(), Some("config/notes.md"));
    assert_eq!(
        missing.location,
        Some(forma_core::DiagnosticLocation::Config {
            field: "guidelines[1]".to_string()
        })
    );
}
