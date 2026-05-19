---
scope: project
type: architecture
owners:
  - "[[groups/default-team]]"
tags:
  - architecture
  - forma
  - api
  - cli
  - p0
---

# Forma P0 Operation API Spec

## Context

Choral Forma P0 uses a shared operation model for CLI commands, the local HTTP
API, and future adapters. CLI and HTTP adapters must call the same operation
dispatcher instead of reimplementing product behavior.

The P0 product surface is a single `forma` binary with CLI commands and
`forma serve`, which serves a read-only local WebApp and exposes strict minimal
JSON-RPC 2.0 over HTTP. CLI `--json` output and HTTP RPC results should share
the same JSON-compatible operation result shapes.

## Goals

- Define the P0 operation names and their CLI command mappings.
- Define stable direct JSON result behavior for CLI `--json`.
- Define the minimal strict JSON-RPC 2.0 HTTP shape for `POST /rpc`.
- Require `schemaVersion` on operation results.
- Distinguish workspace diagnostics from transport or protocol errors.
- Outline P0 operation result shapes for check, config inspection, index
  rebuild/check, inspect, list, create, and view rendering.

## Non-Goals

- P0 does not design or implement MCP.
- P0 does not include JSON-RPC batch requests, notifications, subscriptions,
  server push, or stdio JSON-RPC.
- P0 does not include structured edit operations such as `set`, `add`,
  `remove`, or `unset`.
- P0 does not define full schema details for every configuration, collection,
  entry, view, or rendered Markdown object.
- P0 does not persist diagnostics, rendered views, effective configuration, or
  check summaries.

## Operation Model

P0 operations are product-semantic actions exposed through adapters. Operation
names use stable lower camel case in JSON-facing APIs.

| Operation     | JSON method       | Primary CLI command                                      | Writes files |
| ------------- | ----------------- | -------------------------------------------------------- | ------------ |
| Init          | `init`            | `forma init [--name <name>] [--language <tag>]`          | Yes          |
| ConfigInspect | `config.inspect`  | `forma config inspect [--path <path>] [--json]`          | No           |
| IndexRebuild  | `index.rebuild`   | `forma index rebuild [--json]`                           | Yes          |
| IndexCheck    | `index.check`     | `forma index check [--json]`                             | No           |
| Check         | `check`           | `forma check [--json]`                                   | No           |
| Inspect       | `inspect`         | `forma inspect <path> [--json]`                          | No           |
| Inspect       | `inspect`         | `forma inspect --collection <collection> <entry> --json` | No           |
| List          | `list`            | `forma list --collection <collection> [--json]`          | No           |
| Create        | `create`          | `forma create <collection> [--json]`                     | Yes          |
| ViewRender    | `view.render`     | No required P0 CLI command                               | No           |
| EntryRender   | `entry.render`    | No required P0 CLI command                               | No           |
| Serve         | Local server mode | `forma serve`                                            | No           |

`Serve` is a CLI mode, not a domain operation. The server exposes operation
methods through `POST /rpc` and serves static WebApp assets. It may compute
diagnostics in memory and expose check/index status through operation results,
but it must not write files in P0.

`ViewRender` is required for the P0 WebApp and local HTTP API so the GUI can
render page, list, table, and kanban views. A direct CLI command for view
rendering can wait until there is product demand.

`EntryRender` is required for the P0 WebApp and local HTTP API so the GUI can
render individual Markdown entries without reading files directly. A direct CLI
command for entry rendering can wait until there is product demand.

## CLI JSON Behavior

CLI `--json` writes the direct operation result to stdout. It must not wrap the
result in a JSON-RPC envelope.

Every CLI JSON result must be:

- A single valid JSON object.
- Stable enough for scripts, Agents, tests, and the WebApp shared types.
- Free of absolute host paths, platform-specific path separators, mtimes,
  hashes, runtime-local cache paths, private local files, and user behavior
  traces.
- Versioned with top-level `schemaVersion`.

Recommended top-level shape:

```json
{
  "schemaVersion": 1,
  "operation": "check",
  "status": "failed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "diagnostics": []
}
```

`workspace.root` must be a display-safe workspace locator, not an absolute host
path. Public paths inside results must be workspace-relative POSIX paths.

Human-oriented CLI output can be concise and non-JSON. JSON output is the
contract surface.

## JSON-RPC HTTP Shape

`forma serve` exposes a strict minimal JSON-RPC 2.0 endpoint:

```text
POST /rpc
Content-Type: application/json
```

Request:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "check",
  "params": {}
}
```

Success response:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "schemaVersion": 1,
    "operation": "check",
    "status": "passed",
    "summary": {
      "errors": 0,
      "warnings": 0,
      "infos": 0
    },
    "diagnostics": []
  }
}
```

Error response:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "error": {
    "code": -32602,
    "message": "Invalid params.",
    "data": {
      "code": "params.invalid",
      "details": []
    }
  }
}
```

P0 supports only a single request object. It must reject batch arrays and
notifications. `id` is required. `method` must be one of the P0 JSON method
names. `params` should be an object; omit or use `{}` for operations with no
parameters.

Use standard JSON-RPC codes where applicable:

| Code     | Meaning          | P0 use                                                         |
| -------- | ---------------- | -------------------------------------------------------------- |
| `-32700` | Parse error      | Invalid JSON request body                                      |
| `-32600` | Invalid request  | Missing `jsonrpc`, `id`, `method`, batch request, notification |
| `-32601` | Method not found | Unknown operation method                                       |
| `-32602` | Invalid params   | Params fail operation input schema or path validation          |
| `-32603` | Internal error   | Unexpected implementation failure                              |

Forma-specific machine codes belong in `error.data.code`, such as
`workspace.inaccessible`, `path.outsideWorkspace`, `params.invalid`, or
`operation.failed`.

HTTP status should describe transport-level handling. Valid JSON-RPC request
bodies that reach the dispatcher should normally return an HTTP success status
with either `result` or JSON-RPC `error`.

## Diagnostics And Errors

Workspace diagnostics are operation results. They are not JSON-RPC transport
errors and should not be persisted.

Examples of diagnostics-as-result:

- Invalid collection membership.
- Invalid frontmatter against a collection schema.
- Unresolved or ambiguous references.
- Unknown configuration fields that leave the workspace inspectable.
- Missing or stale `.forma/index.summary.json`.
- Invalid views, missing fields, invalid params, or overlapping kanban columns.
- Required runtime values that are unresolved but do not block the operation.

Examples of transport, protocol, dispatch, or execution errors:

- Invalid JSON.
- Invalid JSON-RPC envelope.
- Unknown operation method.
- Invalid operation params.
- Workspace root cannot be accessed.
- Requested path is absolute or traverses outside the workspace.
- `create` or `index.rebuild` cannot write its target file.
- Unexpected internal failure.

Diagnostic severity values:

```text
error
warning
info
```

Operation status values:

```text
passed
warning
failed
```

`passed` means no errors or warnings. `warning` means warnings but no errors.
`failed` means at least one error. For CLI exit codes, warnings should not cause
a non-zero exit code in P0; errors should.

Diagnostic object outline:

```json
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
```

Suggestions are advisory only and should not include patches in P0.

## Common Result Fields

All P0 operation results should use this common base:

```json
{
  "schemaVersion": 1,
  "operation": "operation.name",
  "status": "passed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  }
}
```

Operations that evaluate workspace health include:

```json
{
  "summary": {
    "errors": 0,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": []
}
```

All public paths are workspace-relative POSIX paths. Absolute paths are internal
implementation details and must not appear in CLI JSON, RPC results, committed
index files, diagnostics, or configuration references.

## Operation Result Outlines

### Init

`init` creates the P0 minimal starter, `.forma/.gitignore` rules for local-only
Forma files, and an initial `.forma/index.summary.json`. It fails if `.forma/`
already exists.

Params:

```json
{
  "name": "Acme Knowledge",
  "language": "en"
}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "init",
  "status": "passed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "created": [
    ".forma/workspace.yml",
    ".forma/collections.yml",
    ".forma/types.yml",
    ".forma/views/todos.md",
    ".forma/templates/todo.md",
    ".forma/index.summary.json"
  ],
  "summary": {
    "errors": 0,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": []
}
```

### Check

`check` recomputes runtime diagnostics, includes summary index freshness, and
writes nothing.

Params:

```json
{}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "check",
  "status": "failed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "summary": {
    "errors": 1,
    "warnings": 2,
    "infos": 0
  },
  "checks": {
    "config": "passed",
    "collections": "warning",
    "entries": "failed",
    "references": "failed",
    "views": "passed",
    "index": "failed"
  },
  "diagnostics": []
}
```

### Config Inspect

`config.inspect` returns effective inspectable configuration. It may include
configuration diagnostics, but it should still return a result when imperfect
configuration can be parsed enough to inspect. Effective configuration is not
persisted.

Params:

```json
{
  "path": ".forma/collections.yml"
}
```

`path` is optional and narrows the inspection to a workspace-relative
configuration path.

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "config.inspect",
  "status": "warning",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "config": {
    "workspace": {},
    "types": {},
    "collections": [],
    "views": [],
    "runtime": {}
  },
  "sources": [
    {
      "path": ".forma/workspace.yml",
      "kind": "shared"
    },
    {
      "path": ".forma/overrides/local.yml",
      "kind": "local",
      "present": false
    }
  ],
  "runtimeValues": [
    {
      "name": "currentUserId",
      "status": "resolved",
      "source": ".forma/workspace.yml"
    }
  ],
  "summary": {
    "errors": 0,
    "warnings": 1,
    "infos": 0
  },
  "diagnostics": []
}
```

### Index Rebuild

`index.rebuild` full-scans shared source files and shared configuration, then
rewrites `.forma/index.summary.json`. It does not persist diagnostics.

Params:

```json
{}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "index.rebuild",
  "status": "passed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "index": {
    "path": ".forma/index.summary.json",
    "schemaVersion": 1,
    "collections": 4,
    "views": 4,
    "entries": 12,
    "refs": 18,
    "written": true
  },
  "summary": {
    "errors": 0,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": []
}
```

### Index Check

`index.check` regenerates the expected summary index in memory, compares it to
`.forma/index.summary.json`, emits runtime diagnostics, and writes nothing.

Params:

```json
{}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "index.check",
  "status": "failed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "index": {
    "path": ".forma/index.summary.json",
    "present": true,
    "fresh": false,
    "expectedSchemaVersion": 1,
    "actualSchemaVersion": 1
  },
  "summary": {
    "errors": 1,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": [
    {
      "severity": "error",
      "code": "index.stale",
      "message": "Summary index is stale.",
      "path": ".forma/index.summary.json",
      "suggestions": [
        {
          "label": "Rebuild summary index",
          "command": "forma index rebuild"
        }
      ]
    }
  ]
}
```

### Inspect

`inspect` reads one entry by workspace-relative path or collection-scoped
locator. It returns metadata, body-derived structure, references, collection
membership, and diagnostics for that entry. It writes nothing.

Params by path:

```json
{
  "path": "todos/user-registration.md"
}
```

Params by collection locator:

```json
{
  "collection": "todos",
  "entry": "user-registration"
}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "inspect",
  "status": "passed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "entry": {
    "path": "todos/user-registration.md",
    "collection": "todos",
    "kind": "todo",
    "title": "User registration",
    "summary": "Implement user registration flow.",
    "metadata": {},
    "headings": [],
    "refs": [],
    "embeds": [],
    "renderable": true
  },
  "summary": {
    "errors": 0,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": []
}
```

`metadata` may contain user-authored frontmatter values. It should not include
absolute paths or internal parser state.

### List

`list` returns entries in one collection. P0 list behavior should remain
collection-scoped rather than becoming a general query language.

Params:

```json
{
  "collection": "todos"
}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "list",
  "status": "passed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "collection": {
    "id": "todos",
    "title": "Todos",
    "include": "todos/**/*.md"
  },
  "entries": [
    {
      "path": "todos/user-registration.md",
      "kind": "todo",
      "title": "User registration",
      "summary": "Implement user registration flow.",
      "fields": {}
    }
  ],
  "summary": {
    "errors": 0,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": []
}
```

`fields` should contain display-safe structured values derived from the
collection schema and conventions. It should not expose full Markdown bodies.

### Create

`create` resolves collection create inputs, renders the filename and template,
validates the generated entry, writes one file, and reports that the summary
index is stale without rebuilding it automatically.

Params:

```json
{
  "collection": "todos",
  "inputs": {
    "title": "Draft reference model"
  }
}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "create",
  "status": "warning",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "created": {
    "path": "todos/draft-reference-model.md",
    "collection": "todos",
    "template": ".forma/templates/todo.md"
  },
  "inputs": {
    "title": {
      "source": "explicit",
      "value": "Draft reference model"
    },
    "slug": {
      "source": "default",
      "value": "draft-reference-model",
      "transform": "slugify"
    }
  },
  "index": {
    "stale": true,
    "suggestedCommand": "forma index rebuild"
  },
  "summary": {
    "errors": 0,
    "warnings": 1,
    "infos": 0
  },
  "diagnostics": [
    {
      "severity": "warning",
      "code": "index.stale",
      "message": "Summary index is stale after creating an entry.",
      "path": ".forma/index.summary.json",
      "suggestions": [
        {
          "label": "Rebuild summary index",
          "command": "forma index rebuild"
        }
      ]
    }
  ]
}
```

Path conflicts, invalid create inputs, invalid generated paths, invalid
generated entries, and failed writes are operation failures. Invalid workspace
diagnostics that do not block creation may be returned as diagnostics.

### View Render

`view.render` renders one declarative view for the local WebApp and HTTP API.
It evaluates view parameters, collection schema references, query definitions,
sort definitions, display fields, table fields, kanban columns, and render
mounts. It writes nothing and does not persist rendered view results.

Params:

```json
{
  "view": "todos",
  "params": {}
}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "view.render",
  "status": "passed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "view": {
    "id": "todos",
    "path": ".forma/views/todos.md",
    "surface": "page",
    "mode": "kanban",
    "title": "Todos",
    "collection": "todos",
    "params": {}
  },
  "render": {
    "kind": "kanban",
    "items": [],
    "columns": []
  },
  "summary": {
    "errors": 0,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": []
}
```

For a Markdown entry render needed by the WebApp, `inspect` can return the
entry structure, while `entry.render` owns HTML or Markdown render output.
Keeping rendered output separate avoids making `inspect` return full rendered
content for scripts that only need metadata, outline, references, or
diagnostics.

### Entry Render

`entry.render` renders one Markdown entry for the local WebApp and HTTP API. It
uses the same parsing, reference, FormaAST, and diagnostic pipeline as
`inspect`. It writes nothing and does not persist rendered output.

Params:

```json
{
  "path": "todos/user-registration.md",
  "format": "html"
}
```

Result outline:

```json
{
  "schemaVersion": 1,
  "operation": "entry.render",
  "status": "passed",
  "workspace": {
    "root": ".",
    "name": "Acme Knowledge"
  },
  "entry": {
    "path": "todos/user-registration.md",
    "collection": "todos",
    "kind": "todo",
    "title": "User registration"
  },
  "render": {
    "format": "html",
    "html": "<h1>User registration</h1>",
    "refs": []
  },
  "summary": {
    "errors": 0,
    "warnings": 0,
    "infos": 0
  },
  "diagnostics": []
}
```

P0 should support `format: "html"` for the WebApp. Markdown export can be
added later as a compatibility target when transclusion, view embedding, or
Forma-specific render directives make it useful.

## Serve API

`forma serve` should bind to localhost by default, serve built WebApp static
assets, and expose:

```text
POST /rpc
```

The WebApp should use `POST /rpc` for workspace overview, collection listing,
entry inspection, Markdown rendering data, view rendering, diagnostics, and
index status. P0 should avoid adding parallel REST endpoints for the same
operation semantics.

Future convenience endpoints for static assets, health, or development-mode
frontend integration must not bypass the shared dispatcher for product
operations.

## Path And Privacy Rules

- Public paths use workspace-relative POSIX strings.
- Absolute paths and `..` traversal are rejected in operation params unless the
  command explicitly accepts the workspace root.
- Windows-style CLI path separators may be accepted and normalized.
- Path identity remains case-sensitive.
- Diagnostics may suggest case-correct candidates but must not silently resolve
  references case-insensitively.
- Public results must not include local-only cache paths, private local files,
  local override values that are not needed to explain effective config, or
  user behavior traces.

## Related Decisions

- [Forma P0 Core Architecture](../decisions/forma-p0-core-architecture.md)
- [Forma core technical direction](forma-core-technical-direction.md)
- [Product direction](../product/product-direction.md)

## Resolved P0 Questions

- `index.rebuild --json` is part of P0.
- The WebApp landing view should compose existing operations instead of adding
  a separate `workspace.inspect` operation.
- Individual entry rendering is handled by `entry.render`.
