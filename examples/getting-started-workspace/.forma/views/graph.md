---
schemaVersion: 1
kind: view
mode: graph
title: Graph
display:
  order: 10
description: Graph links across notes, tasks, members, and guidelines.
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
      field: blockedBy
      label: blocked by
---

# Graph

Explore how pages connect across the getting-started workspace.

<!-- forma:content -->
