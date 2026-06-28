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
```

Common field shapes:

| Shape                 | Use for                                                    |
| --------------------- | ---------------------------------------------------------- |
| `type: string`        | titles, summaries, statuses, short labels                  |
| `type: date`          | due dates, publication dates, review dates                 |
| `type: datetime`      | event times and timestamped records                        |
| `type: list`          | tags, participants, related entries                        |
| `type: person`        | one reference through a configured `entryRef` named type   |
| `type: list` of named | many references through a configured `entryRef` named type |
| `type: noteStatus`    | constrained value through a configured enum type           |

Define named types before using them in schemas. Use `kind: entryRef` named types for references to configured content groups, and `kind: enum` named types for constrained scalar values. The low-level `type: entryRef` and `type: enum` primitives are implementation shapes; workspace-authored schemas should prefer named types because they make the relationship or value meaning explicit.

For an entry reference field, store the workspace reference path that resolves to one entry of that named type. For example, if `owner.type` is `person`, do not store a raw runtime id such as `alex-chen`; store the reference path that resolves to the configured `person` entry in this workspace.

When defining templates or create defaults for entry reference fields, inspect the field schema first. If the default should point to the current user, use a runtime identity value such as `currentUserId` only as an input to the workspace's explicit reference path. For example, `people/{{ runtime.values.currentUserId }}` is valid only when `people/<id>` is the configured reference form for the `person` type in that workspace.

## Agent Guidance

Keep schema fields minimal and aligned with the human workflow. Prefer camelCase field names unless the existing workspace uses another convention.

Do not add fields only because they might be useful someday. Add the few fields needed for the first list, table, create template, or Agent workflow, then verify with `forma check --json`. Do not infer entry reference paths from directory names or runtime value names; use configured named types and existing workspace references.
