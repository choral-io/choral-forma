---
title: "Workspace Operations"
summary: "How to copy, review, and maintain the starter workspace as a shared team space."
owners:
  - members/mira-chen
reviewers:
  - members/sam-rivera
skill:
  id: starter-workspace-operations
  title: Starter Workspace Operations
  description: Use when an Agent needs to maintain or classify shared starter workspace content.
  triggers:
    - starter content edits
    - local-only promotion
    - language variant placement
  order: 20
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Workspace Operations

## When To Use This

Use this guideline when you first copy the starter, when you review the shared structure, or when you decide whether a change belongs in committed workspace content.

## Guidance

1. Keep the shared workspace readable in ordinary Markdown. If a teammate cannot review the change in the repository, simplify it.
2. Start with the smallest useful set of spaces. Add new spaces only when the team has repeated examples that no longer fit the current ones.
3. Prefer updating an existing page before creating a new one when the topic is already covered.
4. Use finished work such as [[tasks/publish-read-only-workspace|Publish Read-only Workspace]] as reference material, not as a reason to accumulate stale tasks.
5. When onboarding someone new, point them to [[notes/getting-started|Getting Started]] and [[notes/welcome-to-choral-forma|Welcome to Choral Forma]] before deeper process notes.
6. Keep personal configuration in explicitly included private paths when the copied workspace defines them. This starter includes optional `.forma/local/*.yml` and `.forma/local/*.md` patterns in `.forma.md`, and its `.gitignore` keeps `.forma/local/` uncommitted. Do not treat ignored files as shared workspace content.
