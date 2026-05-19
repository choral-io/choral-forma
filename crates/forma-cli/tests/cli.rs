use std::process::Command;

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
