use zed_extension_api::{self as zed, Result};

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

    fn language_server_initialization_options(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<Option<zed::serde_json::Value>> {
        Ok(Some(forma_lsp_initialization_options()))
    }
}

fn language_server_command(worktree: &zed::Worktree) -> Result<zed::Command> {
    let command = resolve_binary(worktree.which("forma"))?;

    Ok(zed::Command {
        command,
        args: language_server_arguments(&worktree.root_path()),
        env: worktree.shell_env(),
    })
}

fn forma_lsp_initialization_options() -> zed::serde_json::Value {
    zed::serde_json::json!({
        "clientProfile": "zed",
        "extensionVersion": env!("CARGO_PKG_VERSION"),
    })
}

fn resolve_binary(path_binary: Option<String>) -> Result<String> {
    path_binary.ok_or_else(|| {
        "Forma CLI was not found in the Zed worktree PATH. Install it in that environment and restart the language server."
            .to_string()
    })
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
    }

    #[test]
    fn forma_lsp_arguments_include_workspace_root() {
        let arguments = language_server_arguments("/workspace/project");

        assert_eq!(arguments, ["--workspace", "/workspace/project", "lsp"]);
    }

    #[test]
    fn forma_lsp_initialization_options_include_the_extension_version() {
        assert_eq!(
            forma_lsp_initialization_options(),
            zed::serde_json::json!({
                "clientProfile": "zed",
                "extensionVersion": env!("CARGO_PKG_VERSION"),
            })
        );
    }
}
