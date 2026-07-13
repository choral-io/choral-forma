---
scope: project
type: technical-design
owners:
    - "members/tiscs"
reviewers: []
tags:
    - architecture
    - editor-extension
    - vscode
    - rpc
    - views
sources:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/forma-core-technical-direction"
    - "architecture/forma-p0-operation-api-spec"
    - "architecture/forma-view-query-model"
---

# Editor Extension Adapter Contract

## Goal

Define the boundary between Forma Core and editor-specific extensions so the first VS Code implementation can move quickly without making VS Code the owner of workspace semantics.

## Boundary

```text
repository Markdown and .forma.md
-> Forma Core operations
-> JSON-compatible result contracts
-> editor adapter
-> native editor features and themed previews
```

Forma Core owns:

- configuration loading and validation;
- workspace-relative path safety;
- Markdown, wikilink, embed, and view-mount recognition;
- schema and semantic reference interpretation;
- reference resolution and ambiguity diagnostics;
- workspace health and entry diagnostics;
- view source, query, sort, and projection evaluation;
- stable operation result shapes.

An editor adapter owns:

- activation and editor lifecycle;
- finding candidate `.forma.md` entrypoints inside opened workspace folders or current-file ancestors;
- selecting the applicable workspace in multi-root sessions;
- locating and invoking a compatible Forma binary;
- optionally acquiring and managing the release-aligned Forma binary inside editor extension storage after explicit user confirmation;
- cancellation, timeout, process output, and user-visible status;
- translating Forma diagnostics, links, definitions, commands, and locations into editor APIs;
- opening source Markdown documents;
- extending editor-native Markdown Preview and mapping host theme tokens into projection styles;
- refreshing derived state when source files are saved or configuration changes.

The adapter must not deserialize `.forma.md` into a second product model, rescan Markdown to build a reference graph, evaluate view queries, or silently write workspace files.

## Workspace Discovery

The presence of `.forma.md` is the explicit discovery signal. `.forma/` alone is not sufficient.

For each opened editor workspace folder, the adapter should:

1. Check the folder root for `.forma.md`.
2. When a Markdown file is active, walk its ancestors only until the editor workspace boundary and select the nearest `.forma.md`.
3. Keep each discovered root as a separate Forma workspace in multi-root sessions.
4. Call `config.inspect` before treating a candidate as ready.
5. Expose ready, invalid-config, binary-missing, incompatible-version, and no-workspace states.

Discovery must not scan arbitrary parent directories outside the opened editor workspace or the whole machine.

## Transport Baseline

The initial extension should prefer short-lived `forma ... --json` subprocess calls for operations that already have CLI surfaces. This avoids requiring a background server and port lifecycle before product behavior is proven.

An operation needed by editor integrations should still be defined in the shared Rust operation and RPC model first. A CLI command may then expose it for the first extension. The adapter must not treat CLI output text intended for humans as an API; only structured JSON results are valid inputs.

Long-lived HTTP RPC, a future stdio RPC adapter, or a language server can be introduced after repeated invocation, unsaved-buffer analysis, or latency evidence justifies the lifecycle cost.

## Operation Requirements

Existing operations cover much of the MVP:

| Interaction                              | Operation                      |
| ---------------------------------------- | ------------------------------ |
| Validate a discovered root               | `config.inspect`               |
| Report workspace health                  | `workspace.health` and `check` |
| Inspect a saved entry                    | `inspect`                      |
| Read outgoing and incoming relationships | `file.references`              |
| Render a configured view                 | `view.render`                  |

The editor navigation loop needs one additional read-only operation:

```text
reference.resolve
```

Suggested input:

```json
{
    "sourcePath": "knowledge/tasks/example.md",
    "target": "members/tiscs",
    "intent": "reference",
    "fragment": null
}
```

The result should contain the canonical target path when resolved, an optional fragment location, display metadata, ambiguity candidates, and diagnostics. Resolution must use the same workspace index, path rules, schema types, and case behavior as normal Forma checks.

The first implementation may refresh saved documents only. Live navigation and diagnostics for unsaved buffers should later use a read-only `document.analyze`-style operation that accepts transient source text without persisting it. The extension must not introduce a second Markdown parser as an unsaved-buffer shortcut.

## View Preview Contract

A view remains a Markdown document. Opening a view path uses the ordinary text editor, and the editor's native Markdown Preview remains the only preview surface. Forma contributes a Markdown-it enhancement and Preview stylesheet instead of registering a second preview button or hosting a parallel WebView.

Core metadata `kind: view` determines whether a document receives a View projection. The content mount controls placement only: the projection replaces the mount when present and is appended to the document when the mount is absent. For example:

```markdown
# Task Board

Current delivery work grouped by status.

<!-- forma:content -->

The board is generated from repository metadata.
```

The backend remains responsible for metadata, reference semantics, View evaluation, and mount validation. Because Core operations are asynchronous while Markdown-it rendering is synchronous, the adapter may pre-render and cache structured projection HTML by document URI, then refresh the native Preview. The adapter must not reinterpret Forma directives or query configuration.

Native Preview frontmatter links and the Forma Explorer navigation model are specified in [[design/vscode-preview-links-and-navigation]].

Preview refresh is save-driven in the first version. A later transient render operation can support unsaved view source after the editor contract proves the need.

## Theme Contract

Projection components use VS Code theme variables already available in native Markdown Preview:

```text
VS Code Preview tokens
-> narrowly scoped --forma-* projection tokens
-> list, table, kanban, graph renderers
```

The VS Code adapter derives these values from `--vscode-*` variables, including editor colors, focus and contrast borders, chart colors, and editor font settings. Renderers must support light, dark, high-contrast, and reduced-motion modes without theme-name-specific rules.

Other editor adapters may provide the same semantic Forma tokens from their own theme APIs. Shared renderer code must not import a VS Code API or WebApp theme context.

## Graph Renderer Boundary

`view.render` graph nodes and edges are the stable input boundary. The current WebApp renderer's fixed circular placement, simple space-color hash, and hover-only focus behavior are not part of the adapter contract.

Before selecting a graph library or sharing an existing component, the VS Code work should validate at least two renderer approaches against the same fixture and requirements:

- meaningful force-directed or hierarchical layout;
- deterministic initial placement and stable refresh behavior;
- persistent node selection and one-hop focus;
- node search and filters for space, kind, and edge type;
- source navigation from nodes;
- readable light, dark, and high-contrast themes;
- reduced-motion behavior;
- usable empty, invalid, and moderately dense graph states.

User-adjusted coordinates may be stored in editor workspace state, but must not be written into Markdown or Forma configuration in the MVP.

## Security And Trust

- Do not execute a workspace-provided binary automatically in an untrusted editor workspace.
- Do not download or execute a managed binary in Restricted Mode.
- A managed binary must come from the exact release tag aligned with the extension version, use a platform-specific release asset, and pass its published checksum before becoming executable.
- Managed installation must stay inside editor extension storage. It must not modify `PATH`, overwrite a user-managed executable, or derive an executable path from workspace content.
- An explicit machine-level binary path remains authoritative. A release-aligned managed binary may be preferred over extension-host `PATH` discovery when no explicit path is configured.
- Do not expose absolute host paths in structured public results.
- Do not export cookies, credentials, editor storage, or repository content to external services.
- Prefer native editor preview and navigation APIs so the adapter does not introduce another script-enabled WebView security boundary.
- Treat preview interactions as read-only. Opening a source file is allowed; mutations require a separately accepted operation contract.

## Version Compatibility

The extension should declare the operation schema versions it supports. On activation, it should detect incompatible Forma output and present an actionable upgrade or downgrade message rather than attempting best-effort interpretation of unknown result shapes.

During the coordinated Alpha release line, the VS Code extension and Forma CLI must report the same release version. Broad acceptance of every `0.1.0` prerelease is unsafe because CLI operations may be added without changing the operation schema version. The extension manifest version is the expected CLI version and must not be duplicated as a separately maintained constant.

When the configured or discovered CLI is missing or has a different version, the extension may offer a user-initiated installation of the matching release. Downloads use the exact `v<extension-version>` tag rather than `latest`, install into a versioned directory under extension global storage, and preserve external `forma.path` and `PATH` installations. In a remote workspace, acquisition and execution occur in the remote workspace Extension Host; environments without outbound release access retain the explicit-path and manual-install fallbacks.

Longer term, a structured capability operation may replace exact version equality after the compatibility contract can describe supported operations and schema revisions directly.

The initial managed lifecycle implementation and release validation are tracked in [[tasks/manage-vscode-forma-cli-lifecycle]].

## Validation Boundary

Core operation behavior should be tested in Rust. JSON result compatibility belongs in `forma-rpc` and `packages/shared`. Adapter tests should cover workspace selection, subprocess cancellation and errors, result-to-editor mapping, theme token mapping, preview refresh, and navigation commands without duplicating Core semantic fixtures.

## External References

- [VS Code Markdown extension contributions](https://code.visualstudio.com/api/references/contribution-points), including Markdown-it plugins and Preview styles.
- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color), including editor, focus, contrast, selection, and chart color tokens available to themed extension surfaces.
