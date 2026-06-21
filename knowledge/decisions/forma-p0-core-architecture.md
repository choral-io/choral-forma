---
scope: project
type: adr
owners: []
reviewers: []
tags:
    - architecture
    - forma
    - rust
    - p0
supersedes: []
superseded_by: []
---

# Forma P0 Core Architecture

## Context

Choral Forma is a structured knowledge engine over repository-backed Markdown files. The P0 architecture needs to support CLI usage, a local read-only WebApp, stable Script and Agent interfaces, future MCP and editor integrations, and a long-term path for stronger parsing, rendering, checking, and indexing.

P0 should not become a full Markdown editor, desktop app platform, plugin runtime, or custom scripting environment.

## Decision

Use Rust as the provisional P0 core runtime and deliver Forma as a single `forma` binary.

The P0 binary should provide:

- CLI commands.
- A local read-only HTTP server via `forma serve`.
- A shared operation/RPC model used by CLI and HTTP adapters.

The core engine should be independent from CLI handlers. CLI, local HTTP API, future MCP tools, and future editor integrations should call the same operation dispatcher instead of duplicating product semantics.

The internal operation model should use typed Rust structs and enums. External results should stay JSON-compatible so CLI `--json`, local HTTP API responses, future MCP tool results, and future editor extensions can share schemas.

Local HTTP RPC should use strict JSON-RPC 2.0 message shapes. P0 only needs a minimal subset: `POST /rpc`, a single request object with `jsonrpc: "2.0"`, `id`, `method`, and `params`, plus success responses with `result` and error responses with JSON-RPC `error`. P0 does not need batch requests, notifications, subscriptions, server push, stdio JSON-RPC, or MCP.

CLI `--json` should output direct operation results, not JSON-RPC envelopes. Workspace diagnostics are operation results, not transport errors. JSON-RPC errors should represent protocol, parameter, dispatch, inaccessible workspace, or internal execution failures, using standard JSON-RPC error codes where applicable and Forma-specific codes in `error.data`.

P0 should use a small Rust workspace:

```text
Cargo.toml
package.json
pnpm-workspace.yaml
crates/
  forma-core/
  forma-rpc/
  forma-cli/
packages/
  webapp/
  shared/
```

Responsibilities:

- `forma-core`: domain engine for config, schema, parsing, FormaAST, indexing, checks, rendering, and create flows.
- `forma-rpc`: typed operation model, JSON-compatible request/response structs, errors, and dispatcher.
- `forma-cli`: CLI command parsing, human and JSON output formatting, `forma serve` local HTTP adapter, and WebApp asset serving.
- `packages/webapp`: TypeScript React/Vite read-only WebApp.
- `packages/shared`: Forma RPC HTTP client, shared TypeScript operation/result types, shared UI primitives, shared styles, and utilities that future editor extensions may reuse.

P0 should not split a separate `forma-serve` crate. `forma serve` should live in `forma-cli` for P0, but it must call the `forma-rpc` dispatcher instead of duplicating or bypassing core behavior. A separate serve crate can be introduced later if the local server API, watcher/cache/session behavior, editor extension integration, or lifecycle management becomes large enough to justify a new boundary.

## Markdown And Rendering

Forma should be parser-and-renderer-first, not Markdown-editor-first.

P0 should:

- Keep existing editors as the primary writing surface.
- Split frontmatter and Markdown body before parsing.
- Parse YAML frontmatter into metadata.
- Parse Markdown body into an AST.
- Build `FormaAST`, defined as Markdown AST plus Forma extensions.
- Use parsing and `FormaAST` for reading, indexing, diagnostics, rendering, and future structured actions.
- Avoid rewriting existing Markdown bodies.
- Generate new files from templates.

Use a serde-compatible YAML parser for P0, with `serde_yml` as the preferred candidate. Forma should split frontmatter and Markdown body itself before YAML parsing. P0 `.forma/*.yml` configuration should parse into typed Rust structs where practical, while entry frontmatter should parse into a generic YAML value before space schema validation because spaces are user-defined.

Unknown configuration fields should produce diagnostics or warnings rather than immediate hard failures. P0 should not modify existing frontmatter. Future structured edit commands should use a separately designed metadata patcher that preserves the Markdown body, unknown frontmatter fields, ordering, and comments where practical.

`FormaAST` should not replace Markdown AST or become a separate document fact model. It should annotate or extend Markdown AST-derived structure with Forma-specific information such as template placeholders, view mounts, embedded-view references, wikilink embed intent, resolved params, diagnostics, source mappings, rendered view result references, and future actions.

Rendering should flow through:

```text
source Markdown
-> Markdown AST
-> FormaAST enrichment
-> analysis output / Markdown export / optional HTML render
```

For the local WebApp reader, final HTML rendering should happen in the client from Markdown source plus backend-derived headings, references, diagnostics, and other analysis output. Server-side HTML remains an optional compatibility or static-export target, not the primary WebApp rendering contract. Markdown export is a compatibility output target, not the primary rendering intermediate.

P0 should parse wikilink embeds such as `![[notes/project-brief]]` as embedded reference intent, validate their targets like normal references, and render them as ordinary links or linked placeholders. P0 should not expand embedded content. P1 can add transclusion rendering, cycle detection, and Markdown snapshot export.

Use `markdown-rs` as the preferred P0 Markdown parser, paired with a custom Forma scanner for wikilinks, wikilink embeds, and Forma HTML comment directives. The Markdown parser should own CommonMark/GFM parsing; Forma should own product-specific reference and directive semantics. Keep Comrak as the fallback parser if implementation work finds that rendering fidelity, CommonMark/GFM edge compatibility, or HTML rendering control outweigh mdast ergonomics.

## Local Service And GUI

`forma serve` should start a local HTTP server bound to localhost by default. The server should expose RPC-over-HTTP endpoints backed by the shared operation dispatcher and serve the read-only WebApp static assets.

The WebApp should not read files directly. It should call the local API for workspace overview, space listing, entry inspection, Markdown source and render analysis, view rendering, diagnostics, and index status. The WebApp may render document Markdown in the browser, but relationship resolution, diagnostics, view queries, and workspace indexing remain backend responsibilities.

End users should not need Node, Bun, or another frontend runtime to use released Forma builds. Development mode may use a frontend dev server.

Use TypeScript, React, and Vite for the P0 WebApp. Keep frontend code in a root workspace under `packages/webapp` and `packages/shared`. Implementation details such as component libraries, styling, table components, Markdown rendering components, API client generation, package manager scripts, and asset embedding can be finalized during implementation. Released Forma builds should serve built static assets from the Rust binary or release package.

## Index And Diagnostics

P0 should distinguish repository source files from runtime diagnostic results. The first public implementation does not use a committed discovery index.

Optional local configuration, loaded only through `.forma.yml` include patterns:

```text
.forma/local/*.yml
```

Future local caches:

```text
.forma/local/cache/
```

The read model is rebuilt in memory from Markdown files and shared configuration. It contains resolved structure, not health state. Runtime projections can include workspace summary, spaces, views, entries, and successfully resolved references. They must not persist diagnostics, check summaries, last check status, health summaries, effective config, runtime values, rendered views, local paths, private local files, full frontmatter, full Markdown bodies, or user behavior traces.

Diagnostics are runtime results. They are recomputed by `forma check`, `forma serve`, or the shared RPC dispatcher. They should not enter source files and should not be persisted as local result files. Future implementation caches may accelerate diagnostic computation, but caches must be local-only, rebuildable, and invisible as product facts.

P0 index refs should distinguish `intent: reference | link | embed`.

## Path Model

All persisted and API-facing workspace paths should use workspace-relative POSIX-style paths, regardless of host operating system. Examples:

```text
todos/foo.md
.forma/views/todos.md
users/tiscs.md
```

Host filesystem paths are internal implementation details. Index files, diagnostics, configuration references, RPC results, and CLI JSON output should not expose absolute paths or platform-specific separators.

P0 should:

- Use workspace-relative POSIX paths in committed files and public JSON output.
- Accept Windows-style separators in CLI input where practical, then normalize to POSIX-style workspace paths.
- Reject absolute paths and `..` traversal in workspace locators and config paths unless a command explicitly accepts a workspace root path.
- Keep path identity case-sensitive in the Forma data model.
- Avoid silently resolving references case-insensitively.
- Allow diagnostics to suggest a case-correct candidate when a case-insensitive match exists.
- Preserve filenames as found and avoid automatic Unicode normalization.
- Ensure `slugify` and create flows avoid path separators, reserved filesystem characters, empty filenames, and Windows reserved device names.
- Keep config globs workspace-relative, POSIX-style, and free of absolute paths, `..`, or home expansion.

## Test Strategy

P0 should use a fixture-first and golden-output-heavy test strategy.

Test layers:

- Unit tests for pure helpers such as path normalization, `slugify`, placeholder parsing, config merge, Schema DSL validation, diagnostic construction, JSON-RPC envelope parsing, and reference resolver helpers.
- Fixture tests over realistic miniature workspaces under `tests/fixtures/`.
- Golden JSON tests for stable Script, Agent, HTTP, and future MCP contracts.
- CLI tests focused on exit codes, parseable JSON, `schemaVersion`, and the distinction between operation diagnostics and transport errors.
- Minimal local HTTP API integration tests for `POST /rpc`.
- Frontend type/build tests for `packages/shared` and `packages/webapp`.

Golden outputs should be canonical JSON and must not include absolute paths, mtimes, hashes, runtime local values, or other unstable data. Human-oriented CLI output can have limited snapshot coverage, but product contracts should be tested through JSON results.

Path behavior should receive dedicated tests for Windows separators, rejected absolute paths, rejected `..` traversal, case-mismatch suggestions, reserved filenames, and Unicode filename preservation.

Before release, CI should run on macOS, Linux, and Windows.

## Build And Distribution

P0 should preserve a single-binary end-user experience while allowing a Rust and WebApp development workflow.

Build inputs:

- Rust Cargo workspace.
- pnpm workspace for `packages/webapp` and `packages/shared`.
- `Cargo.lock` committed.
- `pnpm-lock.yaml` committed.
- `rust-toolchain.toml` to pin the Rust toolchain.
- `mise` tasks as the project-level entrypoint for check, test, format, and build commands.

Release builds should serve built WebApp static assets from the Rust binary or release package. The preferred release mode is embedded assets so `forma serve` does not require a separate frontend runtime or asset directory. Development mode may serve local `packages/webapp/dist` assets or proxy a Vite dev server. P0 may add a user-specified WebApp asset directory override for development debugging and issue verification. That override should remain a serve-time option rather than shared workspace configuration so knowledge repositories stay portable. Broader custom distribution and white-label packaging remain P1 concerns. P0 may also add explicit `/rpc` CORS origins for Vite dev server workflows. This should remain disabled by default, reject wildcard origins, and keep RPC permissions unchanged.

P0 distribution should use:

- GitHub Releases with standalone binaries.
- `install.sh` for Unix-like systems.
- `install.ps1` for Windows PowerShell.
- Compatibility with mise's GitHub backend.
- Release checksums for downloaded artifacts.

Initial release targets should include macOS arm64, macOS x64, Linux x64, and Windows x64. Package-manager-specific distribution such as Homebrew, Scoop, Chocolatey, npm wrappers, system installers, or auto-updaters can wait until product demand justifies them.

P0 release artifact names should stay predictable so install scripts, Agents, and mise's GitHub backend can match them without repository-specific logic:

```text
forma-linux-x64.tar.gz
forma-macos-arm64.tar.gz
forma-macos-x64.tar.gz
forma-windows-x64.zip
```

Each artifact should have a sibling `.sha256` file. Archives should contain the `forma` executable under `bin/` and may include a short README. The release workflow may build and upload artifacts first, then publish a GitHub Release from those artifacts on tag pushes or explicit manual approval.

## Extension Boundary

P0 uses declarative extension surfaces only:

- Declarative Starter Kits.
- Forma Schema DSL.
- Semantic types.
- Declarative views.
- Create templates with simple placeholders.
- Shared Forma operation/RPC model.
- Stable JSON outputs from CLI and local HTTP API.

P0 does not support:

- Runtime plugin loading.
- Third-party executable hooks.
- Custom query scripts.
- Custom template functions.
- Custom schema validators as code.
- DataviewJS-like trusted custom scripts.
- Arbitrary JavaScript, Rust, WASM, or shell execution.
- Network-fetching plugins.
- MCP server.
- VS Code or Zed extensions.
- Desktop or mobile clients.

Future adapters should extend through Forma RPC. Future runtime plugin capability, if added, requires an explicit trust, sandboxing, permission, debugging, and compatibility design.

## Consequences

This decision prioritizes long-term core engine quality over fastest possible implementation speed. Rust may require more upfront learning and library evaluation than Go or TypeScript, but it better supports a durable typed engine for schema validation, reference resolution, diagnostics, indexing, and future adapter reuse.

P0 remains small because MCP, editor extensions, desktop clients, mobile clients, runtime plugins, full transclusion, and Markdown editing are not part of the first implementation.

The architecture requires an early operation boundary. CLI commands and local HTTP endpoints should be adapters over shared core operations, not separate implementations.

## Alternatives Considered

Go was considered for a simpler and faster P0 implementation with excellent single-binary CLI and HTTP server support. It remains a credible fallback if the Rust implementation path shows unacceptable risk, but it is less aligned with future Tauri-style desktop options and provides less type-system leverage for the core knowledge engine.

Bun and TypeScript were considered for fast WebApp and CLI prototyping, single executable packaging, and shared frontend/backend types. They remain useful for the WebApp, editor extensions, or prototypes, but are not selected as the core runtime because the long-term file knowledge engine should not depend on a JavaScript runtime.

Flutter and Dart were considered for future mobile and desktop UI. They are not selected for the P0 core engine because Forma's core value is repository file parsing, checking, indexing, rendering, and CLI/API behavior rather than a mobile-first UI.

Comrak and pulldown-cmark were considered for Markdown parsing. Comrak remains a fallback because it has a mature CommonMark/GFM parser and renderer with source positions, but its parser-native wikilink support does not cover Forma's embed intent, so Forma would still need a custom scanner. Pulldown-cmark remains an event-stream fallback but is not selected because the current direction requires AST enrichment through `FormaAST`.

## Related Knowledge

- [Forma core technical direction](../architecture/forma-core-technical-direction.md)
- [Product direction](../product/product-direction.md)
- [Markdown parser spike handoff](../workspace/tiscs/handoffs/forma-markdown-parser-spike.md)
- [Markdown parser spike report](../workspace/tiscs/research/forma-markdown-parser-spike-report.md)

## Open Questions

- Which exact JSON-compatible schemas should P0 expose for each operation?
- Which Forma-specific markers must render to ordinary Markdown, HTML, and JSON in P0?
