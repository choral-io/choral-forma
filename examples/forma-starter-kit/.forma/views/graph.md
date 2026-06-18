---
schemaVersion: 1
kind: view
mode: graph
title: Graph
display:
  order: 10
description: Graph links across notes, todos, and referenced people.
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
      field: assignees
      label: assigned to
---

# Graph

Explore how pages, tasks, and people connect across the starter workspace.

<!-- forma:content -->
