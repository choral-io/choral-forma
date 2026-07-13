use zed_extension_api::{self as zed, Result};

struct FormaExtension;

impl zed::Extension for FormaExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let command = worktree.which("forma").ok_or_else(|| {
            "Forma CLI was not found in the Zed worktree environment. Install the matching `forma` version and ensure it is available on PATH before opening this workspace."
                .to_string()
        })?;

        Ok(zed::Command {
            command,
            args: vec![
                "--workspace".to_string(),
                worktree.root_path(),
                "lsp".to_string(),
            ],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(FormaExtension);
