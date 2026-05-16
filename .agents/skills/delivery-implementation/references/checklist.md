# Delivery Implementation Checklist

## Before Editing

- Read the selected Kanban card.
- Read the linked task item.
- Read relevant canonical knowledge files.
- Inspect the package or module before editing.
- Check `git status --short` and avoid unrelated changes.

## During Implementation

- Keep the change scoped to the task.
- Prefer existing patterns and package boundaries.
- Update tests near the changed behavior.
- Update canonical knowledge when behavior, configuration, or decisions change.

## Suggested Checks

Use the narrowest meaningful project-specific checks first:

```text
run the formatter or documentation check for changed Markdown
run focused tests for changed behavior
run the target project's normal build or verification command when risk warrants
```

Run broader checks when the change touches shared contracts, cross-module behavior, or delivery-sensitive flows.
