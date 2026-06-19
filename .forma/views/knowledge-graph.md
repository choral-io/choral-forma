---
schemaVersion: 1
kind: view
title: Knowledge Graph
mode: graph
source:
    type: pages
graph:
    edges:
        - source: body
          intent: link
          label: links to
        - source: body
          intent: embed
          label: embeds
---

# Knowledge Graph

Workspace graph generated from resolved body references.
