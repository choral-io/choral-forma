---
scope: project
type: technical-design
owners: []
tags:
    - architecture
    - forma
    - rust
    - markdown
    - rendering
---

# Forma Core Technical Direction

## Context

Choral Forma is a structured knowledge engine over repository-backed Markdown
files. Its core value is not to become another Markdown editor or to exceed the
editing experience of mature editors such as VS Code, Zed, Obsidian, or similar
tools.

Forma should reuse existing editor capabilities for writing where possible. Its
own early technical focus should be parsing, understanding, checking, indexing,
and rendering Markdown-backed knowledge.

## Direction

The provisional core runtime direction is Rust.

P0 should deliver a single `forma` binary that provides CLI commands and a local
read-only web server. The core engine should be independent from CLI handlers so
future adapters can reuse the same behavior.

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

`forma serve` should live in `forma-cli` for P0 instead of a separate
`forma-serve` crate. It must still call the shared `forma-rpc` dispatcher. A
separate serve crate can be introduced later if server lifecycle, watcher/cache
behavior, session state, or editor extension integration becomes large enough to
need its own boundary.

The P0 WebApp should use TypeScript, React, and Vite under `packages/webapp`.
Shared frontend code should live in `packages/shared`, including the Forma RPC
HTTP client, shared TypeScript operation/result types, shared UI primitives,
shared styles, and utilities that future editor extensions may reuse.

Released Forma builds should serve built static assets from the Rust binary or
release package. Node, Bun, pnpm, or another frontend runtime should be a
development/build-time dependency, not an end-user runtime requirement.

P0 does not implement MCP, VS Code extensions, Zed extensions, desktop clients,
or mobile clients. The architecture should still keep those future adapters
practical by exposing stable internal operations and stable JSON-facing command
results.

## Operation And RPC Model

Forma should have one shared operation model for CLI commands, the local HTTP
API, future MCP tools, and future editor extension integrations. Adapters may
use different transports, but they must not reimplement product semantics.

The intended structure is:

```text
forma-core
  operations:
    Check
    Inspect
    List
    Create
    ConfigInspect
    IndexRebuild
    IndexCheck
    ViewRender

forma-rpc
  Request
  Response
  Error
  Dispatcher

adapters:
  cli
  http
  mcp
```

The internal operation model should be typed Rust structs and enums. The
external representation should remain JSON-compatible so CLI `--json`, local
HTTP API responses, future MCP tool results, and future editor extensions can
share schemas.

P0 should define operation structs and route CLI plus local HTTP behavior
through the same dispatcher. Local HTTP RPC should use strict JSON-RPC 2.0
message shapes, but P0 only needs a minimal subset:

- `POST /rpc`.
- Single request object.
- `jsonrpc: "2.0"`.
- `id`.
- `method`.
- `params`.
- Success response with `result`.
- Error response with JSON-RPC `error`.

P0 does not need JSON-RPC batch requests, notifications, subscriptions, server
push, stdio JSON-RPC, or MCP.

CLI `--json` should output direct operation results rather than JSON-RPC
envelopes. A future `forma rpc` stdio adapter can expose strict JSON-RPC 2.0
over the same operation model. P1 can add `forma mcp` as another adapter.

Workspace diagnostics are operation results, not transport errors. JSON-RPC
errors should represent protocol, parameter, dispatch, inaccessible workspace,
or internal execution failures. Use standard JSON-RPC error codes where
applicable and place Forma-specific codes in `error.data`.

## Markdown Strategy

Forma is not Markdown-editor-first. It should be parser-and-renderer-first.

P0 should:

- Keep existing editors as the primary writing surface.
- Parse and render Markdown for knowledge understanding.
- Preserve source files as written.
- Avoid rewriting existing Markdown bodies.
- Generate new files from templates when creating entries.
- Use Markdown AST parsing for reading, indexing, diagnostics, rendering, and
  future structured actions.

P0 should not commit to:

- Rich Markdown editing.
- WYSIWYG Markdown editing.
- Arbitrary Markdown body patching.
- A Markdown editing experience better than dedicated editors.
- A self-owned Markdown editor core.

## Parser Direction

Forma should split frontmatter and Markdown body before parsing:

```text
read file
-> split frontmatter and body
-> parse YAML frontmatter into metadata
-> parse Markdown body into an AST
-> derive document model
```

The derived document model can include:

- Metadata.
- Title candidates.
- Headings and outline.
- Markdown links.
- Wikilinks.
- Obsidian-style embedded references such as `![[note]]`.
- HTML comments and Forma render mount points.
- Markdown task markers as future groundwork.

The Markdown AST is for understanding and rendering, not for P0 body writes.

P0 should use a serde-compatible YAML parser, with `serde_yml` as the preferred
candidate, for structured configuration and frontmatter reads. Forma should
split frontmatter and body itself before parsing YAML.

The target configuration model should start from one explicit `.forma.yml`
entry at the workspace configuration root. Supporting files may live anywhere
that `.forma.yml` references. `.forma/` remains a recommended conventional
support directory, but it should not be treated as a privileged store by itself.

Configuration sections such as workspace identity, runtime values, taxonomies,
templates, views, navigation, dashboard sections, and optional index settings
should parse into typed Rust structs where practical. Unknown config fields
should produce diagnostics or warnings rather than immediate hard failures, so
future-version or manually edited config can remain inspectable.

P0 entry frontmatter should parse into a generic YAML value before configured
schema validation. Taxonomy terms, page types, and future user-defined
classification systems are workspace-defined, so space-specific Rust structs are
not appropriate.

P0 should not modify existing frontmatter. It can generate new files from
templates, but structured metadata edits such as `set`, `add`, `remove`, and
`unset` are P1. Future metadata patching should be designed separately and
should preserve the Markdown body, unknown frontmatter fields, existing order,
and comments where practical.

The P0 parser direction is `markdown-rs` paired with a custom Forma scanner.

`markdown-rs` is preferred because the parser spike found that it provides an
mdast-style AST with source positions, GFM tables, GFM task list state, HTML
comment detection, and straightforward AST ergonomics that fit the `FormaAST`
model. Forma-specific syntax should stay product-owned rather than relying on
parser-native wikilink extensions.

The custom Forma scanner should detect:

- Ordinary wikilinks such as `[[notes/foo]]`.
- Obsidian-style embedded references such as `![[notes/bar]]`.
- Forma HTML comment directives such as `<!-- forma-view -->`.

Comrak remains the fallback candidate if real implementation work finds that
HTML rendering fidelity, CommonMark/GFM compatibility details, or rendering
control are more important than mdast ergonomics. `pulldown-cmark` should remain
an event-stream fallback only if Forma later decides that AST enrichment is not
needed. `tree-sitter-markdown` can be revisited if editor-like incremental
parsing becomes important.

## Rendering Direction

Forma-specific markers such as template placeholders and embedded view comments
should eventually be renderable into ordinary Markdown when useful, but Forma
should not make expanded Markdown the primary rendering model.

The rendering layer needs to support at least three target needs:

- Human-readable Markdown source.
- Client-rendered HTML for the local WebApp reader, produced from Markdown
  source plus backend analysis.
- Structured render output for CLI, Agents, future MCP tools, and editor
  extensions.

Rendering first to ordinary Markdown and then to HTML is simple and inspectable,
but it can lose semantic information about Forma-specific constructs, diagnostics
locations, source mappings, interactive view boundaries, and future actions.

The preferred direction is to build on the parsed Markdown AST with a thin Forma
extension layer, tentatively called `FormaAST`:

```text
FormaAST = Markdown AST + Forma extensions
```

`FormaAST` should not replace the Markdown AST or become a separate document
fact model. It should annotate or extend Markdown AST-derived structure with
Forma-specific information, such as:

- Template placeholders.
- Obsidian-style embedded reference intent.
- View mount comments.
- Embedded view references.
- Resolved params.
- Rendered view result references.
- Diagnostics.
- Source mappings.
- Future actions.

The rendering pipeline should therefore look like:

```text
source Markdown
-> Markdown AST
-> FormaAST enrichment
-> analysis output / Markdown export / optional HTML render
```

For the WebApp, the backend should return Markdown body source and analysis
data, and the browser should own final HTML generation, sanitization, Mermaid
and code rendering, and theme-aware reader styling. Server-side HTML can remain
an explicit compatibility or static-export target, but it should not be the
primary WebApp reader contract.

Markdown export should be an output target for compatibility with other tools,
not the only intermediate representation. P0 should keep the `FormaAST` surface
small enough to avoid building a full rendering or editing engine.

Obsidian-style embeds should be treated as content-embed intent:

```markdown
![[notes/project-brief]]
![[notes/project-brief#Goals]]
![[notes/project-brief#^risk-block]]
```

P0 should parse these forms, validate their targets like normal references, and
record the embed intent in `FormaAST`. P0 should not expand embedded content.
In HTML rendering, embedded references can degrade to ordinary links or linked
placeholders. In Markdown export, they can remain as source embed syntax unless
a later snapshot mode expands them.

P1 can add real transclusion rendering for whole-note and heading embeds,
cycle detection, and Markdown snapshot export. Block embeds should wait until a
stable block identity model is designed.

## Index And Diagnostics Direction

P0 should distinguish committed discovery artifacts from runtime diagnostic
results.

Default P0 behavior should avoid a required persisted index artifact. `forma
serve` can scan source files at startup and keep a read model in memory. This
keeps the first public release simple and avoids stale committed indexes.

Optional future persistent committed artifact:

```text
.forma/index.summary.json
```

Persistent local configuration, optional and ignored:

```text
.forma/overrides/local.yml
```

Future local implementation caches, optional and ignored:

```text
.forma/local/cache/
```

The following results should not be persisted:

- Diagnostics.
- Check summaries.
- Last check status.
- Health summaries.
- Rendered views.
- Effective configuration.
- Runtime values.

Diagnostics are runtime results. They are recomputed by `forma check`,
`forma serve`, or the shared RPC operation dispatcher. Diagnostics should never
enter `.forma/index.summary.json` and should not be written as a local result
file. Future implementation caches may accelerate diagnostic computation, but
they must be local-only, rebuildable, and invisible as product facts.

If a persistent summary index is enabled later, it should be a deterministic
committed discovery artifact. It contains resolved structure, not health state.
It should only include successfully resolved references. Unresolved or ambiguous
references are diagnostics only.

P0 index references should distinguish intent:

```json
{
    "source": "frontmatter",
    "field": "assignees",
    "targetPath": "users/tiscs.md",
    "semanticType": "user",
    "intent": "reference"
}
```

```json
{
    "source": "body",
    "targetPath": "notes/foo.md",
    "semanticType": "note",
    "intent": "link"
}
```

```json
{
    "source": "body",
    "targetPath": "notes/bar.md",
    "semanticType": "note",
    "intent": "embed"
}
```

Target command behavior:

- `forma serve` scans the configured workspace root at startup and serves an
  in-memory read model.
- `forma refresh` or an equivalent explicit operation can rebuild the in-memory
  read model without restarting the server.
- `forma index rebuild` should exist only when a workspace explicitly configures
  a persistent index path. It recomputes the summary index from source and
  writes that configured path, but does not persist diagnostics.
- `forma index check` should compare against a persistent index only when that
  index is configured.
- `forma check` recomputes diagnostics, includes index freshness diagnostics,
  and writes nothing.
- `forma serve` may compute diagnostics in memory and expose check status
  through the local API, but writes nothing by default.

## Path Model

All persisted and API-facing workspace paths should use workspace-relative
POSIX-style paths, regardless of host operating system:

```text
todos/foo.md
users/tiscs.md
```

Host filesystem paths should remain internal implementation details. Index
files, diagnostics, configuration references, RPC results, and CLI JSON output
should not expose absolute paths or platform-specific separators.

P0 path rules:

- Use workspace-relative POSIX paths in committed files and public JSON output.
- Accept Windows-style separators in CLI input where practical, then normalize to
  POSIX-style workspace paths.
- Reject absolute paths and `..` traversal in workspace locators and config
  paths unless a command explicitly accepts a workspace root path.
- Keep path identity case-sensitive in the Forma data model.
- Do not silently resolve references case-insensitively.
- Diagnostics may suggest a case-correct candidate when a case-insensitive match
  exists.
- Preserve filenames as found; do not automatically normalize Unicode.
- Ensure `slugify` and create flows avoid path separators, reserved filesystem
  characters, empty filenames, and Windows reserved device names.
- Keep config globs workspace-relative, POSIX-style, and free of absolute paths,
  `..`, or home expansion.

Resolved wikilinks and embedded references should map to workspace-relative
paths such as `users/tiscs.md` or `notes/foo.md`.

## Test Strategy

P0 should use a fixture-first and golden-output-heavy test strategy.

Test layers:

- Unit tests for pure helpers such as path normalization, `slugify`, placeholder
  parsing, config merge, Schema DSL validation, diagnostic construction,
  JSON-RPC envelope parsing, and reference resolver helpers.
- Fixture tests over realistic miniature workspaces.
- Golden JSON tests for stable Script, Agent, HTTP, and future MCP contracts.
- CLI tests focused on exit codes, parseable JSON, `schemaVersion`, and the
  distinction between operation diagnostics and transport errors.
- Minimal local HTTP API integration tests for `POST /rpc`.
- Frontend type/build tests for `packages/shared` and `packages/webapp`.

Suggested fixture shape:

```text
tests/fixtures/
  minimal-valid/
  stale-index/
  unresolved-ref/
  ambiguous-ref/
  invalid-frontmatter/
  invalid-config/
  invalid-view/
  path-cases/
```

Golden outputs should be canonical JSON and must not include absolute paths,
mtimes, hashes, runtime local values, or other unstable data. Human-oriented CLI
output can have limited snapshot coverage, but product contracts should be
tested through JSON results.

Path behavior should receive dedicated tests for Windows separators, rejected
absolute paths, rejected `..` traversal, case-mismatch suggestions, reserved
filenames, and Unicode filename preservation.

Before release, CI should run on macOS, Linux, and Windows. P0 implementation
can start with local tests, but the test design should remain cross-platform
from the beginning.

## Build And Distribution

P0 should preserve a single-binary end-user experience while allowing a Rust and
WebApp development workflow.

Build inputs:

- Rust Cargo workspace.
- pnpm workspace for `packages/webapp` and `packages/shared`.
- `Cargo.lock` committed.
- `pnpm-lock.yaml` committed.
- `rust-toolchain.toml` to pin the Rust toolchain.
- `mise` tasks as the project-level entrypoint for check, test, format, and
  build commands.

Release builds should serve built WebApp static assets from the Rust binary or
release package. The preferred release mode is embedded assets so `forma serve`
does not require a separate frontend runtime or asset directory. Development
mode may serve local `packages/webapp/dist` assets or proxy a Vite dev server.
P0 exposes an explicit external asset directory override, such as
`forma serve --webapp-dir <dir>`, for development debugging and issue
verification. The override should affect only static asset resolution; RPC
behavior, workspace permissions, and shared workspace configuration should
remain unchanged. Broader custom distribution and white-label packaging remain
P1 concerns.
P0 also supports explicit `/rpc` CORS origins for Vite dev server workflows,
such as `forma serve --cors-origin http://localhost:5173` with
`VITE_FORMA_RPC_URL` pointing the WebApp to the Forma RPC endpoint. CORS should
be disabled by default and should not support wildcard origins.

P0 distribution should use:

- GitHub Releases with standalone binaries.
- `install.sh` for Unix-like systems.
- `install.ps1` for Windows PowerShell.
- Compatibility with mise's GitHub backend.
- Release checksums for downloaded artifacts.

Initial release targets should include macOS arm64, macOS x64, Linux x64, and
Windows x64. Package-manager-specific distribution such as Homebrew, Scoop,
Chocolatey, npm wrappers, system installers, or auto-updaters can wait until
product demand justifies them.

Use predictable release asset names:

```text
forma-linux-x64.tar.gz
forma-macos-arm64.tar.gz
forma-macos-x64.tar.gz
forma-windows-x64.zip
```

Each artifact should have a sibling `.sha256` checksum. Archives should place
the executable under `bin/forma` or `bin/forma.exe`. This keeps install scripts
simple and gives mise's GitHub backend enough stable naming information for
automatic or platform-specific asset matching.

## Extension Boundary

P0 should use a declarative-only extension model. It should not include a runtime
plugin system.

P0 should not support:

- Runtime plugin loading.
- Third-party executable hooks.
- Custom query scripts.
- Custom template functions.
- Custom schema validators as code.
- Editor extensions.
- MCP server.
- Desktop or mobile clients.

P0 should preserve future extension paths through:

- Declarative Starter Kits.
- Forma Schema DSL.
- Semantic types.
- Declarative views.
- Create templates with simple placeholders.
- The shared Forma operation/RPC model.
- Stable JSON outputs from CLI and local HTTP API.

Future adapters should extend through Forma RPC instead of duplicating core
behavior. Future runtime plugin capability, if added, must be explicitly
designed with trust, sandboxing, permissions, debugging, and compatibility
boundaries. P0 should not introduce DataviewJS-like trusted custom scripts,
arbitrary shell hooks, arbitrary JavaScript/Rust/WASM execution, or network
fetching plugins.

## Non-goals

- P0 does not build a full Markdown editor.
- P0 does not rewrite existing Markdown bodies.
- P0 does not require MCP or editor extensions.
- P0 does not commit to desktop or mobile clients.
- P0 does not persist diagnostic results.
- P0 does not provide a runtime code plugin system.

## Open Questions

- How should source positions survive placeholder expansion and embedded view
  rendering?
- Which Forma-specific markers must render to ordinary Markdown, HTML, and JSON
  in P0?

## Related Research

- [Forma Markdown Parser Spike Report](../workspace/Tiscs/research/forma-markdown-parser-spike-report.md)
