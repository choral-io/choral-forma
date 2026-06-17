---
scope: project
type: architecture
owners: []
tags:
    - architecture
    - forma
    - p0
    - indexing
    - diagnostics
---

# Forma P0 Check And Index Specification

## Context

Choral Forma P0 needs stable read, check, inspect, list, and serve behavior
over repository-backed Markdown. Repository files remain the source of truth.
The first public release does not use a committed summary index. `forma serve`,
CLI reads, and RPC operations scan source files and maintain an in-memory read
model.

This specification refines the P0 check/index pipeline described in
[../product/product-direction.md](../product/product-direction.md),
[forma-core-technical-direction.md](forma-core-technical-direction.md), and the
accepted decision
[../decisions/forma-p0-core-architecture.md](../decisions/forma-p0-core-architecture.md).

## Goals

- Define one shared pipeline for CLI commands, `forma serve`, and the shared RPC
  operation dispatcher.
- Define the default in-memory read-model contract.
- Keep diagnostics runtime-only and separate from source files.
- Define deterministic ordering for in-memory read-model projections.
- Define command behavior for P0 check, inspect, list, and serve commands.
- Define the P0 diagnostic JSON contract, diagnostic code families, and source
  location rules.
- Reserve `.forma/local/cache/` for future local-only rebuildable caches.

## Non-Goals

- No committed index file in the first public release.
- No local full index such as `.forma/local/index.json` in P0.
- No SQLite, filesystem watcher, vector index, or incremental indexing in P0.
- No persisted diagnostic result file, health summary, last check status, or
  effective configuration file.
- No automatic repair in `forma check`, `forma inspect`, `forma list`, or
  `forma serve`.
- No expansion of embedded Markdown content in P0. Embedded references are
  recorded as intent and may render as links or placeholders.

## Shared Pipeline

All P0 operations that need workspace understanding should use the same core
pipeline in `forma-core`, exposed through typed operations and the shared
dispatcher. CLI handlers and local HTTP handlers must not reimplement discovery,
diagnostic, reference, or index semantics.

Pipeline phases:

1. Load the `.forma.yml` configuration entry and resolve the configured
   workspace root.
2. Load optional included configuration files when `.forma.yml` references
   them.
3. Normalize all public paths to workspace-relative POSIX-style paths.
4. Discover candidate source files from configured page sources, taxonomy
   source rules, view definitions, and navigation/dashboard references.
5. Split Markdown frontmatter and body.
6. Parse YAML configuration and entry frontmatter.
7. Parse Markdown body into the chosen Markdown AST.
8. Enrich the parsed document into `FormaAST` by scanning wikilinks,
   Markdown links, Obsidian-style embeds, and Forma directives.
9. Classify pages into configured taxonomies and views.
10. Validate configuration, taxonomy membership, frontmatter schemas, view
    definitions, workspace view sources, and normalized-entry query targets.
11. Resolve references.
12. Build the in-memory read-model projection from successfully resolved
    discovery facts.
13. Build runtime diagnostics from configuration, parsing, schema, membership,
    references, view, template, create, runtime, and privacy checks.
14. Project the operation result for CLI JSON, human CLI output, local HTTP RPC,
    or WebApp consumption.

Read-model-producing operations use phases 1 through 12 and exclude diagnostics
from persisted artifacts by default. Check-producing operations use the same
discovery and parse facts, then return diagnostics from phase 13.

View source and query validation follows
[[architecture/forma-view-query-model]].

## In-Memory Read Model

P0 rebuilds the read model in memory by scanning source files and
configuration. Repository Markdown and `.forma.yml`-included configuration are
the only shared source of truth for discovery facts.

The read model includes deterministic, shared discovery facts:

- Workspace summary.
- Space summaries.
- Managed view summaries.
- Entry summaries.
- Successfully resolved references.

The read model must not persist:

- Diagnostics, check summaries, last check status, or health state.
- Effective configuration or local override results.
- Runtime identity, local paths, private local files, or user behavior traces.
- Absolute paths or platform-specific path separators.
- Full frontmatter, full Markdown bodies, rendered HTML, or rendered view
  results.
- Unresolved or ambiguous references.

Recommended P0 JSON shape:

```json
{
    "schemaVersion": 1,
    "workspace": {
        "name": "Acme Knowledge",
        "canonicalLanguage": "en",
        "supportedLanguages": ["en"]
    },
    "spaces": [
        {
            "id": "todos",
            "title": "Todos",
            "include": "todos/**/*.md",
            "entryCount": 1
        }
    ],
    "views": [
        {
            "id": "todos",
            "path": ".forma/views/todos.md",
            "surface": "page",
            "mode": "kanban",
            "space": "todos",
            "title": "Todos"
        },
        {
            "id": "knowledge-graph",
            "path": ".forma/views/knowledge-graph.md",
            "surface": "page",
            "mode": "graph",
            "title": "Knowledge Graph",
            "source": {
                "kind": "workspace",
                "include": ["**/*.md"],
                "exclude": [".forma/**", "**/local/**"]
            }
        }
    ],
    "entries": [
        {
            "path": "todos/user-registration.md",
            "space": "todos",
            "kind": "todo",
            "title": "User registration",
            "summary": "Implement user registration flow.",
            "refs": [
                {
                    "source": "frontmatter",
                    "field": "assignees",
                    "targetPath": "users/tiscs.md",
                    "semanticType": "user",
                    "intent": "reference"
                },
                {
                    "source": "body",
                    "targetPath": "notes/account-model.md",
                    "semanticType": "note",
                    "intent": "link"
                },
                {
                    "source": "body",
                    "targetPath": "notes/project-brief.md",
                    "semanticType": "note",
                    "intent": "embed"
                }
            ]
        }
    ]
}
```

### Reference Intent

Index references must distinguish intent:

- `reference`: structured metadata or configuration reference, usually from
  frontmatter or `.forma/*.yml`.
- `link`: body Markdown link or ordinary wikilink that points to another
  workspace object.
- `embed`: Obsidian-style embedded reference such as
  `![[notes/project-brief]]`.

P0 validates embed targets like ordinary references and records
`intent: "embed"` when resolved. P0 does not expand embedded content into the
index, rendered HTML, or exported Markdown.

## Deterministic Sorting

Read-model projections must be deterministic for unchanged workspace inputs.
Determinism keeps CLI/RPC output stable for Agents, reviews, and tests.

Sorting rules:

- Serialize JSON with stable object field order defined by the public schema,
  not by map iteration order.
- Preserve `workspace.supportedLanguages` in configuration order because the
  order may carry display preference.
- Sort `spaces` by `id`.
- Sort `views` by `path`, then `id`.
- Sort `entries` by `path`.
- Sort `entries[].refs` by `intent`, then `targetPath`, then `source`, then
  `field` when present, then source location when available.
- Sort any future schema-owned arrays with documented semantics. If order has
  no semantic meaning, sort deterministically before returning the projection.
- Use workspace-relative POSIX paths exactly as public identity strings. Do not
  case-fold paths, expand symlinks into absolute paths, or apply Unicode
  normalization for public identity.

Serialized operation output should use stable field ordering where the public
schema defines it. It should avoid timestamps, host-specific values, random ids,
and filesystem traversal order as output inputs.

## Runtime Diagnostics

Diagnostics are runtime operation results. They are recomputed by `forma check`,
`forma serve`, `forma inspect`, `forma list`, or the shared RPC dispatcher as
needed.

Diagnostics must not be persisted as a separate diagnostics result file. Future
implementation caches may accelerate diagnostic computation, but cached data is
local-only, rebuildable, and not a product fact.

### Diagnostic JSON

Recommended P0 check JSON shape:

```json
{
    "status": "failed",
    "summary": {
        "errors": 1,
        "warnings": 2,
        "infos": 0
    },
    "diagnostics": [
        {
            "severity": "error",
            "code": "ref.unresolved",
            "message": "Reference cannot be resolved.",
            "path": "todos/user-registration.md",
            "location": {
                "kind": "frontmatter",
                "field": "assignees",
                "index": 0
            },
            "actual": "[[users/tics]]",
            "expected": {
                "type": "ref",
                "target": "user"
            },
            "suggestions": [
                {
                    "label": "Use users/tiscs",
                    "value": "[[users/tiscs]]"
                }
            ]
        }
    ]
}
```

Required diagnostic fields:

- `severity`: `error`, `warning`, or `info`.
- `code`: stable machine-readable code.
- `message`: concise human-readable explanation.
- `path`: workspace-relative POSIX path for the most relevant source file.
- `location`: structured source location when available.

Optional diagnostic fields:

- `actual`: observed value or concise observed state.
- `expected`: expected type, target, value shape, or invariant.
- `suggestions`: advisory labels and values. Suggestions are not patches in P0.

P0 status values:

- `passed`: no errors or warnings.
- `warning`: warnings but no errors.
- `failed`: at least one error.

Warnings should not cause a non-zero CLI exit code in P0. Errors should cause a
non-zero CLI exit code for check operations. A required runtime value that
cannot resolve should be a warning unless it blocks the specific operation.

### Diagnostic Codes

P0 diagnostic code families:

- `config.*`
- `runtime.*`
- `space.*`
- `schema.*`
- `entry.*`
- `ref.*`
- `resource.*`
- `view.*`
- `template.*`
- `create.*`
- `index.*`
- `privacy.*`

Initial concrete codes should use the narrowest stable family available, for
example:

- `config.parse`
- `config.unknown-field`
- `space.multiple-match`
- `space.no-match`
- `schema.invalid`
- `entry.frontmatter-parse`
- `ref.unresolved`
- `ref.ambiguous`
- `ref.case-mismatch`
- `resource.description.missingTarget`
- `view.invalid`
- `privacy.local-leak`

Codes are public Script, Agent, and GUI contract. Rename a code only with an
explicit compatibility decision.

`resource.description.missingTarget` reports a Markdown resource description
document such as `assets/logo.png.md` whose filename-derived target resource
such as `assets/logo.png` is missing. The diagnostic path is the description
document path and the expected value is the missing target path.

### Location Rules

Diagnostic locations should be structured rather than embedded in message text.
All paths in diagnostics must be workspace-relative POSIX paths.

P0 location kinds:

- `config`: location in a `.forma/*.yml` configuration file.
- `frontmatter`: location in entry or view frontmatter.
- `body`: location in Markdown body.
- `file`: whole-file diagnostic.
- `workspace`: workspace-level diagnostic with no narrower file location.

Recommended location shapes:

```json
{
    "kind": "config",
    "pointer": "/spaces/todos/include"
}
```

```json
{
    "kind": "frontmatter",
    "field": "assignees",
    "index": 0
}
```

```json
{
    "kind": "body",
    "start": { "line": 12, "column": 4 },
    "end": { "line": 12, "column": 27 }
}
```

```json
{
    "kind": "file"
}
```

Line and column numbers are one-based. `end` points to the first position after
the diagnostic span when the parser can provide that precision. If source
positions are unavailable, use the narrowest available field, file, or
workspace location instead of inventing offsets.

## Command Behavior

All JSON output should be stable and schema-versioned where it represents a
public operation result. Human output should be concise and should explain the
next useful command when a stale index or fixable issue is found.

### `forma check [--json]`

`forma check` is the default read-only workspace health operation. It recomputes
runtime diagnostics from a fresh scan.

Behavior:

- Read-only.
- Runs diagnostics over shared configuration, space membership, schemas,
  entries, references, views, templates where relevant, and privacy boundaries.
- Does not write repairs, caches, local results, or a persistent index.
- Returns zero for `passed` and `warning`; returns non-zero for `failed`.

### `forma serve`

`forma serve` starts a local HTTP server bound to localhost by default. It serves
the read-only WebApp static assets and exposes RPC-over-HTTP endpoints backed by
the shared dispatcher.

Behavior:

- Read-only in P0.
- May compute diagnostics and check status in memory.
- Exposes workspace overview, space listing, entry inspection, Markdown
  rendering, view rendering, and diagnostics through the local API.
- Does not persist diagnostics or create local caches in P0.
- Keeps workspace diagnostics as operation results, not JSON-RPC transport
  errors.

### `forma inspect <path> [--json]`

`forma inspect` reads one entry by workspace-relative path locator, with `.md`
optional where unambiguous.

Behavior:

- Read-only.
- Resolves the locator using workspace-relative POSIX path rules.
- Parses and returns entry metadata summary, body-derived outline, resolved
  references, space membership, and target-specific diagnostics where
  applicable.
- Should inspect imperfect files when possible and include diagnostics instead
  of failing early for every workspace issue.
- Does not persist diagnostics or runtime read-model results.

### `forma inspect --space <space> <entry> [--json]`

Space-scoped inspect resolves `<entry>` as a file basename without `.md`
inside the space's include/exclude result.

Behavior:

- Read-only.
- No-match and multiple-match cases are operation errors or diagnostics with
  suggestions to use a path locator or create a new entry.
- Space-backed type normalization may apply to bare entry names when such a
  type exists.
- Path-like locators remain exact and are not normalized.
- Does not persist diagnostics or runtime read-model results.

### `forma list --space <space> [--json]`

`forma list` returns entries for one space.

Behavior:

- Read-only.
- Uses the shared discovery and space-classification pipeline.
- Returns deterministic entry ordering by workspace-relative `path`.
- Includes the space id, entry count, and entry summaries.
- May include relevant space-level diagnostics in JSON output.
- Does not persist diagnostics or runtime read-model results.

## Cache Rules

P0 does not create or depend on implementation caches.

Future caches, if needed for check speed, parsing speed, diagnostics, rendering,
watcher state, local full indexes, or GUI responsiveness, must live under:

```text
.forma/local/cache/
```

Future cache rules:

- Local-only and ignored by git.
- Rebuildable from source files, shared configuration, and optional local
  overrides.
- Never treated as product facts or public Script, Agent, CLI, or RPC
  interfaces.
- Never required for correctness.
- Never committed.
- Safe to delete at any time.
- Must not leak into diagnostics paths or public JSON output as host-specific
  source paths.

## Related Decisions

- [../decisions/forma-p0-core-architecture.md](../decisions/forma-p0-core-architecture.md)
