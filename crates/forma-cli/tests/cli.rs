use std::path::Path;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use forma_core::FORMA_CONFIG_PATH;
use serde_json::Value;

fn copy_starter_workspace(root: &Path) {
    let source = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join("examples/forma-starter-kit");
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
    let config_path = root.join(".forma.yml");
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

#[test]
fn prints_placeholder_version() {
    let output = Command::new(env!("CARGO_BIN_EXE_forma"))
        .output()
        .expect("forma binary should run");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "forma 0.1.0\n");
    assert!(output.stderr.is_empty());
}

#[test]
fn supports_standard_version_flag() {
    let output = Command::new(env!("CARGO_BIN_EXE_forma"))
        .arg("--version")
        .output()
        .expect("forma --version should run");

    assert!(output.status.success());
    assert_eq!(String::from_utf8_lossy(&output.stdout), "forma 0.1.0\n");
    assert!(output.stderr.is_empty());
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
    assert!(stdout.contains(r#""path":".forma.yml""#));
    assert!(!stdout.contains(r#""jsonrpc""#));
}

#[test]
fn knowledge_health_json_uses_operation_result_shape() {
    let root = knowledge_health_warning_fixture("knowledge-health-json");

    let output = forma(&root)
        .args(["knowledge", "health", "--json"])
        .output()
        .expect("forma knowledge health --json should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""schemaVersion":1"#));
    assert!(stdout.contains(r#""operation":"knowledge.health""#));
    assert!(stdout.contains(r#""status":"warning""#));
    assert!(stdout.contains(r#""category":"brokenReference""#));
    assert!(!stdout.contains(r#""jsonrpc""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn knowledge_health_human_output_reports_warning_summary() {
    let root = knowledge_health_warning_fixture("knowledge-health-human");

    let output = forma(&root)
        .args(["knowledge", "health"])
        .output()
        .expect("forma knowledge health should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("knowledge health warning"));
    assert!(stdout.contains("warning knowledgeHealth.brokenReference"));
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
    assert!(stdout.contains("Run Forma commands from the target workspace root."));
    assert!(stdout.contains("Built-in skill: forma-cli-core"));
    assert!(stdout.contains("forma skills list --json"));
    assert!(!stdout.contains(r#""operation":"skills.get""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn skills_list_json_discovers_builtin_and_configured_guideline_skills() {
    let root = fixture_root("skills-list");
    std::fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
    std::fs::write(
        root.join(".forma.yml"),
        "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/guidelines/authoring.md"),
        "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Authoring\n\n## Agent Skill\n\nFollow the workflow.\n",
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
    std::fs::write(
        root.join(".forma.yml"),
        "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n",
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/guidelines/authoring.md"),
        "---\nskill:\n  id: markdown-authoring\n  title: Agent Markdown Authoring\n  description: Use for Markdown edits.\n---\n\n# Authoring\n\n## Agent Skill\n\nFollow the workflow.\n",
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
    assert!(stdout.contains("Follow the workflow."));
    assert!(!stdout.contains(r#""operation":"skills.get""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn skills_get_markdown_output_reports_diagnostics_to_stderr() {
    let root = fixture_root("skills-get-diagnostics");
    std::fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
    std::fs::write(
        root.join(".forma.yml"),
        "schemaVersion: 1\nworkspace:\n  name: Acme Knowledge\n  canonicalLanguage: en\n  supportedLanguages: [en]\n  timezone: UTC\nguidelines:\n  - knowledge/guidelines/authoring.md\n  - knowledge/guidelines/first-duplicate.md\n  - knowledge/guidelines/second-duplicate.md\n",
    )
    .unwrap();
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
            .contains("readiness: \"needs-refinement\"")
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
    assert!(config_stdout.contains(r#""supportedLanguages":["en","zh-Hans"]"#));
    assert!(config_stdout.contains(r#""guidelines""#));
    assert!(config_stdout.contains(r#""knowledge/guidelines/forma-knowledge-operations.md""#));
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
        "workspace-support",
    ] {
        assert!(config_stdout.contains(&format!(r#""{space}":"#)));
    }
    for template in [
        "experiment.md",
        "knowledge.md",
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
    let workspace = root.join("examples/forma-starter-kit");
    let workspace = workspace
        .to_str()
        .expect("workspace path should be valid UTF-8");
    let output = forma(&root)
        .args(["--workspace", workspace, "config", "inspect", "--json"])
        .output()
        .expect("forma --workspace examples/forma-starter-kit config inspect should run");

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
    assert!(!stdout.contains(r#""code":"ref.unresolved"#));
    assert!(!stdout.contains(r#""code":"schema.ref.invalid"#));
}

#[test]
fn tasks_list_and_inspect_read_task_metadata() {
    let root = fixture_root("tasks-list-and-inspect");
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/tasks")).unwrap();

    std::fs::write(
        root.join(".forma.yml"),
        r#"schemaVersion: 1

workspace:
  name: "Task Inventory"
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"

include:
  - ".forma/spaces/*.md"
"#,
    )
    .unwrap();
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
        .args(["tasks", "list", "--json"])
        .output()
        .expect("forma tasks list should run");

    assert!(
        list.status.success(),
        "{}",
        String::from_utf8_lossy(&list.stderr)
    );
    assert!(list.stderr.is_empty());
    let list_stdout = String::from_utf8_lossy(&list.stdout);
    assert!(list_stdout.contains(r#""operation":"tasks.list""#));
    assert!(list_stdout.contains(r#""path":"knowledge/tasks/ship-cli.md""#));
    assert!(list_stdout.contains(r#""readiness":"ready""#));
    assert!(list_stdout.contains(r#""priority":"P0""#));

    let inspect = forma(&root)
        .args(["tasks", "inspect", "knowledge/tasks/ship-cli.md", "--json"])
        .output()
        .expect("forma tasks inspect should run");

    assert!(
        inspect.status.success(),
        "{}",
        String::from_utf8_lossy(&inspect.stderr)
    );
    assert!(inspect.stderr.is_empty());
    let inspect_stdout = String::from_utf8_lossy(&inspect.stdout);
    assert!(inspect_stdout.contains(r#""operation":"tasks.inspect""#));
    assert!(inspect_stdout.contains(r#""title":"Ship CLI""#));
    assert!(inspect_stdout.contains(r#""priority":"P0""#));
    assert!(inspect_stdout.contains(r#""owner":"Alex Chen""#));

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn board_show_groups_tasks_by_delivery_columns() {
    let root = fixture_root("board-show");
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/tasks")).unwrap();

    std::fs::write(
        root.join(".forma.yml"),
        r#"schemaVersion: 1

workspace:
  name: "Task Board"
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"

include:
  - ".forma/spaces/*.md"
"#,
    )
    .unwrap();
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
        root.join("knowledge/tasks/alpha.md"),
        r#"---
schemaVersion: 1
kind: task
title: Alpha
summary: Needs refinement by default.
---

# Alpha
"#,
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/tasks/bravo.md"),
        r#"---
schemaVersion: 1
kind: task
title: Bravo
summary: Ready task.
readiness: ready
---

# Bravo
"#,
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/tasks/charlie.md"),
        r#"---
schemaVersion: 1
kind: task
title: Charlie
summary: Blocked task.
readiness: blocked
---

# Charlie
"#,
    )
    .unwrap();

    let output = forma(&root)
        .args(["board", "show", "--json"])
        .output()
        .expect("forma board show --json should run");

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"board.show""#));
    assert!(stdout.contains(r#""id":"backlog""#));
    assert!(stdout.contains(r#""title":"Backlog""#));
    assert!(stdout.contains(r#""id":"ready""#));
    assert!(stdout.contains(r#""title":"Ready""#));
    assert!(stdout.contains(r#""id":"doing""#));
    assert!(stdout.contains(r#""title":"Doing""#));
    assert!(stdout.contains(r#""id":"reviewing""#));
    assert!(stdout.contains(r#""title":"Reviewing""#));
    assert!(stdout.contains(r#""id":"blocked""#));
    assert!(stdout.contains(r#""title":"Blocked""#));
    assert!(stdout.contains(r#""id":"done""#));
    assert!(stdout.contains(r#""title":"Done""#));
    assert!(stdout.contains(r#""id":"cancelled""#));
    assert!(stdout.contains(r#""title":"Cancelled""#));
    assert!(stdout.contains(r#""path":"knowledge/tasks/alpha.md""#));
    assert!(stdout.contains(r#""path":"knowledge/tasks/bravo.md""#));
    assert!(stdout.contains(r#""path":"knowledge/tasks/charlie.md""#));

    let backlog_index = stdout.find(r#""id":"backlog""#).unwrap();
    let ready_index = stdout.find(r#""id":"ready""#).unwrap();
    let doing_index = stdout.find(r#""id":"doing""#).unwrap();
    let reviewing_index = stdout.find(r#""id":"reviewing""#).unwrap();
    let blocked_index = stdout.find(r#""id":"blocked""#).unwrap();
    let done_index = stdout.find(r#""id":"done""#).unwrap();
    let cancelled_index = stdout.find(r#""id":"cancelled""#).unwrap();
    assert!(backlog_index < ready_index);
    assert!(ready_index < doing_index);
    assert!(doing_index < reviewing_index);
    assert!(reviewing_index < blocked_index);
    assert!(blocked_index < done_index);
    assert!(done_index < cancelled_index);

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

#[test]
fn init_subcommand_is_not_available() {
    let root = fixture_root("init-disabled");
    std::fs::create_dir_all(&root).unwrap();

    let output = forma(&root)
        .args(["init", "--name", "Acme Knowledge"])
        .output()
        .unwrap();

    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("unrecognized subcommand 'init'"));
    assert!(!root.join(".forma").exists());

    std::fs::remove_dir_all(root).unwrap();
}

fn forma(root: &std::path::Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_forma"));
    command.current_dir(root);
    command
}

fn knowledge_health_warning_fixture(name: &str) -> std::path::PathBuf {
    let root = fixture_root(name);
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join("notes")).unwrap();

    std::fs::write(
        root.join(".forma.yml"),
        r#"schemaVersion: 1

workspace:
  name: "Knowledge Health"
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"

include:
  - ".forma/spaces/*.md"
"#,
    )
    .unwrap();
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
