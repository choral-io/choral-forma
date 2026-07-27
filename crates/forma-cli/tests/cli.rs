use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{hash::Hash, hash::Hasher};

use forma_core::FORMA_CONFIG_PATH;
use serde_json::Value;

fn copy_starter_workspace(root: &Path) {
    let source = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("examples/getting-started-workspace");
    copy_dir_recursive(&source, root);
    remove_guideline_references(root);
    clear_starter_content(root);
}

fn copy_dir_recursive(source: &Path, target: &Path) {
    std::fs::create_dir_all(target).unwrap();
    for entry in std::fs::read_dir(source).unwrap() {
        let entry = entry.unwrap();
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path);
        } else {
            std::fs::copy(&source_path, &target_path).unwrap();
        }
    }
}

fn clear_starter_content(root: &Path) {
    for directory in ["notes", "tasks", "members", "guidelines"] {
        let path = root.join(directory);
        if path.exists() {
            std::fs::remove_dir_all(&path).unwrap();
        }
        std::fs::create_dir_all(path).unwrap();
    }
}

fn remove_guideline_references(root: &Path) {
    let config_path = root.join(FORMA_CONFIG_PATH);
    let config = std::fs::read_to_string(&config_path).unwrap();
    std::fs::write(
        &config_path,
        config.replace(
            "\nguidelines:\n  - \"guidelines/workspace-operations.md\"\n  - \"guidelines/task-selection.md\"\n",
            "\n",
        ),
    )
    .unwrap();

    let tasks_path = root.join(".forma/spaces/tasks.md");
    let tasks = std::fs::read_to_string(&tasks_path).unwrap();
    std::fs::write(
        &tasks_path,
        tasks.replace(
            "guidelines:\n  - \"guidelines/workspace-operations.md\"\n",
            "",
        ),
    )
    .unwrap();
}

fn write_config(root: &Path, yaml: &str) {
    std::fs::write(
        root.join(FORMA_CONFIG_PATH),
        format!("---\n{}---\n\n# Forma Workspace\n", yaml),
    )
    .unwrap();
}

#[test]
fn prints_placeholder_version() {
    let output = Command::new(env!("CARGO_BIN_EXE_forma"))
        .output()
        .expect("forma binary should run");

    assert!(output.status.success());
    assert_eq!(
        String::from_utf8_lossy(&output.stdout),
        format!("forma {}\n", env!("CARGO_PKG_VERSION"))
    );
    assert!(output.stderr.is_empty());
}

#[test]
fn supports_standard_version_flag() {
    let output = Command::new(env!("CARGO_BIN_EXE_forma"))
        .arg("--version")
        .output()
        .expect("forma --version should run");

    assert!(output.status.success());
    assert_eq!(
        String::from_utf8_lossy(&output.stdout),
        format!("forma {}\n", env!("CARGO_PKG_VERSION"))
    );
    assert!(output.stderr.is_empty());
}

#[test]
fn help_exposes_generic_commands_without_task_specific_helpers() {
    let output = Command::new(env!("CARGO_BIN_EXE_forma"))
        .arg("--help")
        .output()
        .expect("forma --help should run");

    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("view"));
    assert!(stdout.contains("list"));
    assert!(stdout.contains("inspect"));
    assert!(stdout.contains("reference"));
    assert!(stdout.contains("site"));
    assert!(!stdout.contains("tasks"));
    assert!(!stdout.contains("board"));
}

#[test]
fn site_build_writes_deterministic_static_data_without_mutating_sources() {
    let root = fixture_root("site-build-artifact");
    std::fs::create_dir_all(&root).unwrap();
    copy_starter_workspace(&root);
    let entry = root.join("notes/static-site.md");
    let source = "---\nkind: note\ntitle: Static Site\nsummary: Static artifact fixture.\n---\n\n# Static Site\n\nThe neutral homepage body is present.\n\n## Details\n\n![Diagram](../assets/diagram.svg)\n![Spaced Resource](<../assets/diagram space.svg>)\n![Unicode Resource](../assets/图.svg)\n![Percent Resource](../assets/100%.svg)\n\n[Spaced Page](<with space.md>)\n[Unicode Page](你好.md)\n[Percent Page](100%.md)\n";
    std::fs::write(&entry, source).unwrap();
    for (path, title) in [
        ("notes/with space.md", "With Space"),
        ("notes/你好.md", "Unicode"),
        ("notes/100%.md", "Literal Percent"),
    ] {
        std::fs::write(
            root.join(path),
            format!("---\nkind: note\ntitle: {title}\nsummary: {title} route fixture.\n---\n\n# {title}\n"),
        )
        .unwrap();
    }
    std::fs::write(
        root.join("notes/static-site.zh-hans.md"),
        "---\nkind: note\ntitle: 静态站点\nsummary: 本地化静态页面。\n---\n\n# 静态站点\n\n本地化正文。\n",
    )
    .unwrap();
    std::fs::write(
        root.join("assets/diagram.svg"),
        "<svg xmlns=\"http://www.w3.org/2000/svg\"><title>Fixture diagram</title></svg>",
    )
    .unwrap();
    for path in [
        "assets/diagram space.svg",
        "assets/图.svg",
        "assets/100%.svg",
    ] {
        std::fs::write(
            root.join(path),
            format!("<svg xmlns=\"http://www.w3.org/2000/svg\"><title>{path}</title></svg>"),
        )
        .unwrap();
    }
    std::fs::write(root.join("assets/decoy.svg"), "<svg/>").unwrap();

    let output = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            "dist/site",
            "--base-url",
            "https://example.test",
            "--home",
            "notes/static-site.md",
            "--root-path",
            "/preview",
            "--json",
        ])
        .output()
        .expect("forma site build should run");
    assert!(
        output.status.success(),
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr),
    );
    let result: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["operation"], "site.build");
    assert_eq!(result["status"], "passed");
    assert!(result["counts"]["pages"].as_u64().unwrap() > 10);
    assert_eq!(result["counts"]["copiedResources"], 5);
    assert!(root.join("dist/site/index.html").is_file());
    assert!(
        root.join("dist/site/pages/notes/static-site/index.html")
            .is_file()
    );
    assert!(
        root.join("dist/site/pages/notes/static-site.zh-hans/index.html")
            .is_file()
    );
    assert!(root.join("dist/site/pages/index.html").is_file());
    assert!(root.join("dist/site/views/index.html").is_file());
    assert!(root.join("dist/site/views/notes/index.html").is_file());
    assert!(root.join("dist/site/browse/index.html").is_file());
    assert!(root.join("dist/site/spaces/notes/index.html").is_file());
    assert!(root.join("dist/site/404.html").is_file());
    assert!(root.join("dist/site/sitemap.xml").is_file());
    assert!(root.join("dist/site/robots.txt").is_file());
    assert!(root.join("dist/site/raw/assets/diagram.svg").is_file());
    assert!(
        root.join("dist/site/raw/assets/diagram space.svg")
            .is_file()
    );
    assert!(root.join("dist/site/raw/assets/图.svg").is_file());
    assert!(root.join("dist/site/raw/assets/100%.svg").is_file());
    for path in [
        "assets/diagram space.svg",
        "assets/图.svg",
        "assets/100%.svg",
    ] {
        assert_eq!(
            std::fs::read(root.join(path)).unwrap(),
            std::fs::read(root.join("dist/site/raw").join(path)).unwrap(),
            "{path}"
        );
    }
    assert!(
        root.join("dist/site/pages/notes/with space/index.html")
            .is_file()
    );
    assert!(root.join("dist/site/pages/notes/你好/index.html").is_file());
    assert!(root.join("dist/site/pages/notes/100%/index.html").is_file());
    assert!(root.join("dist/site/raw/assets/logo.svg").is_file());
    assert!(!root.join("dist/site/raw/assets/decoy.svg").exists());
    assert!(root.join("dist/site/data/dashboard.json").is_file());
    assert!(
        root.join("dist/site/data/entries/notes--static-site.json")
            .is_file()
    );
    let dashboard = std::fs::read_to_string(root.join("dist/site/data/dashboard.json")).unwrap();
    assert!(!dashboard.contains(root.to_string_lossy().as_ref()));
    assert!(!dashboard.contains("/rpc"));
    let index = std::fs::read_to_string(root.join("dist/site/index.html")).unwrap();
    assert!(index.contains("__FORMA_STATIC_WORKSPACE__"));
    assert!(index.contains(r#""dataBaseUrl":"/preview/data""#));
    assert!(index.contains(r#""rootPath":"/preview""#));
    assert!(index.contains("The neutral homepage body is present."));
    assert!(index.contains(r#"href="https://example.test/preview/""#));
    assert!(index.contains(r#"src="/preview/raw/assets/diagram.svg""#));
    assert!(index.contains(r#"src="/preview/raw/assets/diagram%20space.svg""#));
    assert!(index.contains(r#"src="/preview/raw/assets/%E5%9B%BE.svg""#));
    assert!(index.contains(r#"src="/preview/raw/assets/100%25.svg""#));
    assert!(index.contains(r#"href="/preview/pages/notes/with%20space""#));
    assert!(index.contains(r#"href="/preview/pages/notes/%E4%BD%A0%E5%A5%BD""#));
    assert!(index.contains(r#"href="/preview/pages/notes/100%25""#));
    assert!(index.contains(r#"<html lang="en">"#));
    let entry_html =
        std::fs::read_to_string(root.join("dist/site/pages/notes/static-site/index.html")).unwrap();
    assert!(entry_html.contains(r#"id="details""#));
    assert!(entry_html.contains("The neutral homepage body is present."));
    let variant_html =
        std::fs::read_to_string(root.join("dist/site/pages/notes/static-site.zh-hans/index.html"))
            .unwrap();
    assert!(variant_html.contains("本地化正文"));
    assert!(variant_html.contains(r#"<html lang="zh-Hans">"#));
    let table_html =
        std::fs::read_to_string(root.join("dist/site/views/notes/index.html")).unwrap();
    assert!(table_html.contains("<table"));
    let kanban_html =
        std::fs::read_to_string(root.join("dist/site/views/tasks/index.html")).unwrap();
    assert!(kanban_html.contains(r#"aria-label="View projection""#));
    let graph_html =
        std::fs::read_to_string(root.join("dist/site/views/graph/index.html")).unwrap();
    assert!(graph_html.contains(">Nodes</h2>"));
    let sitemap = std::fs::read_to_string(root.join("dist/site/sitemap.xml")).unwrap();
    assert!(sitemap.contains("https://example.test/preview/pages/notes/static-site"));
    assert!(sitemap.contains("https://example.test/preview/browse"));
    let robots = std::fs::read_to_string(root.join("dist/site/robots.txt")).unwrap();
    assert!(robots.contains("Sitemap: https://example.test/preview/sitemap.xml"));
    let not_found = std::fs::read_to_string(root.join("dist/site/404.html")).unwrap();
    assert!(not_found.contains(r#"name="robots" content="noindex, nofollow""#));
    let artifact_files = collect_files(&root.join("dist/site"));
    let html_count = artifact_files
        .iter()
        .filter(|path| {
            path.extension()
                .is_some_and(|extension| extension == "html")
        })
        .count();
    assert_eq!(
        html_count as u64,
        result["counts"]["pages"].as_u64().unwrap()
    );
    let mut page_titles = std::collections::BTreeSet::new();
    let mut page_descriptions = std::collections::BTreeSet::new();
    let mut page_canonicals = std::collections::BTreeSet::new();
    for path in &artifact_files {
        let contents = std::fs::read(path).unwrap();
        if let Ok(text) = std::str::from_utf8(&contents) {
            assert!(
                !text.contains(root.to_string_lossy().as_ref()),
                "{}",
                path.display()
            );
            assert!(!text.contains("LOCAL_ONLY_SENTINEL"), "{}", path.display());
            assert!(!text.contains("/rpc"), "{}", path.display());
            if path
                .extension()
                .is_some_and(|extension| extension == "html")
                && path.file_name().is_some_and(|name| name != "404.html")
            {
                let title = html_between(text, "<title>", "</title>").to_string();
                let description =
                    html_attribute(text, r#"<meta name="description" content=""#).to_string();
                let canonical = html_attribute(text, r#"<link rel="canonical" href=""#).to_string();
                assert!(
                    page_titles.insert(title),
                    "duplicate page title: {}",
                    path.display()
                );
                assert!(
                    page_descriptions.insert(description),
                    "duplicate page description: {}",
                    path.display()
                );
                assert!(
                    page_canonicals.insert(canonical),
                    "duplicate canonical URL: {}",
                    path.display()
                );
            }
        }
    }
    let first_digest = tree_digest(&root.join("dist/site"));
    assert_eq!(std::fs::read_to_string(&entry).unwrap(), source);

    std::fs::write(root.join("dist/site/stale.txt"), "stale").unwrap();
    let second = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            "dist/site",
            "--base-url",
            "https://example.test",
            "--home",
            "notes/static-site.md",
            "--root-path",
            "/preview",
            "--json",
        ])
        .output()
        .expect("second forma site build should run");
    assert!(
        second.status.success(),
        "{}",
        String::from_utf8_lossy(&second.stderr)
    );
    assert!(!root.join("dist/site/stale.txt").exists());
    assert_eq!(
        std::fs::read_to_string(root.join("dist/site/data/dashboard.json")).unwrap(),
        dashboard
    );
    assert_eq!(tree_digest(&root.join("dist/site")), first_digest);
    assert_eq!(std::fs::read_to_string(&entry).unwrap(), source);

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn site_build_rejects_workspace_root_as_output() {
    let root = fixture_root("site-build-unsafe-output");
    std::fs::create_dir_all(&root).unwrap();
    copy_starter_workspace(&root);
    let output = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            ".",
            "--base-url",
            "https://example.test",
            "--json",
        ])
        .output()
        .expect("forma site build should run");
    assert!(!output.status.success());
    let result: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(result["diagnostics"][0]["code"], "site.buildFailed");
    assert!(
        result["diagnostics"][0]["message"]
            .as_str()
            .unwrap()
            .contains("workspace root")
    );
    assert!(root.join(FORMA_CONFIG_PATH).is_file());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn site_build_rejects_protected_or_unowned_output_directories() {
    let root = fixture_root("site-build-protected-output");
    std::fs::create_dir_all(&root).unwrap();
    copy_starter_workspace(&root);

    let protected = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            ".forma/site",
            "--base-url",
            "https://example.test",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(!protected.status.success());
    assert!(String::from_utf8_lossy(&protected.stdout).contains("protected workspace state"));

    std::fs::create_dir_all(root.join("dist/site")).unwrap();
    std::fs::write(root.join("dist/site/sentinel.txt"), "unowned").unwrap();
    let unowned = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            "dist/site",
            "--base-url",
            "https://example.test",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(!unowned.status.success());
    assert!(String::from_utf8_lossy(&unowned.stdout).contains("not owned by Forma"));
    assert_eq!(
        std::fs::read_to_string(root.join("dist/site/sentinel.txt")).unwrap(),
        "unowned"
    );
    std::fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn site_build_rejects_an_existing_output_symlink_without_touching_its_referent() {
    use std::os::unix::fs::symlink;

    let root = fixture_root("site-build-output-symlink");
    let referent = fixture_root("site-build-output-symlink-referent");
    std::fs::create_dir_all(root.join("dist")).unwrap();
    std::fs::create_dir_all(&referent).unwrap();
    std::fs::write(referent.join("sentinel.txt"), "must survive").unwrap();
    copy_starter_workspace(&root);
    symlink(&referent, root.join("dist/site")).unwrap();

    let output = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            "dist/site",
            "--base-url",
            "https://example.test",
            "--json",
        ])
        .output()
        .expect("forma site build should run");
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).contains("symbolic link"));
    assert_eq!(
        std::fs::read_to_string(referent.join("sentinel.txt")).unwrap(),
        "must survive"
    );

    std::fs::remove_dir_all(root).unwrap();
    std::fs::remove_dir_all(referent).unwrap();
}

#[cfg(unix)]
#[test]
fn site_build_rejects_a_parent_symlink_without_touching_the_referent() {
    use std::os::unix::fs::symlink;

    let root = fixture_root("site-build-parent-symlink");
    let referent = fixture_root("site-build-parent-symlink-referent");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::create_dir_all(&referent).unwrap();
    std::fs::write(referent.join("sentinel.txt"), "must survive").unwrap();
    copy_starter_workspace(&root);
    symlink(&referent, root.join("dist")).unwrap();

    let output = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            "dist/site",
            "--base-url",
            "https://example.test",
            "--json",
        ])
        .output()
        .expect("forma site build should run");
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stdout).contains("traverse a symbolic link"));
    assert_eq!(
        std::fs::read_to_string(referent.join("sentinel.txt")).unwrap(),
        "must survive"
    );

    std::fs::remove_dir_all(root).unwrap();
    std::fs::remove_dir_all(referent).unwrap();
}

#[cfg(unix)]
#[test]
fn site_build_rejects_unsafe_referenced_resources_and_preserves_prior_artifact() {
    use std::os::unix::fs::symlink;

    let root = fixture_root("site-resource-safety");
    let outside = fixture_root("site-resource-safety-outside");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::create_dir_all(&outside).unwrap();
    copy_starter_workspace(&root);
    let entry = root.join("notes/resource.md");
    std::fs::write(
        root.join("assets/candidate.svg"),
        "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
    )
    .unwrap();
    std::fs::write(
        &entry,
        "---\ntitle: Resource\nsummary: Resource fixture.\n---\n\n# Resource\n\n![Candidate](../assets/candidate.svg)\n",
    )
    .unwrap();
    let first = forma(&root)
        .args([
            "site",
            "build",
            "--out",
            "dist/site",
            "--base-url",
            "https://example.test",
            "--json",
        ])
        .output()
        .unwrap();
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    let output_root = root.join("dist/site");
    std::fs::write(output_root.join("sentinel.txt"), "prior artifact").unwrap();
    let index_before = std::fs::read(output_root.join("index.html")).unwrap();

    let assert_rejected = |target: &str| {
        std::fs::write(
            &entry,
            format!(
                "---\ntitle: Resource\nsummary: Resource fixture.\n---\n\n# Resource\n\n![Candidate]({target})\n"
            ),
        )
        .unwrap();
        let result = forma(&root)
            .args([
                "site",
                "build",
                "--out",
                "dist/site",
                "--base-url",
                "https://example.test",
                "--json",
            ])
            .output()
            .unwrap();
        assert!(
            !result.status.success(),
            "unsafe resource unexpectedly published: {target}"
        );
        assert_eq!(
            std::fs::read_to_string(output_root.join("sentinel.txt")).unwrap(),
            "prior artifact"
        );
        assert_eq!(
            std::fs::read(output_root.join("index.html")).unwrap(),
            index_before
        );
        assert!(std::fs::read_dir(root.join("dist")).unwrap().all(|entry| {
            !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with(".forma-site-")
        }));
    };

    assert_rejected("../assets/missing.svg");

    std::fs::create_dir(root.join("assets/directory.svg")).unwrap();
    assert_rejected("../assets/directory.svg");

    symlink(
        root.join("assets/candidate.svg"),
        root.join("assets/leaf.svg"),
    )
    .unwrap();
    assert_rejected("../assets/leaf.svg");

    std::fs::write(outside.join("outside.svg"), "<svg/>").unwrap();
    symlink(&outside, root.join("linked-assets")).unwrap();
    assert_rejected("../linked-assets/outside.svg");

    let fifo = root.join("assets/pipe.svg");
    let mkfifo = Command::new("mkfifo").arg(&fifo).status().unwrap();
    assert!(mkfifo.success());
    assert_rejected("../assets/pipe.svg");

    std::fs::remove_dir_all(root).unwrap();
    std::fs::remove_dir_all(outside).unwrap();
}

#[test]
fn reference_resolve_json_prints_direct_operation_result() {
    let root = fixture_root("reference-resolve-json");
    std::fs::create_dir_all(&root).unwrap();
    copy_starter_workspace(&root);
    std::fs::write(
        root.join("notes/source.md"),
        "---\nkind: note\ntitle: Source\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Source\n",
    )
    .unwrap();
    std::fs::write(
        root.join("notes/target.md"),
        "---\nkind: note\ntitle: Target\nsummary: \"\"\ncreatedAt: \"2026-01-01T00:00:00Z\"\n---\n\n# Target\n",
    )
    .unwrap();

    let output = forma(&root)
        .args([
            "reference",
            "resolve",
            "--source",
            "notes/source.md",
            "--target",
            "target",
            "--intent",
            "link",
            "--json",
        ])
        .output()
        .expect("forma reference resolve should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["operation"], "reference.resolve");
    assert_eq!(value["target"]["path"], "notes/target.md");
    assert!(value.get("jsonrpc").is_none());
    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn workspace_explorer_json_preserves_generic_taxonomy_presentation() {
    let root = fixture_root("workspace-explorer-presentation");
    std::fs::create_dir_all(root.join(".forma/classification")).unwrap();
    std::fs::create_dir_all(root.join("docs")).unwrap();
    write_config(
        &root,
        r#"schemaVersion: 1
workspace:
  name: Explorer Presentation
  canonicalLanguage: en
  supportedLanguages: [en]
  timezone: UTC
imports:
  - .forma/classification/*.md
"#,
    );
    std::fs::write(
        root.join(".forma/classification/areas.md"),
        "---\nschemaVersion: 1\nkind: taxonomy\nid: areas\ntitle: Areas\nmode: multiple\ndisplay:\n  icon: shapes\n  color: \"#64748B\"\n---\n",
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/classification/research.md"),
        "---\nschemaVersion: 1\nkind: term\ntaxonomy: areas\ntitle: Research\ndisplay:\n  icon: flask-conical\n  color: \"#4F7CAC\"\ninclude:\n  - docs/**/*.md\n---\n",
    )
    .unwrap();
    std::fs::write(
        root.join("docs/experiment.md"),
        "---\ntitle: Experiment\n---\n\n# Experiment\n",
    )
    .unwrap();

    let output = forma(&root)
        .args(["workspace", "explorer", "--json"])
        .output()
        .expect("forma workspace explorer should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["operation"], "workspace.explorer");
    assert_eq!(value["taxonomies"][0]["id"], "areas");
    assert_eq!(
        value["taxonomies"][0]["display"],
        serde_json::json!({"icon": "shapes", "color": "#64748B"})
    );
    assert_eq!(
        value["taxonomies"][0]["terms"][0]["display"],
        serde_json::json!({"icon": "flask-conical", "color": "#4F7CAC"})
    );
    assert_eq!(value["taxonomies"][0]["terms"][0]["entryCount"], 1);
    assert!(value.get("spaces").is_none());

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn check_json_prints_direct_operation_result() {
    let output = Command::new(env!("CARGO_BIN_EXE_forma"))
        .args(["check", "--json"])
        .output()
        .expect("forma check --json should run");

    assert!(!output.status.success());
    assert!(output.stderr.is_empty());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""schemaVersion":1"#));
    assert!(stdout.contains(r#""operation":"check""#));
    assert!(stdout.contains(r#""status":"failed""#));
    assert!(stdout.contains(r#""code":"config.readFailed""#));
    assert!(stdout.contains(r#""path":".forma.md""#));
    assert!(!stdout.contains(r#""jsonrpc""#));
}

#[test]
fn config_inspect_rejects_config_without_frontmatter() {
    let root = fixture_root("config-without-frontmatter");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(
        root.join(FORMA_CONFIG_PATH),
        "schemaVersion: 1\nworkspace:\n  name: Raw YAML\n",
    )
    .unwrap();

    let output = forma(&root)
        .args(["config", "inspect", "--json"])
        .output()
        .expect("forma config inspect should run");

    assert!(!output.status.success());
    assert!(output.stderr.is_empty());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"config.inspect""#));
    assert!(stdout.contains(r#""status":"failed""#));
    assert!(stdout.contains(r#""path":".forma.md""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn workspace_health_json_uses_operation_result_shape() {
    let root = workspace_health_warning_fixture("workspace-health-json");

    let output = forma(&root)
        .args(["workspace", "health", "--json"])
        .output()
        .expect("forma workspace health --json should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""schemaVersion":1"#));
    assert!(stdout.contains(r#""operation":"workspace.health""#));
    assert!(stdout.contains(r#""status":"warning""#));
    assert!(stdout.contains(r#""category":"brokenReference""#));
    assert!(!stdout.contains(r#""jsonrpc""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn workspace_health_human_output_reports_warning_summary() {
    let root = workspace_health_warning_fixture("workspace-health-human");

    let output = forma(&root)
        .args(["workspace", "health"])
        .output()
        .expect("forma workspace health should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("workspace health warning"));
    assert!(stdout.contains("warning workspaceHealth.brokenReference"));
    assert!(stdout.contains("notes/a.md"));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn skills_get_builtin_core_prints_markdown_without_workspace_config() {
    let root = fixture_root("skills-builtin");
    std::fs::create_dir_all(&root).unwrap();

    let output = forma(&root)
        .args(["skills", "get", "forma-cli-core"])
        .output()
        .expect("forma skills get forma-cli-core should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("# Forma CLI Core"));
    assert!(stdout.contains("Run `forma` commands from the target workspace root, or pass"));
    assert!(stdout.contains("Built-in skill: forma-cli-core"));
    assert!(stdout.contains("Only If Designing Or Authoring Workspace Config"));
    assert!(stdout.contains("Do not create `skills/forma-cli/SKILL.md`"));
    assert!(stdout.contains("forma skills list --json"));
    assert!(!stdout.contains(r#""operation":"skills.get""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn docs_list_and_get_expose_embedded_product_docs() {
    let root = fixture_root("docs-list-get");
    std::fs::create_dir_all(&root).unwrap();

    let list = forma(&root)
        .args(["docs", "list", "--json"])
        .output()
        .expect("forma docs list should run");

    assert!(
        list.status.success(),
        "{}",
        String::from_utf8_lossy(&list.stderr)
    );
    assert!(list.stderr.is_empty());
    let list_stdout = String::from_utf8_lossy(&list.stdout);
    assert!(list_stdout.contains(r#""operation":"docs.list""#));
    assert!(list_stdout.contains(r#""id":"workspace.configuration""#));
    assert!(list_stdout.contains(r#""id":"workspace.first-slice-config""#));
    assert!(list_stdout.contains(r#""id":"cli.view""#));
    assert!(list_stdout.contains(r#""id":"agents.forma-cli-core""#));
    assert!(list_stdout.contains(r#""id":"agents.workspace-example-accelerator""#));

    let get = forma(&root)
        .args(["docs", "get", "workspace.configuration"])
        .output()
        .expect("forma docs get should run");

    assert!(
        get.status.success(),
        "{}",
        String::from_utf8_lossy(&get.stderr)
    );
    assert!(get.stderr.is_empty());
    let get_stdout = String::from_utf8_lossy(&get.stdout);
    assert!(get_stdout.contains("# Workspace Configuration"));
    assert!(get_stdout.contains("workspace-relative POSIX paths"));
    assert!(get_stdout.contains("currentUserId"));
    assert!(get_stdout.contains("currentDate"));
    assert!(get_stdout.contains("kind: gitConfig"));
    assert!(get_stdout.contains("kind: const"));
    assert!(get_stdout.contains("required: true"));
    assert!(get_stdout.contains("workspace.timezone"));
    assert!(get_stdout.contains("keep runtime values as identity inputs"));
    assert!(get_stdout.contains("source: .forma/spaces/people"));
    assert!(get_stdout.contains("duplicate type names"));
    assert!(!get_stdout.contains(r#""operation":"docs.get""#));

    let first_slice = forma(&root)
        .args(["docs", "get", "workspace.first-slice-config"])
        .output()
        .expect("forma docs get workspace.first-slice-config should run");

    assert!(
        first_slice.status.success(),
        "{}",
        String::from_utf8_lossy(&first_slice.stderr)
    );
    assert!(first_slice.stderr.is_empty());
    let first_slice_stdout = String::from_utf8_lossy(&first_slice.stdout);
    assert!(first_slice_stdout.contains("# First-Slice Config"));
    assert!(first_slice_stdout.contains("kind: taxonomy"));
    assert!(first_slice_stdout.contains("kind: term"));
    assert!(first_slice_stdout.contains("not Forma built-ins"));

    let templates = forma(&root)
        .args(["docs", "get", "workspace.templates"])
        .output()
        .expect("forma docs get workspace.templates should run");

    assert!(
        templates.status.success(),
        "{}",
        String::from_utf8_lossy(&templates.stderr)
    );
    assert!(templates.stderr.is_empty());
    let templates_stdout = String::from_utf8_lossy(&templates.stdout);
    assert!(templates_stdout.contains("people/{{ runtime.values.currentUserId }}"));
    assert!(templates_stdout.contains("Do not assume a built-in directory"));
    assert!(templates_stdout.contains("use `currentUserId` as an identity input"));
    assert!(templates_stdout.contains("runtime.values.currentDateTime"));

    let schemas = forma(&root)
        .args(["docs", "get", "workspace.schemas"])
        .output()
        .expect("forma docs get workspace.schemas should run");

    assert!(
        schemas.status.success(),
        "{}",
        String::from_utf8_lossy(&schemas.stderr)
    );
    assert!(schemas.stderr.is_empty());
    let schemas_stdout = String::from_utf8_lossy(&schemas.stdout);
    assert!(schemas_stdout.contains("type: person"));
    assert!(schemas_stdout.contains("configured `entryRef` named type"));
    assert!(schemas_stdout.contains("currentUserId"));
    assert!(schemas_stdout.contains("Do not infer entry reference paths from directory names"));

    let agent_get = forma(&root)
        .args(["docs", "get", "agents.workspace-example-accelerator"])
        .output()
        .expect("forma docs get should run for agent docs");

    assert!(
        agent_get.status.success(),
        "{}",
        String::from_utf8_lossy(&agent_get.stderr)
    );
    assert!(agent_get.stderr.is_empty());
    let agent_get_stdout = String::from_utf8_lossy(&agent_get.stdout);
    assert!(agent_get_stdout.contains("# Workspace Example Accelerator"));
    assert!(agent_get_stdout.contains("explicitly asks"));
    assert!(agent_get_stdout.contains("copy`, `adapt`, or `skip"));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn init_creates_minimal_workspace_and_agent_runtime_skill() {
    let root = fixture_root("init-minimal-workspace");
    std::fs::create_dir_all(&root).unwrap();

    let output = forma(&root)
        .args(["init", "--name", "Acme Content", "--json"])
        .output()
        .expect("forma init should run");

    assert!(
        output.status.success(),
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let stdout: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(stdout["operation"], "init");
    assert_eq!(stdout["status"], "passed");
    assert_eq!(stdout["workspace"]["name"], "Acme Content");
    assert!(
        stdout["writtenPaths"]
            .as_array()
            .unwrap()
            .iter()
            .any(|path| path == ".forma.md")
    );
    assert!(
        stdout["writtenPaths"]
            .as_array()
            .unwrap()
            .iter()
            .any(|path| path == ".agents/skills/forma-cli/SKILL.md")
    );

    let config = std::fs::read_to_string(root.join(FORMA_CONFIG_PATH)).unwrap();
    assert!(config.starts_with("---\n"));
    assert!(config.contains("name: \"Acme Content\""));
    assert!(config.contains("canonicalLanguage: \"en\""));
    assert!(config.contains("- \".forma/spaces/*.md\""));
    assert!(!root.join(".forma.yml").exists());
    assert!(!root.join("skills/forma-cli/SKILL.md").exists());
    assert!(!root.join("AGENTS.md").exists());

    let skill = std::fs::read_to_string(root.join(".agents/skills/forma-cli/SKILL.md")).unwrap();
    assert!(skill.contains("name: forma-cli"));
    assert!(skill.contains("forma skills get forma-cli-core"));
    assert!(skill.contains("workspace root"));

    let inspect = forma(&root)
        .args(["config", "inspect", "--json"])
        .output()
        .expect("forma config inspect should run after init");
    assert!(
        inspect.status.success(),
        "{}",
        String::from_utf8_lossy(&inspect.stderr)
    );
    let inspect_stdout = String::from_utf8_lossy(&inspect.stdout);
    assert!(inspect_stdout.contains(r#""operation":"config.inspect""#));
    assert!(inspect_stdout.contains(r#""name":"Acme Content""#));

    let check = forma(&root)
        .args(["check", "--json"])
        .output()
        .expect("forma check should run after init");
    assert!(
        check.status.success(),
        "{}",
        String::from_utf8_lossy(&check.stderr)
    );
    assert!(String::from_utf8_lossy(&check.stdout).contains(r#""status":"passed""#));

    let skills = forma(&root)
        .args(["skills", "list", "--json"])
        .output()
        .expect("forma skills list should run after init");
    assert!(
        skills.status.success(),
        "{}",
        String::from_utf8_lossy(&skills.stderr)
    );
    assert!(String::from_utf8_lossy(&skills.stdout).contains(r#""id":"forma-cli-core""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn init_refuses_existing_config_without_overwriting() {
    let root = fixture_root("init-existing-config");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join(FORMA_CONFIG_PATH), "existing: true\n").unwrap();

    let output = forma(&root)
        .args(["init", "--name", "Acme Content", "--json"])
        .output()
        .expect("forma init should run");

    assert!(!output.status.success());
    assert!(output.stderr.is_empty());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"init""#));
    assert!(stdout.contains(r#""status":"failed""#));
    assert!(stdout.contains(r#""code":"init.pathExists""#));
    assert_eq!(
        std::fs::read_to_string(root.join(FORMA_CONFIG_PATH)).unwrap(),
        "existing: true\n"
    );
    assert!(!root.join(".agents/skills/forma-cli/SKILL.md").exists());

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn init_ignores_legacy_yml_entrypoint() {
    let root = fixture_root("init-legacy-yml-ignored");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join(".forma.yml"), "legacy: true\n").unwrap();

    let output = forma(&root)
        .args(["init", "--name", "Acme Content", "--json"])
        .output()
        .expect("forma init should run");

    assert!(
        output.status.success(),
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(root.join(FORMA_CONFIG_PATH).is_file());
    assert_eq!(
        std::fs::read_to_string(root.join(".forma.yml")).unwrap(),
        "legacy: true\n"
    );

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn skills_list_json_discovers_builtin_and_configured_guideline_skills() {
    let root = fixture_root("skills-list");
    std::fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
    write_config(
        &root,
        "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
    );
    std::fs::write(
        root.join("knowledge/guidelines/authoring.md"),
        "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Authoring\n\n## Purpose\n\nHuman-facing background.\n\n## Agent Skill\n\nFollow the workflow.\n\n## Reference\n\nFull reference material.\n",
    )
    .unwrap();

    let output = forma(&root)
        .args(["skills", "list", "--json"])
        .output()
        .expect("forma skills list --json should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"skills.list""#));
    assert!(stdout.contains(r#""id":"forma-cli-core""#));
    assert!(stdout.contains(r#""id":"markdown-authoring""#));
    assert!(stdout.contains(r#""sourcePath":"knowledge/guidelines/authoring.md""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn skills_get_workspace_skill_prints_markdown_for_agent_consumption() {
    let root = fixture_root("skills-get");
    std::fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
    write_config(
        &root,
        "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
    );
    std::fs::write(
        root.join("knowledge/guidelines/authoring.md"),
        "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Authoring\n\n## Purpose\n\nHuman-facing background.\n\n## Agent Skill\n\nFollow the workflow.\n\n## Reference\n\nFull reference material.\n",
    )
    .unwrap();

    let output = forma(&root)
        .args(["skills", "get", "markdown-authoring"])
        .output()
        .expect("forma skills get should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Source guideline: knowledge/guidelines/authoring.md"));
    assert!(stdout.contains("## Agent Skill"));
    assert!(stdout.contains("Follow the workflow."));
    assert!(!stdout.contains("Human-facing background."));
    assert!(!stdout.contains("Full reference material."));
    assert!(!stdout.contains(r#""operation":"skills.get""#));

    let full_output = forma(&root)
        .args(["skills", "get", "markdown-authoring", "--full"])
        .output()
        .expect("forma skills get --full should run");

    assert!(
        full_output.status.success(),
        "{}",
        String::from_utf8_lossy(&full_output.stderr)
    );
    let full_stdout = String::from_utf8_lossy(&full_output.stdout);
    assert!(full_stdout.contains("Human-facing background."));
    assert!(full_stdout.contains("Full reference material."));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn skills_get_markdown_output_reports_diagnostics_to_stderr() {
    let root = fixture_root("skills-get-diagnostics");
    std::fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
    write_config(
        &root,
        "schemaVersion: 1\nworkspace:\n  name: Acme Content\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n  - knowledge/guidelines/first-duplicate.md\n  - knowledge/guidelines/second-duplicate.md\n",
    );
    std::fs::write(
        root.join("knowledge/guidelines/authoring.md"),
        "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Authoring\n\n## Agent Skill\n\nFollow the workflow.\n",
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/guidelines/first-duplicate.md"),
        "---\nskill:\n  id: duplicate-workflow\n  title: Duplicate One\n---\n\n# Duplicate One\n",
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/guidelines/second-duplicate.md"),
        "---\nskill:\n  id: duplicate-workflow\n  title: Duplicate Two\n---\n\n# Duplicate Two\n",
    )
    .unwrap();

    let output = forma(&root)
        .args(["skills", "get", "markdown-authoring"])
        .output()
        .expect("forma skills get should run");

    assert!(!output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Follow the workflow."));
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("error skills.duplicateId"));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn create_list_and_inspect_use_operation_json() {
    let root = fixture_root("starter-flow");
    let home = fixture_root("starter-flow-home-without-git-config");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::create_dir_all(&home).unwrap();
    copy_starter_workspace(&root);
    assert!(root.join(FORMA_CONFIG_PATH).is_file());
    assert!(root.join("notes").is_dir());

    let create = forma(&root)
        .env("HOME", &home)
        .args([
            "create",
            "tasks",
            "--input",
            "title=User Registration",
            "--json",
        ])
        .output()
        .expect("forma create should run");

    assert!(
        create.status.success(),
        "{}",
        String::from_utf8_lossy(&create.stderr)
    );
    let create_stdout = String::from_utf8_lossy(&create.stdout);
    assert!(create_stdout.contains(r#""operation":"create""#));
    assert!(create_stdout.contains(r#""status":"passed""#));
    assert!(root.join("tasks/user-registration.md").is_file());
    assert!(
        std::fs::read_to_string(root.join("tasks/user-registration.md"))
            .unwrap()
            .contains("priority: \"medium\"")
    );

    let list = forma(&root)
        .args(["list", "--space", "tasks", "--json"])
        .output()
        .expect("forma list should run");

    assert!(
        list.status.success(),
        "{}",
        String::from_utf8_lossy(&list.stderr)
    );
    let list_stdout = String::from_utf8_lossy(&list.stdout);
    assert!(list_stdout.contains(r#""operation":"list""#));
    assert!(list_stdout.contains(r#""path":"tasks/user-registration.md""#));

    let inspect = forma(&root)
        .args(["inspect", "--space", "tasks", "user-registration", "--json"])
        .output()
        .expect("forma inspect should run");

    assert!(
        inspect.status.success(),
        "{}",
        String::from_utf8_lossy(&inspect.stderr)
    );
    let inspect_stdout = String::from_utf8_lossy(&inspect.stdout);
    assert!(inspect_stdout.contains(r#""operation":"inspect""#));
    assert!(inspect_stdout.contains(r#""title":"User Registration""#));

    let config = forma(&root)
        .args(["config", "inspect", "--json"])
        .output()
        .expect("forma config inspect should run");

    assert!(
        config.status.success(),
        "{}",
        String::from_utf8_lossy(&config.stderr)
    );
    let config_stdout = String::from_utf8_lossy(&config.stdout);
    assert!(config_stdout.contains(r#""operation":"config.inspect""#));
    assert!(config_stdout.contains(r#""workspace":{"#));
    assert!(config_stdout.contains(r#""timezone":"UTC""#));

    std::fs::remove_dir_all(root).unwrap();
    std::fs::remove_dir_all(home).unwrap();
}

#[test]
fn repository_workspace_config_exposes_target_spaces_and_views() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = forma(&root)
        .args(["config", "inspect", "--json"])
        .output()
        .expect("forma config inspect should run");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let config_stdout = String::from_utf8_lossy(&output.stdout);
    assert!(config_stdout.contains(r#""operation":"config.inspect""#));
    assert!(config_stdout.contains(r#""canonicalLanguage":"en""#));
    assert!(config_stdout.contains(r#""supportedLanguages":["en"]"#));
    assert!(config_stdout.contains(r#""guidelines""#));
    assert!(config_stdout.contains(r#""knowledge/guidelines/forma-workspace-operations.md""#));
    for space in [
        "architecture",
        "concepts",
        "decisions",
        "design",
        "discovery",
        "experiments",
        "guidelines",
        "members",
        "metrics",
        "planning",
        "product",
        "proposals",
        "releases",
        "tasks",
        "test-cases",
        "user-stories",
        "workspace",
    ] {
        assert!(config_stdout.contains(&format!(r#""{space}":"#)));
    }
    for template in [
        "experiment.md",
        "content.md",
        "member-note.md",
        "metric.md",
        "proposal.md",
        "release.md",
        "task.md",
        "test-case.md",
        "user-story.md",
    ] {
        assert!(
            root.join(".forma/spaces/templates")
                .join(template)
                .is_file(),
            "missing template {template}"
        );
    }

    let tasks_list = forma(&root)
        .args(["list", "--space", "tasks", "--json"])
        .output()
        .expect("forma list --space tasks should run");
    assert!(tasks_list.status.success());
    let tasks_stdout = String::from_utf8_lossy(&tasks_list.stdout);
    assert!(tasks_stdout.contains(r#""path":"knowledge/tasks/"#));

    let task_inspect = forma(&root)
        .args([
            "inspect",
            "knowledge/tasks/replace-knowledge-workflow-mechanics-with-forma-cli.md",
            "--json",
        ])
        .output()
        .expect("forma inspect task should run");
    assert!(
        task_inspect.status.success(),
        "{}",
        String::from_utf8_lossy(&task_inspect.stderr)
    );
    let task_inspect_stdout = String::from_utf8_lossy(&task_inspect.stdout);
    assert!(task_inspect_stdout.contains(r#""guidelines":["#));
    assert!(task_inspect_stdout.contains(r#""knowledge/guidelines/task-selection.md""#));

    let product_list = forma(&root)
        .args(["list", "--space", "product", "--json"])
        .output()
        .expect("forma list --space product should run");
    assert!(product_list.status.success());
    let product_stdout = String::from_utf8_lossy(&product_list.stdout);
    assert!(product_stdout.contains(r#""path":"knowledge/product/"#));

    let design_list = forma(&root)
        .args(["list", "--space", "design", "--json"])
        .output()
        .expect("forma list --space design should run");
    assert!(design_list.status.success());
    let design_stdout = String::from_utf8_lossy(&design_list.stdout);
    assert!(design_stdout.contains(r#""path":"knowledge/design/"#));
}

#[test]
fn starter_workspace_config_exposes_expected_spaces_and_excludes_removed_spaces() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let workspace = root.join("examples/getting-started-workspace");
    let workspace = workspace
        .to_str()
        .expect("workspace path should be valid UTF-8");
    let output = forma(&root)
        .args(["--workspace", workspace, "config", "inspect", "--json"])
        .output()
        .expect("forma --workspace examples/getting-started-workspace config inspect should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );

    let config_stdout: Value =
        serde_json::from_slice(&output.stdout).expect("config inspect output should be valid JSON");
    assert_eq!(
        config_stdout["operation"],
        Value::String("config.inspect".to_string())
    );
    let config_spaces = config_stdout
        .get("config")
        .and_then(Value::as_object)
        .and_then(|config| config.get("spaces").and_then(Value::as_object))
        .expect("config JSON should contain spaces");

    for space in ["notes", "tasks", "members", "guidelines"] {
        assert!(config_spaces.contains_key(space));
    }
    for space in ["todos", "users", "decisions", "proposals"] {
        assert!(!config_spaces.contains_key(space));
    }
}

#[test]
fn repository_check_json_reports_no_reference_regressions() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = forma(&root)
        .args(["check", "--json"])
        .output()
        .expect("forma check --json should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"check"#));
    assert!(stdout.contains(r#""status":"passed"#));
    assert!(!stdout.contains(r#""code":"entryRef.unresolved"#));
    assert!(!stdout.contains(r#""code":"schema.entryRef.invalid"#));
}

#[test]
fn list_and_inspect_read_configured_task_like_metadata() {
    let root = fixture_root("generic-task-like-list-and-inspect");
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/tasks")).unwrap();

    write_config(
        &root,
        r#"schemaVersion: 1

workspace:
  name: "Task Inventory"
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"

imports:
  - ".forma/spaces/*.md"
"#,
    );
    std::fs::write(
        root.join(".forma/spaces/tasks.md"),
        r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
include:
  - "knowledge/tasks/**/*.md"
create:
  directory: knowledge/tasks
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/task.md
  inputs:
    title:
      required: true
    slug:
      default: "{{ input.title }}"
      transform: slugify
conventions:
  titleField: title
  summaryField: summary
---

# Tasks
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/spaces/templates/task.md"),
        "---\nkind: task\ntitle: \"{{ input.title }}\"\nsummary: \"\"\n---\n\n# {{ input.title }}\n",
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/tasks/ship-cli.md"),
        r#"---
schemaVersion: 1
kind: task
title: Ship CLI
summary: Add CLI task inventory commands.
readiness: ready
priority: P0
owner: Alex Chen
owners:
  - Alex Chen
  - Mira
assignees:
  - Alex Chen
---

# Ship CLI
"#,
    )
    .unwrap();

    let list = forma(&root)
        .args(["list", "--space", "tasks", "--json"])
        .output()
        .expect("forma list --space tasks should run");

    assert!(
        list.status.success(),
        "{}",
        String::from_utf8_lossy(&list.stderr)
    );
    assert!(list.stderr.is_empty());
    let list_stdout = String::from_utf8_lossy(&list.stdout);
    assert!(list_stdout.contains(r#""operation":"list""#));
    assert!(list_stdout.contains(r#""id":"tasks""#));
    assert!(list_stdout.contains(r#""path":"knowledge/tasks/ship-cli.md""#));
    assert!(list_stdout.contains(r#""title":"Ship CLI""#));

    let inspect = forma(&root)
        .args(["inspect", "--space", "tasks", "ship-cli", "--json"])
        .output()
        .expect("forma inspect --space tasks should run");

    assert!(
        inspect.status.success(),
        "{}",
        String::from_utf8_lossy(&inspect.stderr)
    );
    assert!(inspect.stderr.is_empty());
    let inspect_stdout = String::from_utf8_lossy(&inspect.stdout);
    assert!(inspect_stdout.contains(r#""operation":"inspect""#));
    assert!(inspect_stdout.contains(r#""title":"Ship CLI""#));
    assert!(inspect_stdout.contains(r#""priority":"P0""#));
    assert!(inspect_stdout.contains(r#""owner":"Alex Chen""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn view_render_cli_renders_configured_kanban_view() {
    let root = fixture_root("view-render-cli");
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join(".forma/views")).unwrap();
    std::fs::create_dir_all(root.join("content/tasks")).unwrap();

    write_config(
        &root,
        r#"schemaVersion: 1

workspace:
  name: "Generic View Workspace"
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"

imports:
  - ".forma/spaces/*.md"
  - ".forma/views/*.md"
"#,
    );
    std::fs::write(
        root.join(".forma/spaces/work-items.md"),
        r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Work Items
include:
  - "content/tasks/**/*.md"
create:
  directory: content/tasks
  filename: "{{ input.slug }}.md"
  template: .forma/spaces/templates/work-item.md
  inputs:
    title:
      required: true
    slug:
      default: "{{ input.title }}"
      transform: slugify
conventions:
  titleField: title
  summaryField: summary
---

# Work Items
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/spaces/templates/work-item.md"),
        "---\ntitle: \"{{ input.title }}\"\nsummary: \"\"\n---\n\n# {{ input.title }}\n",
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/views/work-board.md"),
        r#"---
kind: view
mode: kanban
title: Work Board
source:
  type: pages
  taxonomy:
    spaces:
      - work-items
kanban:
  columns:
    - id: ready
      label: Ready
      query:
        all:
          - field: fields.readiness
            op: equals
            value: ready
---

# Work Board

<!-- forma:content -->
"#,
    )
    .unwrap();
    std::fs::write(
        root.join("content/tasks/alpha.md"),
        r#"---
title: Alpha
summary: Ready work.
readiness: ready
---

# Alpha
"#,
    )
    .unwrap();

    let output = forma(&root)
        .args(["view", "render", ".forma/views/work-board", "--json"])
        .output()
        .expect("forma view render --json should run");

    assert!(
        output.status.success(),
        "stdout:\n{}\nstderr:\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"view.render""#));
    assert!(stdout.contains(r#""path":".forma/views/work-board.md""#));
    assert!(stdout.contains(r#""kind":"kanban""#));
    assert!(stdout.contains(r#""path":"content/tasks/alpha.md""#));
    assert!(stdout.contains(r#""readiness":{"kind":"value","value":"ready"}"#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn global_workspace_option_selects_operation_root() {
    let cwd = fixture_root("workspace-option-cwd");
    let workspace = fixture_root("workspace-option-root");
    std::fs::create_dir_all(&cwd).unwrap();
    std::fs::create_dir_all(&workspace).unwrap();
    copy_starter_workspace(&workspace);
    assert!(workspace.join(FORMA_CONFIG_PATH).is_file());
    assert!(!cwd.join(FORMA_CONFIG_PATH).exists());

    let create = forma(&cwd)
        .args([
            "--workspace",
            workspace.to_str().unwrap(),
            "create",
            "notes",
            "--input",
            "title=Workspace Root Note",
            "--json",
        ])
        .output()
        .expect("forma create --workspace should run");

    assert!(
        create.status.success(),
        "{}",
        String::from_utf8_lossy(&create.stderr)
    );
    assert!(workspace.join("notes/workspace-root-note.md").is_file());
    assert!(!cwd.join("notes/workspace-root-note.md").exists());

    let list = forma(&cwd)
        .args([
            "--workspace",
            workspace.to_str().unwrap(),
            "list",
            "--space",
            "notes",
            "--json",
        ])
        .output()
        .expect("forma list --workspace should run");

    assert!(list.status.success());
    assert!(
        String::from_utf8_lossy(&list.stdout).contains(r#""path":"notes/workspace-root-note.md""#)
    );

    std::fs::remove_dir_all(cwd).unwrap();
    std::fs::remove_dir_all(workspace).unwrap();
}

#[test]
fn create_renders_directory_and_filename_templates() {
    let root = fixture_root("create-directory-template-cli");
    std::fs::create_dir_all(&root).unwrap();
    copy_starter_workspace(&root);
    std::fs::write(
        root.join(".forma/spaces/notes.md"),
        r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
display:
  order: 10
description: Notes
include:
  - "notes/**/*.md"
create:
  directory: "notes/{{ input.collection }}"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/note.md"
  inputs:
    title:
      required: true
    collection:
      required: true
      transform: slugify
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
    createdAt:
      default: "{{ runtime.values.currentDateTime }}"
    updatedAt:
      default: "{{ runtime.values.currentDateTime }}"
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Notes
"#,
    )
    .unwrap();

    let create = forma(&root)
        .args([
            "create",
            "notes",
            "--input",
            "title=Directory Template",
            "--input",
            "collection=Research Notes",
            "--json",
        ])
        .output()
        .expect("forma create should run");

    assert!(
        create.status.success(),
        "{}",
        String::from_utf8_lossy(&create.stderr)
    );
    let create_stdout = String::from_utf8_lossy(&create.stdout);
    assert!(create_stdout.contains(r#""path":"notes/research-notes/directory-template.md""#));
    assert!(
        root.join("notes/research-notes/directory-template.md")
            .is_file()
    );
    assert!(!root.join("notes/{{ input.collection }}").exists());

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn create_reports_path_conflicts_and_unknown_inputs_as_json_failures() {
    let root = fixture_root("starter-conflicts");
    std::fs::create_dir_all(&root).unwrap();
    copy_starter_workspace(&root);
    let first = forma(&root)
        .args(["create", "notes", "--input", "title=Duplicate"])
        .output()
        .unwrap();
    assert!(first.status.success());

    let conflict = forma(&root)
        .args(["create", "notes", "--input", "title=Duplicate", "--json"])
        .output()
        .unwrap();
    assert!(!conflict.status.success());
    let conflict_stdout = String::from_utf8_lossy(&conflict.stdout);
    assert!(conflict_stdout.contains(r#""status":"failed""#));
    assert!(conflict_stdout.contains(r#""code":"create.pathConflict""#));

    let unknown = forma(&root)
        .args(["create", "notes", "--input", "missing=value", "--json"])
        .output()
        .unwrap();
    assert!(!unknown.status.success());
    let unknown_stdout = String::from_utf8_lossy(&unknown.stdout);
    assert!(unknown_stdout.contains(r#""status":"failed""#));
    assert!(unknown_stdout.contains(r#""code":"operation.inputInvalid""#));

    std::fs::remove_dir_all(root).unwrap();
}

fn forma(root: &std::path::Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_forma"));
    command.current_dir(root);
    command
}

fn workspace_health_warning_fixture(name: &str) -> std::path::PathBuf {
    let root = fixture_root(name);
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join("notes")).unwrap();

    write_config(
        &root,
        r#"schemaVersion: 1

workspace:
  name: "Workspace Health"
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"

imports:
  - ".forma/spaces/*.md"
"#,
    );
    std::fs::write(
        root.join(".forma/spaces/notes.md"),
        r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Notes
display:
  order: 10
description: Notes
include:
  - "notes/**/*.md"
create:
  directory: "notes"
  filename: "{{ input.slug }}.md"
  template: ".forma/spaces/templates/note.md"
  inputs:
    title:
      required: true
    summary:
      default: ""
    slug:
      type: string
      default: "{{ input.title }}"
      transform: slugify
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Notes
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/spaces/templates/note.md"),
        r#"---
schemaVersion: 1
kind: note
title: "{{ input.title }}"
summary: "{{ input.summary }}"
---

# {{ input.title }}
"#,
    )
    .unwrap();
    std::fs::write(
        root.join("notes/a.md"),
        "---\nschemaVersion: 1\nkind: note\ntitle: A\nsummary: \"\"\n---\n\n# A\n\nSee [[notes/missing.md]].\n",
    )
    .unwrap();

    root
}

fn fixture_root(name: &str) -> std::path::PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("forma-cli-{name}-{unique}"))
}

fn collect_files(root: &Path) -> Vec<std::path::PathBuf> {
    let mut files = Vec::new();
    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if path.is_dir() {
                pending.push(path);
            } else {
                files.push(path);
            }
        }
    }
    files.sort();
    files
}

fn html_between<'a>(html: &'a str, start: &str, end: &str) -> &'a str {
    let value = html.split_once(start).unwrap().1;
    value.split_once(end).unwrap().0
}

fn html_attribute<'a>(html: &'a str, prefix: &str) -> &'a str {
    html.split_once(prefix)
        .unwrap()
        .1
        .split_once('"')
        .unwrap()
        .0
}

fn tree_digest(root: &Path) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    for path in collect_files(root) {
        path.strip_prefix(root).unwrap().hash(&mut hasher);
        std::fs::read(path).unwrap().hash(&mut hasher);
    }
    hasher.finish()
}
