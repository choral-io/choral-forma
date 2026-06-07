---
kind: forma-view

view:
    surface: page
    mode: list
    space: notes
    title: Recent
    display:
        order: 40
    description: Recently updated starter guide notes.
    query:
        all:
            - target: entry.space
              op: equals
              value: notes
    sort:
        - field: createdAt
          direction: desc
---

# Recent

<!-- forma-view -->
