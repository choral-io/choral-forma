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
        status:
            type: string
        tags:
            type: list
            items:
                type: string
        owner:
            type: ref
            target: person
```

Common field shapes:

| Shape                 | Use for                                            |
| --------------------- | -------------------------------------------------- |
| `type: string`        | titles, summaries, statuses, short labels          |
| `type: date`          | due dates, publication dates, review dates         |
| `type: datetime`      | event times and timestamped records                |
| `type: list`          | tags, participants, related entries                |
| `type: ref`           | one reference to another configured content type   |
| `type: list` of `ref` | many references to another configured content type |

Use `target` only when the referenced content type exists or is part of the accepted current slice. Otherwise start with a `string` field or plain Markdown links, then tighten the schema later.

## Agent Guidance

Keep schema fields minimal and aligned with the human workflow. Prefer camelCase field names unless the existing workspace uses another convention.

Do not add fields only because they might be useful someday. Add the few fields needed for the first list, table, create template, or Agent workflow, then verify with `forma check --json`.
