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
- cancellation, timeout, process output, and user-visible status;
- translating Forma diagnostics, links, definitions, commands, and locations into editor APIs;
- opening source Markdown documents;
- hosting preview WebViews and mapping editor theme tokens into renderer tokens;
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

A view remains a Markdown document. Opening a view path should use the ordinary text editor by default. The extension provides `Open View Preview` and `Open View Preview to the Side` commands plus an optional CodeLens near the view mount.

The preview renders the Markdown body and inserts the structured projection at the recognized mount. For example:

```markdown
# Task Board

Current delivery work grouped by status.

<!-- forma:content -->

The board is generated from repository metadata.
```

The current `view.render` result contains view metadata, projection output, and diagnostics but not enough body and source-mapping data to compose this document faithfully. Extend the contract with an optional document payload such as:

```ts
type ViewRenderDocument = {
    bodySource: string;
    mounts: Array<{
        kind: "content";
        location: DiagnosticLocation;
    }>;
};
```

The backend remains responsible for locating and validating mounts. The preview renderer may render Markdown presentation, but it must not reinterpret Forma directives or query configuration.

Preview refresh is save-driven in the first version. A later transient render operation can support unsaved view source after the editor contract proves the need.

## Theme Contract

Preview components use semantic Forma tokens supplied by a host theme adapter:

```text
editor tokens
-> --forma-background, --forma-foreground, --forma-border,
   --forma-focus, --forma-selection, --forma-font-*, --forma-chart-*
-> list, table, kanban, graph renderers
```

The VS Code adapter should derive these values from `--vscode-*` WebView variables, including editor colors, focus and contrast borders, chart colors, and editor font settings. Renderers must support light, dark, high-contrast, and reduced-motion modes without theme-name-specific rules.

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
- Do not expose absolute host paths in structured public results.
- Do not export cookies, credentials, editor storage, or repository content to external services.
- Keep WebView script and resource access constrained with a content security policy and narrow local resource roots.
- Treat preview interactions as read-only. Opening a source file is allowed; mutations require a separately accepted operation contract.

## Version Compatibility

The extension should declare the operation schema versions it supports. On activation, it should detect incompatible Forma output and present an actionable upgrade or downgrade message rather than attempting best-effort interpretation of unknown result shapes.

## Validation Boundary

Core operation behavior should be tested in Rust. JSON result compatibility belongs in `forma-rpc` and `packages/shared`. Adapter tests should cover workspace selection, subprocess cancellation and errors, result-to-editor mapping, theme token mapping, preview refresh, and navigation commands without duplicating Core semantic fixtures.

## External References

- [VS Code WebView API](https://code.visualstudio.com/api/extension-guides/webview), including WebView theme classes, `--vscode-*` color variables, and editor font variables.
- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color), including editor, focus, contrast, selection, and chart color tokens available to themed extension surfaces.
