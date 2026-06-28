---
id: workspace.views
title: Views
summary: Define saved read-only projections over workspace pages.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 140
---

# Views

## Overview

Views are configured Markdown nodes that describe read-only projections such as lists, tables, kanban boards, and graphs.

View config uses `mode` to select the projection and `source` to choose the candidate pages. Do not use `projection` or `query.source`; those are not the current view DSL.

Minimal table view:

```md
---
schemaVersion: 1
kind: view
title: Notes
mode: table
source:
    type: pages
    taxonomy:
        spaces:
            - notes
table:
    columns:
        - field: fields.title
          label: Title
        - field: fields.summary
          label: Summary
---

# Notes

<!-- forma:content -->
```

Minimal graph view:

```md
---
schemaVersion: 1
kind: view
title: Graph
mode: graph
source:
    type: pages
graph:
    edges:
        - source: fields
          field: owner
          label: owned by
---

# Graph

<!-- forma:content -->
```

Use `query` only for filters within the selected source:

```yaml
query:
    all:
        - field: fields.status
          op: equals
          value: active
```

## Agent Guidance

Add views after the underlying spaces and fields exist. Treat views as projections, not as hidden state.

Every rendered view page needs a `<!-- forma:content -->` mount in the Markdown body. `forma view render` reports `view.mountMissing` when the mount is absent.

Render configured views with `forma view render <view-id-or-path> --json`. Use this for lists, tables, kanban boards, and graphs instead of introducing workflow-specific read commands.
