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
        - source: fields
          field: owners
          label: owned by
        - source: fields
          field: assignees
          label: assigned to
        - source: fields
          field: reviewers
          label: reviewed by
        - source: fields
          field: blocked_by
          label: blocked by
        - source: fields
          field: related_to
          label: related to
        - source: fields
          field: sources
          label: sourced from
---

# Knowledge Graph

Workspace graph generated from resolved body and field references.
