use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use forma_core::FORMA_CONFIG_PATH;

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
    assert!(stdout.contains(r#""code":"workspace.missingForma""#));
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
    assert!(!root.join(".forma/index.summary.json").exists());

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
    assert!(!root.join(".forma/index.summary.json").exists());

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn init_create_list_and_inspect_use_operation_json_without_persistent_index() {
    let root = fixture_root("starter-flow");
    let home = fixture_root("starter-flow-home-without-git-config");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::create_dir_all(&home).unwrap();

    let init = forma(&root)
        .env("HOME", &home)
        .args([
            "init",
            "--name",
            "Acme Knowledge",
            "--language",
            "en",
            "--timezone",
            "UTC",
            "--yes",
            "--json",
        ])
        .output()
        .expect("forma init should run");

    assert!(
        init.status.success(),
        "{}",
        String::from_utf8_lossy(&init.stderr)
    );
    let init_stdout = String::from_utf8_lossy(&init.stdout);
    assert!(init_stdout.contains(r#""operation":"init""#));
    assert!(init_stdout.contains(r#""status":"passed""#));
    assert!(root.join(FORMA_CONFIG_PATH).is_file());
    assert!(!root.join(".forma/index.summary.json").exists());
    assert!(root.join("notes").is_dir());

    let create = forma(&root)
        .env("HOME", &home)
        .args([
            "create",
            "todos",
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
    assert!(!create_stdout.contains(r#""index""#));
    assert!(!root.join(".forma/index.summary.json").exists());
    assert!(root.join("todos/user-registration.md").is_file());
    assert!(
        std::fs::read_to_string(root.join("todos/user-registration.md"))
            .unwrap()
            .contains("kind: todo")
    );

    let list = forma(&root)
        .args(["list", "--space", "todos", "--json"])
        .output()
        .expect("forma list should run");

    assert!(
        list.status.success(),
        "{}",
        String::from_utf8_lossy(&list.stderr)
    );
    let list_stdout = String::from_utf8_lossy(&list.stdout);
    assert!(list_stdout.contains(r#""operation":"list""#));
    assert!(list_stdout.contains(r#""path":"todos/user-registration.md""#));

    let inspect = forma(&root)
        .args(["inspect", "--space", "todos", "user-registration", "--json"])
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
fn dogfood_repository_workspace_lists_tasks_without_persistent_index() {
    let root = fixture_root("dogfood-repository-workspace");
    std::fs::create_dir_all(root.join(".forma/spaces")).unwrap();
    std::fs::create_dir_all(root.join(".forma/views")).unwrap();
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/tasks")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/members")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/workspace")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/architecture")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/concepts")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/decisions")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/design")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/discovery")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/guidelines")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/planning")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/product")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/proposals")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/research")).unwrap();

    std::fs::write(
        root.join(".forma.yml"),
        r#"schemaVersion: 1

workspace:
  name: "Dogfood Knowledge"
  root: "."
  canonicalLanguage: "en"
  supportedLanguages:
    - "en"
  timezone: "UTC"

include:
  - ".forma/dashboard.md"
  - ".forma/spaces/*.md"
  - ".forma/views/*.md"
"#,
    )
    .unwrap();
    std::fs::write(root.join(".forma/.gitignore"), "local/\n*.summary.json\n").unwrap();
    std::fs::write(
        root.join(".forma/spaces/tasks.md"),
        r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
display:
  order: 10
description: Delivery tasks tracked as repository Markdown.
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
    scope:
      default: project
    summary:
      default: ""
    type:
      default: task
    priority:
      default: P2
    value:
      default: M
    module:
      default: knowledge
    effort:
      default: M
    readiness:
      default: needs-refinement
    owners:
      default: []
    assignees:
      default: []
    reviewers:
      default: []
    tags:
      default: []
    blocked_by:
      default: []
    related_to:
      default: []
    severity:
      default: ""
    sprint:
      default: ""
    reported_by:
      default: ""
    affected_area:
      default: ""
conventions:
  titleField: title
  summaryField: summary
---

# Tasks

Delivery tasks tracked as repository Markdown.
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/spaces/knowledge.md"),
        r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Knowledge
display:
  order: 20
description: Shared project knowledge excluding task records and local member state.
include:
  - "knowledge/architecture/**/*.md"
  - "knowledge/concepts/**/*.md"
  - "knowledge/decisions/**/*.md"
  - "knowledge/design/**/*.md"
  - "knowledge/discovery/**/*.md"
  - "knowledge/planning/**/*.md"
  - "knowledge/product/**/*.md"
  - "knowledge/proposals/**/*.md"
  - "knowledge/research/**/*.md"
  - "knowledge/guidelines/**/*.md"
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Knowledge

Shared product, architecture, planning, and decision records.
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/spaces/members.md"),
        r#"---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Members
display:
  order: 30
description: Shared member-facing workspace notes. Local-only member files remain ignored by Git.
include:
  - "knowledge/members/**/*.md"
  - "knowledge/workspace/*/handoffs/**/*.md"
  - "knowledge/workspace/*/research/**/*.md"
conventions:
  titleField: fields.title
  summaryField: fields.summary
---

# Members

Shared member profiles and shared workspace notes.
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/spaces/templates/task.md"),
        r#"---
schemaVersion: 1
kind: task
scope: "{{ input.scope }}"
title: "{{ input.title }}"
summary: "{{ input.summary }}"
type: "{{ input.type }}"
priority: "{{ input.priority }}"
value: "{{ input.value }}"
module: "{{ input.module }}"
effort: "{{ input.effort }}"
readiness: "{{ input.readiness }}"
owners: []
assignees: []
reviewers: []
tags: []
blocked_by: []
related_to: []
severity: ""
sprint: ""
reported_by: ""
affected_area: ""
---

# {{ input.title }}

## Goal

## Sources

## In Scope

## Out of Scope

## Acceptance Criteria
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/dashboard.md"),
        r#"---
schemaVersion: 1
kind: dashboard
title: Dogfood Knowledge
---

# Dogfood Knowledge
"#,
    )
    .unwrap();
    std::fs::write(
        root.join(".forma/views/task-board.md"),
        r#"---
schemaVersion: 1
kind: view
title: Task Board
mode: kanban
source:
  type: pages
  taxonomy:
    spaces:
      - tasks
kanban:
  columns:
    - id: needs-refinement
      label: Needs Refinement
      query:
        all:
          - field: readiness
            op: equals
            value: needs-refinement
    - id: ready
      label: Ready
      query:
        all:
          - field: readiness
            op: equals
            value: ready
    - id: blocked
      label: Blocked
      query:
        all:
          - field: readiness
            op: equals
            value: blocked
---

# Task Board

Delivery task board generated from task metadata.
"#,
    )
    .unwrap();
    std::fs::write(
        root.join("knowledge/tasks/replace-skills.md"),
        r#"---
schemaVersion: 1
kind: task
scope: project
title: Replace Knowledge Workflow Skills
summary: Use Forma CLI for mechanical knowledge operations.
type: task
priority: P0
value: H
module: knowledge
effort: M
readiness: needs-refinement
owners: []
assignees: []
reviewers: []
tags: []
blocked_by: []
related_to: []
severity: ""
sprint: ""
reported_by: ""
affected_area: ""
---

# Replace Knowledge Workflow Skills

## Goal

## Sources

## In Scope

## Out of Scope

## Acceptance Criteria
"#,
    )
    .unwrap();

    let check = forma(&root)
        .args(["check", "--json"])
        .output()
        .expect("forma check should run");

    assert!(
        check.status.success(),
        "{}",
        String::from_utf8_lossy(&check.stdout)
    );
    assert!(!root.join(".forma/index.summary.json").exists());

    let list = forma(&root)
        .args(["list", "--space", "tasks", "--json"])
        .output()
        .expect("forma list should run");

    assert!(list.status.success());
    assert!(!root.join(".forma/index.summary.json").exists());
    let stdout = String::from_utf8_lossy(&list.stdout);
    assert!(stdout.contains(r#""path":"knowledge/tasks/replace-skills.md""#));
    assert!(stdout.contains(r#""title":"Replace Knowledge Workflow Skills""#));

    std::fs::remove_dir_all(root).unwrap();
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
  root: "."
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
owner: Tiscs
owners:
  - Tiscs
  - Mira
assignees:
  - Tiscs
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
    assert!(inspect_stdout.contains(r#""owner":"Tiscs""#));

    assert!(!root.join(".forma/index.summary.json").exists());

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn board_show_groups_tasks_by_readiness() {
    let root = fixture_root("board-show");
    std::fs::create_dir_all(root.join(".forma/spaces/templates")).unwrap();
    std::fs::create_dir_all(root.join("knowledge/tasks")).unwrap();

    std::fs::write(
        root.join(".forma.yml"),
        r#"schemaVersion: 1

workspace:
  name: "Task Board"
  root: "."
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
    assert!(stdout.contains(r#""id":"needs-refinement""#));
    assert!(stdout.contains(r#""title":"Needs Refinement""#));
    assert!(stdout.contains(r#""id":"ready""#));
    assert!(stdout.contains(r#""title":"Ready""#));
    assert!(stdout.contains(r#""id":"blocked""#));
    assert!(stdout.contains(r#""title":"Blocked""#));
    assert!(stdout.contains(r#""path":"knowledge/tasks/alpha.md""#));
    assert!(stdout.contains(r#""path":"knowledge/tasks/bravo.md""#));
    assert!(stdout.contains(r#""path":"knowledge/tasks/charlie.md""#));
    assert!(!root.join(".forma/index.summary.json").exists());

    let needs_refinement_index = stdout.find(r#""id":"needs-refinement""#).unwrap();
    let ready_index = stdout.find(r#""id":"ready""#).unwrap();
    let blocked_index = stdout.find(r#""id":"blocked""#).unwrap();
    assert!(needs_refinement_index < ready_index);
    assert!(ready_index < blocked_index);

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn global_workspace_option_selects_operation_root() {
    let cwd = fixture_root("workspace-option-cwd");
    let workspace = fixture_root("workspace-option-root");
    std::fs::create_dir_all(&cwd).unwrap();

    let init = forma(&cwd)
        .args([
            "--workspace",
            workspace.to_str().unwrap(),
            "init",
            "--name",
            "Workspace Option",
            "--language",
            "en",
            "--timezone",
            "UTC",
            "--yes",
            "--json",
        ])
        .output()
        .expect("forma init --workspace should run");

    assert!(
        init.status.success(),
        "{}",
        String::from_utf8_lossy(&init.stderr)
    );
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
    let init = forma(&root)
        .args([
            "init",
            "--name",
            "Acme Knowledge",
            "--timezone",
            "UTC",
            "--yes",
        ])
        .output()
        .unwrap();
    assert!(init.status.success());
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
fn init_rejects_invalid_timezone_without_creating_workspace() {
    let root = fixture_root("starter-invalid-timezone");
    std::fs::create_dir_all(&root).unwrap();

    let output = forma(&root)
        .args([
            "init",
            "--name",
            "Acme Knowledge",
            "--timezone",
            "Not/AZone",
            "--yes",
            "--json",
        ])
        .output()
        .unwrap();

    assert!(!output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"init""#));
    assert!(stdout.contains(r#""status":"failed""#));
    assert!(stdout.contains(r#""code":"init.timezoneInvalid""#));
    assert!(!root.join(forma_core::FORMA_DIR).exists());

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn init_requires_yes_in_non_interactive_shells() {
    let root = fixture_root("starter-confirmation");
    std::fs::create_dir_all(&root).unwrap();

    let output = forma(&root)
        .args([
            "init",
            "--name",
            "Acme Knowledge",
            "--timezone",
            "UTC",
            "--json",
        ])
        .output()
        .unwrap();

    assert!(!output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains(r#""operation":"init""#));
    assert!(stdout.contains(r#""status":"failed""#));
    assert!(stdout.contains(r#""code":"init.confirmationRequired""#));
    assert!(!root.join(forma_core::FORMA_DIR).exists());

    std::fs::remove_dir_all(root).unwrap();
}

#[test]
fn non_json_failures_print_diagnostic_details() {
    let root = fixture_root("starter-confirmation-human");
    std::fs::create_dir_all(&root).unwrap();

    let output = forma(&root)
        .args(["init", "--name", "Acme Knowledge", "--timezone", "UTC"])
        .output()
        .unwrap();

    assert!(!output.status.success());
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("init failed"));
    assert!(stdout.contains("error init.confirmationRequired:"));
    assert!(stdout.contains("pass --yes in non-interactive environments"));
    assert!(!root.join(forma_core::FORMA_DIR).exists());

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
  root: "."
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
