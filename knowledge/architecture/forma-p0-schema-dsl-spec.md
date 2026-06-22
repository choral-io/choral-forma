---
scope: project
type: technical-design
owners: []
tags:
    - architecture
    - forma
    - p0
    - schema
---

# Forma P0 Schema DSL Spec

## Context

Forma P0 needs enough structure to make Markdown-backed knowledge predictable for humans, scripts, and Agents without turning configuration into a heavy application framework.

The Schema DSL is the standard object constraint language for Forma workspace configuration. It replaces a direct JSON Schema requirement in P0 and should be used wherever Forma needs to describe object structure, field constraints, and semantic references.

P0 does not pursue strong consistency as a product promise. Users can edit Markdown and YAML files directly, so Forma should combine lightweight schema checking, diagnostics, explicit create-time behavior, and repository review rather than pretending every workspace state can be prevented.

## Goals

- Provide a small YAML-friendly DSL for space entry metadata.
- Keep space definitions readable for non-frontend and non-Git-specialist users.
- Make semantic references such as user assignments explicit enough for Agents and scripts.
- Keep create-time input behavior separate from runtime entry constraints.
- Support deterministic diagnostics that explain problems without rewriting files automatically.
- Leave room for richer constraints, generated schemas, and stronger tooling in later versions.

## Non-goals

- Do not use JSON Schema files as the user-authored P0 space constraint surface.
- Do not introduce a code-first validation framework.
- Do not support executable validators, custom scripts, DataviewJS-like trusted code, arbitrary template expressions, or plugin-loaded validation logic.
- Do not try to prevent all invalid states caused by manual file editing.
- Do not implement groups, union reference types, lifecycle/deprecation fields, maps, polymorphic objects, or cross-field custom validation in P0.

## Schema DSL

Schema definitions are authored in YAML. A space owns an inline `schema` object that describes the frontmatter shape for entries in that space.

P0 supports these schema node kinds:

- `object`
- `string`
- `number`
- `integer`
- `boolean`
- `date`
- `datetime`
- `const`
- `enum`
- `ref`
- `list`

The DSL uses field-local `required: true` instead of JSON Schema-style `required: [...]` arrays. This keeps overrides and partial config composition simple because the required flag travels with the field it describes.

Example:

```yaml
schema:
    type: object
    fields:
        kind:
            type: const
            value: task
            required: true
        title:
            type: string
            required: true
        summary:
            type: string
        status:
            type: enum
            enum: taskStatus
            required: true
        assignees:
            type: list
            items:
                type: ref
                target: member
        dueDate:
            type: date
        createdAt:
            type: datetime
            readonly: true
```

`readonly` and `hidden` are tool and UI hints only. They are not security controls and do not prevent a user from editing files directly.

## Semantic Types

The P0 starter does not require a standalone semantic type file. It keeps create inputs, select options, and taxonomy membership on the relevant Markdown configuration nodes, such as `.forma/spaces/*.md`.

Future semantic type configuration can use Markdown configuration nodes if the workspace needs reusable value meanings beyond inline create inputs. The first useful kinds are likely:

- `kind: space`: values resolve to entries in a space.
- `kind: enum`: values must be one of a static list.

Example:

```yaml
---
schemaVersion: 1
kind: semantic-type
title: Task Status
type: enum
values:
    - todo
    - ready
    - doing
    - blocked
    - reviewing
    - done
---
```

Input `transform` settings describe how human-provided locator input may be normalized before matching a value. They apply to CLI, GUI, view controls, and future structured operations that accept values from the configured input.

P0 should keep matching explicit and deterministic:

- Path identity is case-sensitive.
- Semantic type input may apply its configured transform before matching.
- Forma must not silently perform global case-insensitive matching.
- Diagnostics may suggest a case-correct match when one exists.

## Spaces

A P0 space definition combines file inclusion, create behavior, runtime schema, and display conventions.

Example `.forma/spaces/tasks.md` shape:

```yaml
---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Tasks
include:
    - "tasks/**/*.md"
create:
    directory: "tasks"
    filename: "{{ input.slug }}.md"
    template: ".forma/spaces/templates/task.md"
    inputs:
        title:
            required: true
        summary:
            default: ""
        slug:
            type: string
            default: "{{ input.title }}"
            transform: slugify
schema:
    type: object
    fields:
        kind:
            type: string
        title:
            type: string
        summary:
            type: string
        status:
            type: string
        assignees:
            type: list
            items:
                type: ref
                target: member
        dueDate:
            type: string
        createdAt:
            type: string
conventions:
    titleField: fields.title
    summaryField: fields.summary
    createdAtField: fields.createdAt
---
```

`include`, `template`, `create.directory`, and generated filenames are workspace-relative POSIX-style paths. Forma should reject absolute paths, `..` traversal, home expansion, and platform-specific persisted separators in configuration.

`conventions` are display and tooling hints. They do not replace schema constraints and should not be required for every space field.

## Create Inputs

`create.inputs` describes CLI and GUI input behavior for creating entries. It is not the runtime schema. Inputs may reference schema fields or define independent create-only values such as a slug.

Input rules:

- An input may reference a schema field with `field: <fieldName>`.
- An input may define its own `label`, `type`, `default`, `required`, and `transform`.
- An input name may match a schema field while still having create-time behavior that is separate from runtime validation.
- If an input has `default`, the rendered value is used when the user does not provide a value.
- If an input does not have `default` and the user does not provide a value, the value is absent rather than implicitly null or an empty string.
- If a required input has no user value and no default, `forma create` must ask for a value in interactive mode or fail with a diagnostic in non-interactive mode.

Template rendering receives an `input.*` object after defaults and transforms are resolved.

## Runtime Values

Runtime values are explicit configuration-provided values under `runtime.values.*`. Forma should not have a special hidden member resolver. Current-user behavior is just one configured runtime value.

Example:

```yaml
runtime:
    values:
        currentDate:
            kind: currentDate
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot
        currentUserId:
            kind: gitConfig
            key: user.name
            transform: slugify
```

P0 runtime value provider kinds:

- `const`
- `gitConfig`
- `currentDate`
- `currentDateTime`
- `workspaceRoot`

`date` and `datetime` schema field types describe value shape only. They should not carry timezone metadata in field definitions. Workspace timezone belongs in explicit workspace configuration, and time-derived runtime providers such as `currentDate` and `currentDateTime` should derive values from that effective workspace configuration.

`date` values are persisted as `YYYY-MM-DD`. `datetime` values are persisted as RFC3339 timestamps with explicit timezone information, either `Z` or a numeric offset such as `+08:00`. Forma-controlled inputs may accept looser local datetime input, but must normalize it through the effective `workspace.timezone` before writing a persisted `datetime`. Persisted offset-less datetime strings such as `2026-05-19T10:30:00` are invalid.

`transform` is allowed on runtime value providers. If a required runtime value cannot be resolved, operations that only need a warning should continue with a `runtime.value.unresolved` warning. Operations that require the value to complete must fail with a diagnostic.

Local overrides use the same configuration shape and are discovered only when `.forma.yml` includes matching files that the project ignore rules mark as local-only. For example, a workspace may include an ignored personal override file that sets `runtime.values.currentUserId` with `kind: const`. P0 does not need a separate allow/deny override policy for runtime values.

## Placeholders

P0 supports simple `{{ path.to.value }}` placeholders only in Forma-controlled surfaces:

- Configuration values that explicitly allow placeholders.
- Templates under `.forma/spaces/templates/`.
- View parameters and future embedded-view arguments.

P0 placeholders do not support expressions, arithmetic, conditions, loops, includes, functions, default operators, filters, or arbitrary code execution. Ordinary Markdown body text is inert unless it appears inside a Forma-controlled template or explicit Forma directive surface.

Allowed placeholder roots include:

- `input.*`
- `runtime.values.*`
- Other explicit roots defined by an operation result context.

Placeholder resolution must detect cycles. A cycle is a diagnostic rather than an infinite render attempt.

## Transforms

P0 supports `slugify` as the only built-in transform.

`slugify` should:

- Trim surrounding whitespace.
- Lowercase where the implementation can do so deterministically.
- Convert whitespace runs to `-`.
- Remove or replace path separators and reserved filesystem characters.
- Collapse repeated hyphens.
- Strip leading and trailing hyphens.
- Preserve Unicode letters and numbers where practical.
- Fail if the result is empty.
- Reject or adjust Windows reserved device names.

Transforms are applied after placeholder rendering for that value.

Default resolution must be dependency-aware. If `input.a.default` references `input.b`, and `input.b.default` references `input.c`, Forma should resolve the dependency graph rather than relying on a single left-to-right render pass. A cycle or unresolved required dependency must produce a diagnostic.

## Validation And Diagnostics

P0 validation should be diagnostic-first:

- Parse configuration into typed structures where practical.
- Parse entry frontmatter into generic YAML values.
- Determine space membership from space `include` rules.
- Validate known fields against the space schema.
- Resolve semantic references where schema fields use `type: ref`.
- Report unknown, invalid, unresolved, stale, and ambiguous cases with structured diagnostics.

P0 should not automatically fix schema violations. `forma check` reports enough information for a human or Agent to repair files manually.

The Schema DSL can later compile to JSON Schema-like output for tooling, editor integration, documentation, or partial interoperability, but generated schemas are derived artifacts. The P0 user-authored source of truth is the Forma Schema DSL.

## Non-blocking Questions

- Enum values may later need labels, icons, colors, ordering, or descriptions, but P0 should keep enum values as plain strings.
- Future map/object composition, union references, and group/member assignment semantics should be designed after the P0 starter is implemented and tested.
