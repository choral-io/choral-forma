# Forma for Zed

Forma adds workspace-aware reference navigation and language intelligence to Zed's built-in Markdown language through `forma lsp`. The extension ID is `forma-lsp`. The language server is named `forma` in Zed settings.

## Install the Development Extension

1. Clone this repository and [install the matching Forma CLI](../../README.md#installing-forma). Confirm its version with `forma --version` in the environment from which you open Zed. Ensure `forma` is on the Zed worktree's `PATH`.
2. Install Rust with [rustup](https://rustup.rs/) so Zed can compile the development extension for `wasm32-wasip2`.
3. Run `zed: install dev extension` from Zed's command palette and select the repository's `extensions/zed` directory.
4. Open [Getting Started](../../examples/getting-started-workspace/) as a folder in Zed. If Zed opens it in Restricted Mode, review and trust its project settings to enable the server.
5. Open `notes/welcome-to-choral-forma.md` and run Find All References on the link to Getting Started. Zed shows the matching references across the workspace.

If you previously installed the development extension under the ID `forma`, uninstall that entry before installing `forma-lsp`.

## Enable Forma in a Workspace

Open the folder containing `.forma.md` as the Zed worktree root. Add the following to that folder's `.zed/settings.json`. The main repository and Getting Started already include these settings. The `"..."` wildcard keeps other default Markdown servers available.

```json
{
    "languages": {
        "Markdown": {
            "language_servers": ["forma", "..."]
        }
    }
}
```

Older Zed versions can ignore [opt-in language server settings](https://zed.dev/docs/extensions/languages#opt-in-language-servers) and try to start Forma in other Markdown projects. Use a current Zed release for workspace-only activation.

## Language Features

The language server uses Zed's native UI for the added capabilities:

- Hover shows resolved metadata or unresolved and ambiguous reference details.
- Diagnostics report invalid Forma-owned references and the advisory CLI version mismatch.
- Completion suggests canonical entry paths inside wikilinks and embeds, headings and block ids after `#`, and schema-declared `entryRef` frontmatter values. Title search is supported, but completion inserts the canonical path rather than creating an alias identity.
- Find All References returns exact saved and unsaved Forma-owned occurrences. The first implementation returns references only, not an entry declaration.

Ordinary Markdown links remain host-owned. Forma completion and references stay inactive in ordinary strings, inline code, and fenced examples.

Forma does not provide syntax-highlight rules, fixed colors, or font-style overrides. Zed's built-in Markdown grammar and active theme remain the sole owners of source rendering, including wikilinks and embeds. No Zed highlighting setting is required by Forma.

Inside inline code and fenced blocks labelled `md` or `markdown`, Forma supplies a lexical editor projection so explicit ordinary Markdown links, wikilinks, and embeds use consistent native DocumentLink navigation. These projections do not add examples to Forma indexing, diagnostics, Definition results, workspace relationships, or source styling. Fences for other languages remain untouched.

For a uniquely resolved document link without a heading fragment, the LSP uses Zed's positionless `zed://file` target so reopening an existing file preserves its cursor and scroll state. Heading links continue to use a positioned `file://` target. This compatibility path is selected only when the LSP client identifies itself as Zed; remote-workspace behavior still requires separate validation.

## Troubleshooting

The extension launches the `forma` executable from the worktree's `PATH` as `forma --workspace <root> lsp`. If the server fails to start, check `forma --version` in the worktree environment, then open `zed: open log`. Install and update the CLI separately from the extension.

A CLI that supports version advisories reports a mismatch on `.forma.md`. Check Zed's log for older CLIs that fail during startup. A custom `lsp.forma.binary` setting bypasses the extension's launch command, so remove the override when using this setup.

## Build Check

From the repository root, install the Rust toolchain used by Zed's registry and run the same release build as Forma CI.

```sh
mise exec -- rustup toolchain install 1.90.0 --profile minimal --target wasm32-wasip2
mise run check:zed
```
