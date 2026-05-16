---
name: kanban-maintenance
description: Maintain the repository Kanban board after approval. Use for adding, moving, or updating cards and applying approved planning dry runs.
---

# Kanban Maintenance

Use this skill to apply approved changes to `knowledge/planning/KANBAN.md`.

## Preconditions

- A maintainer has explicitly approved the Kanban change.
- The proposed card links to project knowledge or a task item.
- The card is not a duplicate of an active card.

## Workflow

1. Read `knowledge/tasks/WORKFLOW.md`.
2. Open `knowledge/planning/KANBAN.md`.
3. Resolve card wikilinks to task items by task id or file basename.
4. Apply only the approved board changes.
5. Keep cards thin and linked.
6. Preserve the column order.
7. Report exact cards moved, added, changed, or removed.

## Guardrails

- Do not edit unrelated cards.
- Do not use localized files as card sources.
- Do not duplicate acceptance criteria or long discussion in the board.
- Stop and report ambiguity if a card link can match multiple canonical files.
- When moving a card to `Blocked`, keep the board card thin and ensure blocker details live in the linked task item.
- Stop if the requested change conflicts with the Kanban workflow.

## References

- For card and column examples, read `references/cards.md`.
