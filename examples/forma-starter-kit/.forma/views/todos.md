---
kind: forma-view

view:
    surface: page
    mode: kanban
    space: todos
    title: Todos
    display:
        order: 50
    description: Example onboarding tasks.
    kanban:
        card:
            titleField: title
            subtitleFields:
                - summary
                - assignees
            badgeFields:
                - dueDate
        columns:
            - id: todo
              label: To Do
              query:
                  all:
                      - target: frontmatter.status
                        op: equals
                        value: todo
            - id: doing
              label: Doing
              query:
                  all:
                      - target: frontmatter.status
                        op: equals
                        value: doing
            - id: done
              label: Done
              query:
                  all:
                      - target: frontmatter.status
                        op: equals
                        value: done
---

# Todos

<!-- forma-view -->
