---
id: workspace.schemas
title: Schemas
summary: Describe frontmatter fields for configured spaces.
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

Space schemas describe expected frontmatter fields. They guide validation and Agent edits without replacing Markdown as the source of truth.

## Reference

Define schemas on the configured space. Keep the first schema small and based on fields the human actually wants to find, compare, or reference.

```yaml
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
        tags:
            type: list
            items:
                type: string
        owner:
            type: person
        status:
            type: noteStatus
        progress:
            type: number
        retryCount:
            type: integer
```

Common field shapes:

| Shape                 | Use for                                                    |
| --------------------- | ---------------------------------------------------------- |
| `type: string`        | titles, summaries, statuses, short labels                  |
| `type: number`        | measurements that may contain fractions (`1`, `1.5`)      |
| `type: integer`       | whole-number counts (`2`, `-1`)                            |
| `type: date`          | due dates, publication dates, review dates                 |
| `type: datetime`      | event times and timestamped records                        |
| `type: list`          | tags, participants, related entries                        |
| `type: person`        | one reference through a configured `entryRef` named type   |
| `type: list` of named | many references through a configured `entryRef` named type |
| `type: noteStatus`    | constrained value through a configured enum type           |

### Numeric values and YAML typing

Keep values for `number` and `integer` fields as unquoted YAML numbers:

```yaml
progress: 1.5
retryCount: 2
```

Forma does not coerce strings to numbers. `progress: "1.5"` and `retryCount: "2"` are strings and fail numeric Schema validation. `type: integer` also rejects decimal notation such as `2.0`. Use `type: string` for lexical values that need zero padding, such as `"01"`; P0 numeric types currently validate the scalar type but do not define range constraints.

Define named types before using them in schemas. Use `kind: entryRef` named types for references to configured content groups, and `kind: enum` named types for constrained scalar values. The low-level `type: entryRef` and `type: enum` primitives are implementation shapes; workspace-authored schemas should prefer named types because they make the relationship or value meaning explicit.

Older pre-release workspaces may use `kind: ref` in `types` or `type: ref` in schemas. Current Forma uses `entryRef` for entry references. Replace named type `kind: ref` with `kind: entryRef`. Replace low-level schema `type: ref` with `type: entryRef`, or preferably use the configured named type directly.

For an entry reference field, store the workspace reference path that resolves to one entry of that named type. For example, if `owner.type` is `person`, do not store a raw runtime id such as `alex-chen`; store the reference path that resolves to the configured `person` entry in this workspace.

When defining templates or create defaults for entry reference fields, inspect the field schema first. If the default should point to the current user, use a runtime identity value such as `currentUserId` only as an input to the workspace's explicit reference path. For example, `people/{{ runtime.values.currentUserId }}` is valid only when `people/<id>` is the configured reference form for the `person` type in that workspace.

## Agent Skill

Keep schema fields minimal and aligned with the human workflow. Prefer camelCase field names unless the existing workspace uses another convention.

When a field uses `type: number` or `type: integer`, write frontmatter values as unquoted YAML numbers. Do not rely on implicit conversion from quoted strings; use `type: string` for zero-padded or otherwise lexical values such as `"01"`.

Do not add fields only because they might be useful someday. Add the few fields needed for the first list, table, create template, or Agent workflow, then verify with `forma check --json`. Do not infer entry reference paths from directory names or runtime value names; use configured named types and existing workspace references.
