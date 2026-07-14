use zed_extension_api::{self as zed, Result};

const EXPECTED_CLI_VERSION: &str = env!("CARGO_PKG_VERSION");
const MAX_DIAGNOSTIC_CHARS: usize = 1_000;

struct FormaExtension;

impl zed::Extension for FormaExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        match language_server_command(worktree) {
            Ok(command) => {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::None,
                );
                Ok(command)
            }
            Err(error) => {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Failed(error.clone()),
                );
                Err(error)
            }
        }
    }
}

fn language_server_command(worktree: &zed::Worktree) -> Result<zed::Command> {
    let command = resolve_binary(worktree.which("forma"))?;
    let environment = worktree.shell_env();

    let output = zed::process::Command::new(&command)
        .arg("--version")
        .envs(environment.clone())
        .output()
        .map_err(|error| {
            format!(
                "Unable to execute the Forma CLI at `{}` for version validation: {}",
                command,
                bounded_text(error.as_bytes())
            )
        })?;
    validate_cli_version(&output)?;

    Ok(zed::Command {
        command,
        args: language_server_arguments(&worktree.root_path()),
        env: environment,
    })
}

fn resolve_binary(path_binary: Option<String>) -> Result<String> {
    path_binary.ok_or_else(|| {
        format!(
            "Forma CLI {EXPECTED_CLI_VERSION} was not found in the Zed worktree PATH. Install the matching CLI in that environment and restart the language server."
        )
    })
}

fn validate_cli_version(output: &zed::process::Output) -> Result<()> {
    if output.status != Some(0) {
        let status = output.status.map_or_else(
            || "without an exit code".to_string(),
            |code| format!("with exit code {code}"),
        );
        let detail = bounded_text(&output.stderr);
        let suffix = if detail.is_empty() {
            String::new()
        } else {
            format!(": {detail}")
        };
        return Err(format!("Forma CLI version check failed {status}{suffix}"));
    }

    let actual = bounded_text(&output.stdout);
    let expected = format!("forma {EXPECTED_CLI_VERSION}");
    if actual != expected {
        let reported = if actual.is_empty() {
            "<empty output>"
        } else {
            &actual
        };
        return Err(format!(
            "Forma CLI version mismatch: this extension expects {expected}, but `{reported}` was reported. Install the matching Forma CLI on the Zed worktree PATH and restart the language server."
        ));
    }

    Ok(())
}

fn bounded_text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(MAX_DIAGNOSTIC_CHARS)
        .collect()
}

fn language_server_arguments(workspace_root: &str) -> Vec<String> {
    vec![
        "--workspace".to_string(),
        workspace_root.to_string(),
        "lsp".to_string(),
    ]
}

zed::register_extension!(FormaExtension);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_binary_is_used() {
        let resolved = resolve_binary(Some("/usr/local/bin/forma".to_string()))
            .expect("PATH binary should resolve");

        assert_eq!(resolved, "/usr/local/bin/forma");
    }

    #[test]
    fn missing_binary_has_an_actionable_error() {
        let error = resolve_binary(None).expect_err("missing binary should be rejected");

        assert!(error.contains("PATH"));
        assert!(error.contains(EXPECTED_CLI_VERSION));
    }

    #[test]
    fn exact_cli_version_is_accepted() {
        let output = zed::process::Output {
            status: Some(0),
            stdout: format!("forma {EXPECTED_CLI_VERSION}\n").into_bytes(),
            stderr: Vec::new(),
        };

        validate_cli_version(&output).expect("aligned CLI should be accepted");
    }

    #[test]
    fn mismatched_cli_version_names_expected_and_actual_versions() {
        let output = zed::process::Output {
            status: Some(0),
            stdout: b"forma 0.1.0-alpha.16\n".to_vec(),
            stderr: Vec::new(),
        };

        let error = validate_cli_version(&output).expect_err("stale CLI should be rejected");

        assert!(error.contains(EXPECTED_CLI_VERSION));
        assert!(error.contains("0.1.0-alpha.16"));
        assert!(error.contains("worktree PATH"));
    }

    #[test]
    fn failed_version_command_reports_bounded_stderr() {
        let output = zed::process::Output {
            status: Some(2),
            stdout: Vec::new(),
            stderr: vec![b'x'; 2_000],
        };

        let error = validate_cli_version(&output).expect_err("failed command should be rejected");

        assert!(error.contains("exit code 2"));
        assert!(error.len() < 1_300);
    }

    #[test]
    fn forma_lsp_arguments_include_workspace_root() {
        let arguments = language_server_arguments("/workspace/project");

        assert_eq!(arguments, ["--workspace", "/workspace/project", "lsp"]);
    }
}
