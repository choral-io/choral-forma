# Kanban Card Examples

Canonical board:

```text
knowledge/planning/KANBAN.md
```

Column order:

1. `Backlog`
2. `Ready`
3. `Doing`
4. `Reviewing`
5. `Blocked`
6. `Done`
7. `Cancelled`

Preferred card:

```md
- [ ] [[example-delivery-task|Example delivery task]]
```

Temporary scheduling metadata is allowed when useful:

```md
- [ ] [[example-delivery-task|Example delivery task]] · P1 · app · Gavroche
```

The linked task item should hold durable details.

Resolve `[[example-delivery-task]]` to `knowledge/tasks/items/example-delivery-task.md` by default. If multiple canonical files match the same id, report ambiguity instead of guessing.
