# Forma for Zed

This development extension adds Forma reference navigation to Zed's built-in Markdown language through the `forma lsp` command.

## Requirements

- Install the same Forma CLI version as this repository.
- Ensure `forma` is available in the Zed worktree environment's `PATH`.
- Open a worktree whose root contains `.forma.md`.

The extension does not download or update the CLI. It does not add Preview rendering or custom UI.

## Local installation

1. Build and install the repository's `forma` binary on your `PATH`.
2. In Zed, run `zed: install dev extension`.
3. Select this `extensions/zed` directory.
4. Open a Markdown file in a Forma workspace, then use `F12` or `Cmd+Click` / `Ctrl+Click` on a supported reference.

If the server does not start, run `zed: open log` and confirm that the Zed worktree environment can resolve `forma`.
