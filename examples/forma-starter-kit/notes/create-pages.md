---
kind: note
title: "Create Pages"
summary: "How term create inputs and templates describe new Markdown pages."
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Create Pages

The current WebApp is read-only, but the starter still shows how future create flows should be described by files.

Each term can define:

- where new pages are written;
- which template to use;
- which inputs the user or tool should provide;
- which default values should be filled by runtime helpers.

For example, `.forma/spaces/tasks.md` points to `.forma/spaces/templates/task.md`. The term defines inputs such as title, status, readiness, priority, owners, assignees, reviewers, and due date. The template turns those inputs into ordinary Markdown frontmatter and body content.

```yaml
kind: task
title: "{{ input.title }}"
status: "{{ input.status }}"
readiness: "{{ input.readiness }}"
priority: "{{ input.priority }}"
owners: []
```

The generated page is still just a Markdown file under `tasks/`. It can be edited in a normal editor and later appears in the Tasks space and kanban view. Proposal and guideline terms work the same way: the create flow stays visible in the repository instead of hiding inside application state.

Starter task pages can then point directly to operating guidance such as [[guidelines/task-selection|Task Selection]] or decisions such as [[decisions/use-spaces-for-shared-workspace-sections|Use Spaces For Shared Workspace Sections]].

## Why This Matters

Create flows should not depend on hidden application state. A teammate should be able to review the create behavior by reading the taxonomy term and template files.
