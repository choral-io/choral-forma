---
schemaVersion: 1
kind: view
mode: graph
title: Workspace Graph
display:
  order: 40
description: Links and structured references across product, delivery, validation, and release records.
source:
  type: pages
graph:
  edges:
    - source: body
      intent: link
      label: links to
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
    - source: fields
      field: relatedTasks
      label: includes task
    - source: fields
      field: relatedValidation
      label: validates with
    - source: fields
      field: relatedMetrics
      label: measures
---

# Workspace Graph

Links and structured references across product, delivery, validation, and release records.

<!-- forma:content -->
