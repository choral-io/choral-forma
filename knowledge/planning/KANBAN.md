---
scope: project
type: kanban
owners: []
---

# Kanban

The repository task board uses the original delivery columns:

## Backlog

## Ready

## Doing

## Reviewing

## Blocked

## Done

## Cancelled

Task board membership is stored in each task page's `status` frontmatter field. The current Forma board view is `.forma/views/task-board.md`; use `cargo run -q -p forma-cli -- board show --json` for machine-readable board state.

See [[architecture/repository-forma-workspace-migration-design]] for the repository migration model.
