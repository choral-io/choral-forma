# Forma for Zed

This development extension adds Forma reference navigation to Zed's built-in Markdown language through the `forma lsp` command.

## Requirements

- Install the same Forma CLI version as this repository.
- Ensure `forma` is available in the Zed worktree environment's `PATH`.
- Open a worktree whose root contains `.forma.md`.
- Enable Zed semantic tokens in `combined` mode for Markdown if you want Forma wikilink targets to use the active theme's link-target styling instead of Markdown's emphasis styling:

    ```json
    {
        "languages": {
            "Markdown": {
                "semantic_tokens": "combined"
            }
        }
    }
    ```

The extension does not download or update the CLI. It does not add Preview rendering or custom UI.

## Local installation

1. Build and install the repository's `forma` binary on your `PATH`.
2. In Zed, run `zed: install dev extension`.
3. Select this `extensions/zed` directory.
4. Open a Markdown file in a Forma workspace, then use `F12` or `Cmd+Click` / `Ctrl+Click` on a supported reference.

With Markdown semantic tokens enabled, Forma marks the target portion of wikilinks and embeds as a standard LSP `string` token. Zed then derives the foreground and font style from the active theme; aliases remain styled as Markdown link text.

If the server does not start, run `zed: open log` and confirm that the Zed worktree environment can resolve `forma`.
