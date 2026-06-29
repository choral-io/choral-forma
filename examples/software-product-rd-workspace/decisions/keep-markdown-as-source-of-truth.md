---
title: "Keep Markdown As Source Of Truth"
summary: "Project facts stay in Markdown files; generated views are projections."
status: accepted
owners:
  - members/noah-kim
reviewers:
  - members/ava-patel
tags:
  - decision
  - markdown
createdAt: "2026-06-29T00:00:00Z"
updatedAt: "2026-06-29T00:00:00Z"
---

# Keep Markdown As Source Of Truth

## Decision

Atlas Notes keeps product facts, architecture notes, delivery tasks, release scope, and validation evidence in repository Markdown files.

## Consequences

- The team can review project knowledge in ordinary Git diffs.
- Views must be rebuildable from files.
- Write operations must explain exactly which files they will change.
- Local-only notes are not shared product facts until explicitly promoted.

## Related Records

- [[architecture/planning-record-architecture]]
- [[guidelines/workspace-operations]]
- [[guidelines/content-authoring]]
