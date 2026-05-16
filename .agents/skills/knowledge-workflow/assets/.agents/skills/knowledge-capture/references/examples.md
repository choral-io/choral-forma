# Knowledge Capture Examples

## Shared Member Summary

```yaml
---
scope: member
type: summary
owners:
  - "[[Gavroche]]"
assignees:
  - "[[Gavroche]]"
reviewers: []
tags:
  - workspace
  - summary
---
```

Use for edited member-scoped summaries in:

```text
knowledge/workspace/Gavroche/summaries/YYYY-MM-DD-topic.md
```

Raw personal captures belong in `knowledge/workspace/<member-id>/local/scratch/`, structured personal drafts belong in `knowledge/workspace/<member-id>/local/drafts/`, and executable local work belongs in `knowledge/workspace/<member-id>/local/WORKLIST.md`.

## Local Promotion

Promote local material only after the user decides it should become shared knowledge.

Use edited summaries, not raw logs:

```text
knowledge/workspace/Gavroche/summaries/2026-04-25-example-feature-investigation.md
```

Use project areas when the promoted content affects durable facts:

```text
knowledge/product/example-feature-behavior.md
knowledge/architecture/example-service-flow.md
knowledge/tasks/items/example-feature-handling.md
```

Keep useful source links, but omit private notes, command chatter, failed attempts that do not matter, and raw local-only scratch context.

## Project Concept

```yaml
---
scope: project
type: concept
owners:
  - "[[groups/{{default_group_id}}]]"
tags:
  - agent
---
```

## UI Design Note

```yaml
---
scope: project
type: design
owners:
  - "[[groups/{{default_group_id}}]]"
tags:
  - ui
  - design
---
```

Use for implementation-facing UI guidance in:

```text
knowledge/design/<feature-name>-ui.md
```

Store related images, screenshots, or exported mockups in:

```text
knowledge/assets/design/<feature-name>/
```

## Localized Copy

```yaml
---
scope: project
type: concept
lang: zh-CN
canonical: ./agent.md
translation_of: agent
owners:
  - "[[groups/{{default_group_id}}]]"
tags:
  - agent
---
```

Localized files should link only to their canonical source by default.
