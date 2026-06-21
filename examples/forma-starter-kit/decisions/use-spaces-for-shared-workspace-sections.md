---
kind: decision
title: "Use Spaces For Shared Workspace Sections"
summary: "Group starter content into a small set of explicit spaces instead of relying on implicit folder meaning."
status: "accepted"
owners:
  - members/mira-chen.md
reviewers:
  - members/sam-rivera.md
related_to:
  - notes/organize-with-spaces.md
  - tasks/add-team-notes.md
decidedAt: "2026-06-03T18:00:00Z"
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Use Spaces For Shared Workspace Sections

## Context

The starter needs enough structure to support browsing, views, and create flows without turning folders into product magic.

## Decision

Use the primary `spaces` taxonomy to define the sections a copied workspace is expected to share: notes, tasks, members, decisions, proposals, and guidelines.

## Consequences

- [[notes/organize-with-spaces|Organize With Spaces]] can explain the workspace model with concrete files.
- Work items such as [[tasks/add-team-notes|Add Team Notes]] can point to the space they belong in.
- Guidelines such as [[guidelines/workspace-operations|Workspace Operations]] can assume a small, readable shared structure.
