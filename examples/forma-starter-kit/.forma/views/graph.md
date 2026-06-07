---
kind: forma-view

view:
    surface: page
    mode: graph
    title: Graph
    display:
        order: 10
    description: Graph links across notes, todos, and referenced people.
    source:
        kind: workspace
        include:
            - "**/*.md"
        exclude:
            - ".forma/**"
---

# Graph

<!-- forma-view -->
