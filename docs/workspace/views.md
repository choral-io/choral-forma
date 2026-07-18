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

View parameters and embedded view comments such as `<!-- forma-view: ... -->` are future design targets, not current workspace view syntax. Current views are directly rendered page views, and `forma view render` does not evaluate `{{ params.* }}` placeholders in view definitions.

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
    presentation:
        nodes:
            colorBy:
                taxonomy: areas
    edges:
        - source: fields
          field: owner
          label: owned by
---

# Graph

<!-- forma:content -->
```

`graph.presentation.nodes.colorBy.taxonomy` optionally colors nodes by any configured taxonomy. A Page that matches one term uses the term's `display.color`, falling back to the taxonomy's `display.color`. Unclassified Pages and Pages that match several terms keep a neutral fill, so Forma never chooses an arbitrary first term. Omitting `colorBy` preserves the Host's neutral Graph colors; naming an unknown taxonomy reports `view.graphTaxonomyMissing`.

Node size is derived from the number of incoming and outgoing resolved references, using a bounded logarithmic scale so highly connected Pages stand out without overwhelming the layout.

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
