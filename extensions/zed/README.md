# Forma for Zed

This development extension adds Forma reference navigation to Zed's built-in Markdown language through the `forma lsp` command.

## Requirements

- Install the same Forma CLI version as this extension.
- Ensure `forma` is available in the Zed worktree environment's `PATH`.
- Open a worktree whose root contains `.forma.md`.

The extension resolves `forma` from the worktree `PATH` and runs `forma --version` before starting the language server. During the coordinated Alpha line, the CLI version must match the extension version exactly. A missing or incompatible CLI fails with an actionable language-server status instead of starting best-effort. Internal test installations can place the desired release earlier on the Zed worktree `PATH` without replacing another machine-level installation.

Zed's native `lsp.forma.binary` setting is a host-level escape hatch. When present, Zed launches that command directly and bypasses the extension's command construction, version check, and required `--workspace <root> lsp` arguments. Do not use that override for the normal Forma setup or expect it to participate in the managed CLI lifecycle.

The extension does not download or update the CLI. Managed acquisition, checksum verification, caching, and remote-host validation remain follow-up work. It does not add Preview rendering or custom UI.

## Local installation

1. Build the repository's `forma` binary and install it on the `PATH` visible to the Zed worktree.
2. In Zed, run `zed: install dev extension`.
3. Select this `extensions/zed` directory.
4. Open a Markdown file in a Forma workspace, then use `F12` or `Cmd+Click` / `Ctrl+Click` on a supported reference.

Forma does not provide syntax-highlight rules, fixed colors, or font-style overrides. Zed's built-in Markdown grammar and active theme remain the sole owners of source rendering, including wikilinks and embeds. No Zed highlighting setting is required by Forma.

Inside inline code and fenced blocks labelled `md` or `markdown`, Forma supplies a lexical editor projection so explicit ordinary Markdown links, wikilinks, and embeds use consistent native DocumentLink navigation. These projections do not add examples to Forma indexing, diagnostics, Definition results, workspace relationships, or source styling. Fences for other languages remain untouched.

For a uniquely resolved document link without a heading fragment, the LSP uses Zed's positionless `zed://file` target so reopening an existing file preserves its cursor and scroll state. Heading links continue to use a positioned `file://` target. This compatibility path is selected only when the LSP client identifies itself as Zed; remote-workspace behavior still requires separate validation.

If the server does not start, run `zed: open log` and confirm that the Zed worktree environment can resolve `forma`.
