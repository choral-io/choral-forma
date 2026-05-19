use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use forma_core::{FORMA_INDEX_SUMMARY_PATH, FORMA_WORKSPACE_PATH};

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
fn init_create_list_inspect_and_index_check_use_operation_json() {
    let root = fixture_root("starter-flow");
    std::fs::create_dir_all(&root).unwrap();

    let init = forma(&root)
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
    assert!(root.join(FORMA_WORKSPACE_PATH).is_file());
    assert!(root.join(FORMA_INDEX_SUMMARY_PATH).is_file());
    assert!(root.join("notes").is_dir());

    let create = forma(&root)
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
    assert!(create_stdout.contains(r#""status":"warning""#));
    assert!(create_stdout.contains(r#""code":"index.stale""#));
    assert!(root.join("todos/user-registration.md").is_file());

    let stale = forma(&root)
        .args(["index", "check", "--json"])
        .output()
        .expect("forma index check should run");

    assert!(
        stale.status.success(),
        "{}",
        String::from_utf8_lossy(&stale.stderr)
    );
    assert!(String::from_utf8_lossy(&stale.stdout).contains(r#""code":"index.stale""#));

    let list = forma(&root)
        .args(["list", "--collection", "todos", "--json"])
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
        .args([
            "inspect",
            "--collection",
            "todos",
            "user-registration",
            "--json",
        ])
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

    std::fs::remove_dir_all(root).unwrap();
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
    assert!(unknown_stdout.contains(r#""code":"create.inputInvalid""#));

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

fn forma(root: &std::path::Path) -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_forma"));
    command.current_dir(root);
    command
}

fn fixture_root(name: &str) -> std::path::PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    std::env::temp_dir().join(format!("forma-cli-{name}-{unique}"))
}
