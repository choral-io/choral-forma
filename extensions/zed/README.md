# Forma for Zed

This development extension adds Forma reference navigation to Zed's built-in Markdown language through the `forma lsp` command.

## Requirements

- Install the same Forma CLI version as this repository.
- Ensure `forma` is available in the Zed worktree environment's `PATH`.
- Open a worktree whose root contains `.forma.md`.
- Enable Zed semantic tokens in `combined` mode for Markdown and map Forma's semantic token types to syntax styles from the active theme:

    ```json
    {
        "languages": {
            "Markdown": {
                "semantic_tokens": "combined"
            }
        },
        "global_lsp_settings": {
            "semantic_token_rules": [
                {
                    "token_type": "formaWikilinkDelimiter",
                    "style": ["punctuation.bracket", "punctuation"]
                },
                {
                    "token_type": "formaLinkTarget",
                    "style": ["link_uri", "string"]
                },
                {
                    "token_type": "formaLinkFragment",
                    "style": ["link_uri", "string"]
                },
                {
                    "token_type": "formaLinkLabel",
                    "style": ["link_text", "string"]
                },
                {
                    "token_type": "formaEmbedMarker",
                    "style": ["punctuation.special", "operator"]
                }
            ]
        }
    }
    ```

    The fallback arrays use syntax styles supplied by the current theme rather than fixed colors. Keep `combined` mode so Zed's built-in Markdown grammar remains the base highlighter.

The extension does not download or update the CLI. It does not add Preview rendering or custom UI.

## Local installation

1. Build and install the repository's `forma` binary on your `PATH`.
2. In Zed, run `zed: install dev extension`.
3. Select this `extensions/zed` directory.
4. Open a Markdown file in a Forma workspace, then use `F12` or `Cmd+Click` / `Ctrl+Click` on a supported reference.

With Markdown semantic tokens enabled and the rules above installed, Zed gives wikilink delimiters matching punctuation styling, wikilink and embed targets matching link-target styling, aliases matching native Markdown link text, and embed markers their own punctuation role. Link fragments use the same theme style as link targets. The extension continues to use Zed's built-in Markdown language and grammar.

If the server does not start, run `zed: open log` and confirm that the Zed worktree environment can resolve `forma`.
