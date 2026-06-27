---
scope: project
type: architecture
owners:
    - "members/tiscs"
tags:
    - architecture
    - forma
    - api
    - cli
    - p0
---

# Forma P0 Operation API Spec

## Context

Choral Forma P0 uses a shared operation model for CLI commands, the local HTTP API, and future adapters. CLI and HTTP adapters must call the same operation dispatcher instead of reimplementing product behavior.

The P0 product surface is a single `forma` binary with CLI commands and `forma serve`, which serves a read-only local WebApp and exposes strict minimal JSON-RPC 2.0 over HTTP. CLI `--json` output and HTTP RPC results should share the same JSON-compatible operation result shapes.

## Goals

- Define the P0 operation names and their CLI command mappings.
- Define stable direct JSON result behavior for CLI `--json`.
- Define the minimal strict JSON-RPC 2.0 HTTP shape for `POST /rpc`.
- Require `schemaVersion` on operation results.
- Distinguish workspace diagnostics from transport or protocol errors.
- Outline P0 operation result shapes for check, config inspection, index rebuild/check, inspect, list, create, and view rendering.

## Non-Goals

- P0 does not design or implement MCP.
- P0 does not include JSON-RPC batch requests, notifications, subscriptions, server push, or stdio JSON-RPC.
- P0 does not include structured edit operations such as `set`, `add`, `remove`, or `unset`.
- P0 does not define full schema details for every configuration, space, entry, view, or rendered Markdown object.
- P0 does not persist diagnostics, rendered views, effective configuration, or check summaries.

## Operation Model

P0 operations are product-semantic actions exposed through adapters. Operation names use stable lower camel case in JSON-facing APIs.

| Operation | JSON method | Primary CLI command | Writes files |
| --- | --- | --- | --- |
| ConfigInspect | `config.inspect` | `forma config inspect [--path <path>] [--json]` | No |
| Check | `check` | `forma check [--json]` | No |
| Inspect | `inspect` | `forma inspect <path> [--json]` | No |
| Inspect | `inspect` | `forma inspect --space <space> <entry> --json` | No |
| List | `list` | `forma list --space <space> [--json]` | No |
| FilesList | `files.list` | No required P0 CLI command | No |
| WorkspaceDashboard | `workspace.dashboard` | No required P0 CLI command | No |
| FileRender | `file.render` | No required P0 CLI command | No |
| FileReferences | `file.references` | No required P0 CLI command | No |
| WorkspaceHealth | `workspace.health` | `forma workspace health [--json]` | No |
| SkillsList | `skills.list` | `forma skills list [--json]` | No |
| SkillsGet | `skills.get` | `forma skills get <id> [--json]` | No |
| Init | `init` | `forma init [--name <name>] [--language <tag>] [--timezone <tz>] [--json]` | Yes |
| Create | `create` | `forma create <space> [--input <name=value>]... [--json]` | Yes |
| ViewRender | `view.render` | `forma view render <view-id-or-path> [--json]` | No |
| Serve | Local server mode | `forma serve [--webapp-dir <dir>] [--cors-origin <origin>]...` | No |

`Serve` is a CLI mode, not a domain operation. The server exposes operation methods through `POST /rpc` and serves static WebApp assets. It may compute diagnostics in memory and expose check status through operation results, but it must not write files in P0.

`forma docs list` and `forma docs get <id>` are local CLI documentation surfaces over embedded product docs. They are not workspace operations and do not require JSON-RPC methods in P0.

`Init` is a bootstrap operation. In P0 it writes only `.forma.md` and `.agents/skills/forma-cli/SKILL.md`, and it must refuse to overwrite existing target files. It does not install starter-kit content or infer a knowledge structure.

`ViewRender` is required for the P0 WebApp and local HTTP API so the GUI can render page, table, and kanban views. View metadata should also allow graph views to be discovered even when P0 does not yet render an interactive graph. A direct CLI command for view rendering can wait until there is product demand.

`FileRender` is required for the P0 WebApp and local HTTP API so the GUI can render individual workspace files without reading files directly. A direct CLI command for file rendering can wait until there is product demand.

`FilesList` is required for the P0 WebApp file navigation mode. It is a read-only inventory operation over display-safe workspace files, not a general filesystem API. It should classify knowledge files, views, Markdown files, configuration files, and resources using workspace-relative POSIX paths.

`FileReferences` is required for the read-only bidirectional note navigation baseline. It is a read-only operation for one indexed knowledge file. It returns outgoing references from that file plus backlinks from other indexed knowledge files, using resolved reference data from the in-memory read model. It should include display-safe source and target paths, available titles, reference source, optional field and semantic type, and intent `reference | link | embed`. It should not scan raw Markdown in the WebApp, persist relationship results, or expose absolute host paths. A direct CLI command can wait until there is script demand.

`entry.render` and `references.list` are not part of the P0 API. The project is still early enough that callers should migrate directly to `file.render` and `file.references` instead of relying on compatibility aliases.

## CLI JSON Behavior

CLI `--json` writes the direct operation result to stdout. It must not wrap the result in a JSON-RPC envelope.

Every CLI JSON result must be:

- A single valid JSON object.
- Stable enough for scripts, Agents, tests, and the WebApp shared types.
- Free of absolute host paths, platform-specific path separators, mtimes, hashes, runtime-local cache paths, private local files, and user behavior traces.
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

The JSON result field `workspace.root` must be a display-safe workspace locator, not an absolute host path or a `.forma.md` config field. Public paths inside results must be workspace-relative POSIX paths.

Human-oriented CLI output can be concise and non-JSON. JSON output is the contract surface.

## CLI Confirmation Policy

CLI adapters should gate write operations by risk and predictability.

- Read-only commands never require confirmation.
- Single-file, predictable, non-destructive writes do not require confirmation when they already fail on path conflicts or invalid inputs.
- Initialization, physical deletion, path moves or renames that change references, automatic fixes, batch updates, and operations that write multiple files or update references require confirmation.
- Confirmation-required commands must fail without writing in non-interactive shells unless the caller passes `-y` or `--yes`.
- Confirmation-required commands should provide a dry-run or plan mode when the operation can produce a meaningful plan before writing.

P0 command classification:

- Bootstrap-only `forma init` may proceed without confirmation when target paths do not exist because it writes a small, predictable set of files and refuses overwrites.
- Future starter-kit installation should require confirmation because it creates broader workspace structure and configuration.
- `forma create` does not require confirmation in P0 because it writes one new entry, uses space-defined inputs and templates, and fails on path conflicts.
- `forma refresh` or an equivalent in-memory read-model rebuild operation does not require confirmation because it writes nothing by default.
- `forma check`, `forma config inspect`, `forma inspect`, `forma list`, and `forma serve` do not require confirmation because they are read-only in P0.
- `forma config inspect --path <path>` may inspect only known configuration source files reported by the operation, starting with `.forma.md` and any explicitly included configuration files. It is not a general workspace file read API.

Future command classification:

- `forma delete`, `forma move`, multi-file `rename`, batch metadata updates, automatic `fix` apply operations, and commands that rewrite references should require confirmation.
- `forma set`, `forma add`, `forma remove`, and `forma unset` can avoid confirmation for one-file field edits, but should require confirmation for batch, multi-file, or reference-changing modes.
- `forma deprecate` can avoid confirmation when it only adds or updates an explicit frontmatter marker on one file, but should require confirmation for batch, multi-file, view-changing, or reference-changing modes.

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

P0 supports only a single request object. It must reject batch arrays and notifications. `id` is required. `method` must be one of the P0 JSON method names. `params` should be an object; omit or use `{}` for operations with no parameters.

Use standard JSON-RPC codes where applicable:

| Code     | Meaning          | P0 use                                                         |
| -------- | ---------------- | -------------------------------------------------------------- |
| `-32700` | Parse error      | Invalid JSON request body                                      |
| `-32600` | Invalid request  | Missing `jsonrpc`, `id`, `method`, batch request, notification |
| `-32601` | Method not found | Unknown operation method                                       |
| `-32602` | Invalid params   | Params fail operation input schema or path validation          |
| `-32603` | Internal error   | Unexpected implementation failure                              |

Forma-specific machine codes belong in `error.data.code`, such as `workspace.inaccessible`, `path.outsideWorkspace`, `params.invalid`, or `operation.failed`.

HTTP status should describe transport-level handling. Valid JSON-RPC request bodies that reach the dispatcher should normally return an HTTP success status with either `result` or JSON-RPC `error`.

## Diagnostics And Errors

Workspace diagnostics are operation results. They are not JSON-RPC transport errors and should not be persisted.

Examples of diagnostics-as-result:

- Invalid space membership.
- Invalid frontmatter against a space schema.
- Unresolved or ambiguous references.
- Missing resource targets for Markdown resource description documents.
- Unknown configuration fields that leave the workspace inspectable.
- Invalid views, missing fields, invalid params, or overlapping kanban columns.
- Required runtime values that are unresolved but do not block the operation.

Examples of transport, protocol, dispatch, or execution errors:

- Invalid JSON.
- Invalid JSON-RPC envelope.
- Unknown operation method.
- Invalid operation params.
- Workspace root cannot be accessed.
- Requested path is absolute or traverses outside the workspace.
- `create` cannot write its target file.
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

`passed` means no errors or warnings. `warning` means warnings but no errors. `failed` means at least one error. For CLI exit codes, warnings should not cause a non-zero exit code in P0; errors should.

Diagnostic object outline:

```json
{
    "severity": "error",
    "code": "ref.unresolved",
    "message": "Reference cannot be resolved.",
    "path": "tasks/user-registration.md",
    "location": {
        "kind": "frontmatter",
        "field": "assignees",
        "index": 0
    },
    "actual": "[[members/tics]]",
    "expected": {
        "type": "ref",
        "target": "member"
    },
    "suggestions": [
        {
            "label": "Use members/alex-chen",
            "value": "members/alex-chen"
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

All public paths are workspace-relative POSIX paths. Absolute paths are internal implementation details and must not appear in CLI JSON, RPC results, committed index files, diagnostics, or configuration references.

## Operation Result Outlines

### Check

`check` recomputes runtime diagnostics from a fresh source scan and writes nothing.

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
        "spaces": "warning",
        "entries": "failed",
        "references": "failed",
        "views": "passed",
        "readModel": "failed"
    },
    "diagnostics": []
}
```

### Config Inspect

`config.inspect` returns effective inspectable configuration. It may include configuration diagnostics, but it should still return a result when imperfect configuration can be parsed enough to inspect. Effective configuration is not persisted.

Params:

```json
{
    "path": ".forma.md"
}
```

`path` is optional and narrows the inspection to a workspace-relative configuration path.

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
        "dashboard": {},
        "taxonomies": {},
        "spaces": {},
        "types": {},
        "runtime": {}
    },
    "sources": [
        {
            "path": ".forma.md",
            "kind": "shared"
        },
        {
            "path": "local/profile-selection.yml",
            "kind": "local",
            "present": true
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

### Inspect

`inspect` reads one entry by workspace-relative path or space-scoped locator. It returns metadata, body-derived structure, references, space membership, and diagnostics for that entry. It writes nothing.

Params by path:

```json
{
    "path": "tasks/user-registration.md"
}
```

Params by space locator:

```json
{
    "space": "tasks",
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
    "file": {
        "path": "tasks/user-registration.md",
        "space": "tasks",
        "kind": "task",
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

`metadata` may contain user-authored frontmatter values. It should not include absolute paths or internal parser state.

### List

`list` returns entries in one space. P0 list behavior should remain space-scoped rather than becoming a general query language.

Params:

```json
{
    "space": "tasks"
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
    "space": {
        "id": "tasks",
        "title": "Tasks",
        "include": "tasks/**/*.md"
    },
    "entries": [
        {
            "path": "tasks/user-registration.md",
            "kind": "task",
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

`fields` should contain display-safe structured values derived from the space schema and conventions. It should not expose full Markdown bodies.

### Files List

`files.list` returns display-safe workspace files for the WebApp file navigation mode. It must not expose absolute paths, `.git`, build artifacts, dependency directories, or local-only Forma files.

Params:

```json
{}
```

Result outline:

```json
{
    "schemaVersion": 1,
    "operation": "files.list",
    "status": "passed",
    "workspace": {
        "root": ".",
        "name": "Acme Knowledge"
    },
    "files": [
        {
            "path": ".forma/views/tasks.md",
            "kind": "view",
            "mediaType": "text/markdown",
            "name": "tasks.md",
            "parent": ".forma/views",
            "depth": 2,
            "features": ["render.view", "render.source"],
            "title": "Tasks",
            "frontmatter": {
                "kind": "forma-view"
            }
        },
        {
            "path": "tasks/user-registration.md",
            "kind": "knowledge",
            "mediaType": "text/markdown",
            "name": "user-registration.md",
            "parent": "tasks",
            "depth": 1,
            "features": ["render.markdown", "render.source"],
            "space": "tasks",
            "title": "User registration",
            "frontmatter": {
                "kind": "task",
                "title": "User registration"
            }
        },
        {
            "path": ".forma/spaces/templates/task.md",
            "kind": "template",
            "mediaType": "text/markdown",
            "name": "task.md",
            "parent": ".forma/spaces/templates",
            "depth": 3,
            "features": ["render.source"],
            "frontmatter": {
                "kind": "task"
            }
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

P0 `kind` values are `knowledge`, `view`, `template`, `markdown`, `config`, `index`, and `resource`. Uncatalogued Markdown should remain visible as `markdown` so users and Agents can find files outside spaces without making file navigation the primary product navigation model. Supported non-Markdown files should appear as `resource` when they are safe to expose in workspace file navigation.

`mediaType` is the server-assigned MIME type for the file, derived from the workspace-relative path extension in P0. Clients should treat it as display and preview metadata from the operation layer, not as user-authored frontmatter.

`features` is assigned by the operation layer and is the client-facing source of truth for preview and render affordances. P0 feature values are:

- `render.markdown`: the file can be rendered with `file.render` Markdown mode.
- `render.source`: the file can be rendered with `file.render` source mode.
- `render.view`: the file can be rendered with `view.render`.
- `preview.media`: the file can be previewed through the raw workspace route.

P0 feature assignment:

- `knowledge`: `render.markdown`, `render.source`
- `view`: `render.view`, `render.source`
- `template`, `markdown`, `config`, and `index`: `render.source`
- `resource`: `preview.media` for image, audio, and video media types; `render.source` for text-like media types and `application/json`; otherwise no render or preview feature

Markdown files may include a `frontmatter` object with raw parsed YAML frontmatter. `frontmatter.kind` is the source file value, not a separate Forma-inferred knowledge kind.

### Create

`create` resolves space create inputs, renders the filename and template, validates the generated entry, and writes one file. Subsequent read operations rebuild their in-memory projections from source files.

Params:

```json
{
    "space": "tasks",
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
    "status": "passed",
    "workspace": {
        "root": ".",
        "name": "Acme Knowledge"
    },
    "created": {
        "path": "tasks/draft-reference-model.md",
        "space": "tasks",
        "template": ".forma/spaces/templates/task.md"
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
    "summary": {
        "errors": 0,
        "warnings": 0,
        "infos": 0
    },
    "diagnostics": []
}
```

Path conflicts, invalid create inputs, invalid generated paths, invalid generated entries, and failed writes are operation failures. Invalid workspace diagnostics that do not block creation may be returned as diagnostics.

### View Render

`view.render` renders one declarative view for the local WebApp and HTTP API. It evaluates view parameters, page source filters, taxonomy source filters, normalized-entry query definitions, sort definitions, display fields, table fields, kanban columns, and render mounts. It writes nothing and does not persist rendered view results.

The source/query model is defined in [[architecture/forma-view-query-model]].

Starter views should use `source.type: pages` plus `source.taxonomy` filters for taxonomy-scoped projections. Explicit query predicates should use `field` paths such as `fields.status`. P0 render support should cover `equals`, `in`, `contains`, and `exists`; unsupported fields or operators should return structured diagnostics.

Params:

```json
{
    "view": "tasks",
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
        "id": ".forma/views/tasks",
        "path": ".forma/views/tasks.md",
        "surface": "page",
        "mode": "kanban",
        "title": "Tasks",
        "space": "tasks",
        "source": {
            "type": "pages",
            "taxonomy": {
                "spaces": ["tasks"]
            }
        },
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

For a Markdown knowledge file needed by the WebApp reader, `inspect` can return the entry structure, while `file.render` owns document body payloads and render analysis. The WebApp's primary reader path uses Markdown source plus backend-derived headings, references, and diagnostics, then renders HTML in the browser. Keeping body payloads separate avoids making `inspect` return full content for scripts that only need metadata, outline, references, or diagnostics.

### File Render

`file.render` prepares one workspace file for the local WebApp and HTTP API. It uses the same parsing, reference, FormaAST, and diagnostic pipeline as `inspect` for knowledge files. It writes nothing and does not persist rendered output.

Params:

```json
{
    "path": "tasks/user-registration.md",
    "format": "markdown"
}
```

Result outline:

```json
{
    "schemaVersion": 1,
    "operation": "file.render",
    "status": "passed",
    "workspace": {
        "root": ".",
        "name": "Acme Knowledge"
    },
    "file": {
        "path": "tasks/user-registration.md",
        "space": "tasks",
        "kind": "task",
        "title": "User registration"
    },
    "render": {
        "format": "markdown",
        "markdown": "# User registration\n\n...",
        "headings": [],
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

P0 should support `format: "markdown"` for Markdown knowledge files and `format: "source"` for text-like files marked with the `render.source` feature. The Markdown render result should provide the body source after frontmatter splitting plus backend-derived headings, references, and diagnostics. The WebApp then owns HTML generation, sanitization, Mermaid/code/math plugins, and reader styling.

Server-rendered `format: "html"` may be reintroduced or retained as an explicit compatibility/export mode for non-WebApp clients, CLI preview, or static output. It should not be the primary WebApp reader contract. When present, HTML output should be semantic and avoid presentation-oriented classes and inline styles.

`file.render` should reject unsupported file and format combinations through operation diagnostics instead of falling back to raw file access.

The `file.render` result uses a top-level `file` payload. It does not include the full `WorkspaceFile` metadata from `files.list`; clients should use `files.list` when they need navigation metadata or feature flags.

### File References

`file.references` returns outgoing references and backlinks for one indexed knowledge file and should succeed with top-level operation `file.references`.

Params:

```json
{
    "path": "tasks/user-registration.md"
}
```

Result outline:

```json
{
    "schemaVersion": 1,
    "operation": "file.references",
    "status": "passed",
    "workspace": {
        "root": ".",
        "name": "Acme Knowledge"
    },
    "file": {
        "path": "tasks/user-registration.md",
        "space": "tasks",
        "kind": "task",
        "title": "User registration"
    },
    "outgoing": [],
    "backlinks": [],
    "summary": {
        "errors": 0,
        "warnings": 0,
        "infos": 0
    },
    "diagnostics": []
}
```

`file.references` should use resolved reference data from the in-memory read model and should not scan raw Markdown in the WebApp or expose absolute host paths. The result uses a top-level `file` payload for the requested knowledge file.

## Serve API

`forma serve` should bind to localhost by default, serve built WebApp static assets, and expose:

```text
POST /rpc
```

The Rust CLI package should remain buildable from a clean checkout even when ignored WebApp `dist` assets have not been generated. Development and release tasks should build the WebApp before packaging `forma serve`; a fallback static page may be embedded only to keep Rust checks usable when assets are absent.

P0 supports an explicit external WebApp asset directory override, such as `forma serve --webapp-dir <dir>`, for development debugging and issue verification. When present, that directory provides static assets instead of the embedded WebApp assets. The override is serve-time only, must not be stored in shared workspace configuration, and must not change RPC behavior or workspace permissions. Broader custom distribution and white-label packaging remain P1 concerns.

P0 also supports explicit RPC CORS origins for Vite dev server workflows, such as `forma serve --cors-origin http://localhost:5173`. CORS must be disabled by default, must reject wildcard origins, and should apply only to `/rpc`. Development WebApp builds may use `VITE_FORMA_RPC_URL` to call the configured Forma RPC URL across origins.

The WebApp should use `POST /rpc` for workspace overview, space listing, file navigation, entry inspection, file rendering data, view rendering, diagnostics, configuration inspection, and index status. P0 should avoid adding parallel REST endpoints for the same operation semantics.

Future convenience endpoints for static assets, health, or development-mode frontend integration must not bypass the shared dispatcher for product operations.

## Path And Privacy Rules

- Public paths use workspace-relative POSIX strings.
- Absolute paths and `..` traversal are rejected in operation params unless the command explicitly accepts the workspace root.
- Windows-style CLI path separators may be accepted and normalized.
- Path identity remains case-sensitive.
- Diagnostics may suggest case-correct candidates but must not silently resolve references case-insensitively.
- Public results must not include local-only cache paths, private local files, local override values that are not needed to explain effective config, or user behavior traces.

## Related Decisions

- [Forma P0 Core Architecture](../decisions/forma-p0-core-architecture.md)
- [Forma core technical direction](forma-core-technical-direction.md)
- [Product direction](../product/product-direction.md)

## Resolved P0 Questions

- P0 does not expose `index.rebuild` or `index.check`.
- The WebApp landing view should compose existing operations instead of adding a separate `workspace.inspect` operation.
- Individual workspace file rendering is handled by `file.render`.
