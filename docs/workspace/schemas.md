---
id: workspace.schemas
title: Schemas
summary: Define frontmatter constraints with built-in and workspace-defined types.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 120
---

# Schemas

## Overview

A content group's `schema` describes its entries' YAML frontmatter. Forma provides the Schema DSL; field names and any named types come from workspace configuration.

## Reference

### Built-in Types

| Type       | Meaning and options                                                     |
| ---------- | ----------------------------------------------------------------------- |
| `object`   | Mapping whose child schemas are declared in `fields`.                   |
| `string`   | Text value.                                                             |
| `number`   | YAML number, including integers and fractions.                          |
| `integer`  | YAML integer; decimal notation such as `2.0` is not accepted.           |
| `boolean`  | YAML `true` or `false`.                                                 |
| `date`     | String in `YYYY-MM-DD` format.                                          |
| `datetime` | RFC3339 datetime string.                                                |
| `const`    | Value equal to the node's `value`.                                      |
| `enum`     | Value from the configured enum named by `enum`.                         |
| `entryRef` | Entry reference; `target` optionally names a configured reference type. |
| `list`     | Sequence whose element schema is declared in `items`.                   |

Other `type` names must be declared as [named types](#named-types); they are not additional built-ins.

### Basic Schema

Add this fragment to a configured content-group term. It needs no named-type declarations:

```yaml
schema:
    type: object
    fields:
        title:
            type: string
            required: true
        count:
            type: integer
        ratio:
            type: number
        code:
            type: string
```

For example, this entry frontmatter satisfies it:

```yaml
title: Example
count: 2
ratio: 0.5
code: "01"
```

Field names are workspace-defined. `required: true` belongs on the field itself, not in a parent `required` array. Optional fields may be absent or null. The optional `label`, `readonly`, and `hidden` metadata are presentation/tooling hints, not access controls.

### Values and Validation

Validation uses parsed YAML types without string, number, or boolean coercion. `2` satisfies both `number` and `integer`; `"2"` is a string, and `2.0` satisfies only `number`. Quote string values whose spelling must be preserved, such as `"01"`.

Type declarations do not impose positivity, numeric bounds, or finite-value constraints. Use a separate workspace validator for business rules the DSL does not express. Forma schemas use this DSL, not arbitrary JSON Schema keywords.

### Named Types

Declare reusable types in root `.forma.md` or an imported `kind: types` node. Supported declaration kinds are `enum` and `entryRef`. Names share one effective `types` map; duplicate or undeclared names produce diagnostics.

This example defines two workspace-specific names. First add these declarations to `.forma.md`:

```yaml
types:
    entryState:
        kind: enum
        values: [draft, ready]
    relatedEntry:
        kind: entryRef
        source: .forma/spaces/entries
```

Then save this content group as `.forma/spaces/entries.md`, using the `spaces` taxonomy and import pattern from [First-Slice Config](first-slice-config.md):

```yaml
---
schemaVersion: 1
kind: term
id: entries
taxonomy: spaces
title: Entries
include:
    - "entries/**/*.md"
schema:
    type: object
    fields:
        title:
            type: string
        state:
            type: entryState
        related:
            type: relatedEntry
---
```

`entryState` and `relatedEntry` are example names, not reserved types. Their declarations are required before using them. The `source` points to the configured content group defined above; declaring a reference type does not create that group or its entries.

A `state` value must be `draft` or `ready`. A `related` value stores the workspace-relative path of an existing entry in the target group, for example `entries/other.md` if that file exists. See [Entry References](configuration.md#entry-references) for path and default handling.

Older configurations using `kind: ref` or `type: ref` should use `entryRef` instead; see [Migration Notes](configuration.md#migration-notes).

## Agent Skill

Inspect the effective content-group schema and named-type declarations before editing values. Use only configured field and type names, preserve YAML value types, and keep additions within the approved workflow. Preview configured creates and run `forma check --json` after changes.
