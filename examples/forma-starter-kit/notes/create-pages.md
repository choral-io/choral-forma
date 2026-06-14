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

For example, `.forma/spaces/todos.md` points to `.forma/spaces/templates/todo.md`. The term defines inputs such as title, status, priority, assignees, and due date. The template turns those inputs into ordinary Markdown frontmatter and body content.

```yaml
kind: todo
title: "{{ input.title }}"
status: "{{ input.status }}"
priority: "{{ input.priority }}"
assignees: []
```

The generated page is still just a Markdown file under `todos/`. It can be edited in a normal editor and later appears in the Todos space and kanban view.

## Why This Matters

Create flows should not depend on hidden application state. A teammate should be able to review the create behavior by reading the taxonomy term and template files.
