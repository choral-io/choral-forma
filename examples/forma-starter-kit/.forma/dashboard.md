---
schemaVersion: 1
kind: dashboard
title: Dashboard
sections:
  - id: overview
    title: Workspace overview
    source:
      type: workspace
    display:
      order: 10

  - id: recent
    title: Recent pages
    source:
      type: view
      view: ".forma/views/recent.md"
    display:
      order: 20

  - id: health
    title: Knowledge health
    source:
      type: diagnostics
    display:
      order: 30
---

# {{ workspace.name }}

Use the dashboard to scan recent pages, workspace health, and configured views.

<!-- forma:content -->
