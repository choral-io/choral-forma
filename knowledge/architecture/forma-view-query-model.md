---
scope: project
type: technical-design
owners: []
tags:
    - architecture
    - forma
    - p0
    - views
    - query
---

# Forma View Query Model

## Context

Forma views are managed Markdown configuration nodes under `.forma/views/*.md`
by convention. They render structured knowledge from repository-backed Markdown
pages without turning view definitions into ordinary domain notes.

The initial design previously leaned toward collection-bound views and then a
workspace-file source model. The current starter-kit baseline is broader and
more semantic: a view starts from pages in the Forma read model, then filters
those pages by taxonomy membership or query predicates.

## Goals

- Keep view behavior explicit, file-backed, and reviewable.
- Support space views, uncatalogued file views, and graph views with one
  source/query model.
- Keep P0 query support small enough for robust diagnostics and GUI
  round-tripping.
- Leave room for future external render inputs without treating them as durable
  knowledge truth.
- Avoid executable scripts or arbitrary code in view definitions.

## Non-Goals

- P0 does not include a text query DSL.
- P0 does not support DataviewJS-style or trusted JavaScript queries.
- P0 does not implement full-text predicates, date comparisons, reference
  predicates, diagnostic filters, runtime temporary query controls, saved
  personal view controls, or cross-space table joins.
- P0 does not make graph a global special feature outside the view system.

## Current Starter-Kit Baseline

The current starter kit uses this shape:

```yaml
---
kind: view
title: Notes
description: Configured table view over notes.
mode: table
display:
    order: 30

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
        - field: fields.createdAt
          label: Created At

sort:
    - field: fields.createdAt
      direction: desc
---
# Notes

<!-- forma:content -->
```

Rules from the current baseline:

- `source.type` is the canonical field name.
- Ordinary projections use `source.type: pages`.
- The global graph view can use only `source.type: pages` with no taxonomy
  filter.
- Taxonomy filters use a map-to-list shape, even for one term.
- Predicate and display field references use `field`, not `target`.
- Table columns are objects so labels and future display options can be added
  without changing the column shape.
- Table and list sort stay view-level.
- Kanban columns may define local sort because each column is a separate result
  group.
- `sort.order` can define explicit enum order for fields such as priority.

The current examples use binding paths such as `fields.title`,
`fields.updatedAt`, and `fields.status`. These paths document the current
starter-kit baseline only. The full runtime object model still needs a separate
design pass during the backend and WebApp refactor.

## Proposed Architecture

### Source Before Query

View evaluation has two layers:

1. `source` selects candidate pages.
2. `query` filters normalized page records derived from those pages.

The older `source.kind: workspace` shape is superseded for the starter-kit
baseline. P0 implementation may still contain transitional code, but the target
configuration should use `source.type: pages`.

### Taxonomy Filters

The older direct `view.space` shorthand is superseded. A view scoped to starter
notes should filter through taxonomy membership:

```yaml
source:
    type: pages
    taxonomy:
        spaces:
            - notes
```

This avoids making `spaces` a built-in runtime concept. Other taxonomies can
use the same shape later.

### Query AST

The query model remains a structured AST with boolean composition. The starter
baseline uses `field` for leaf predicates:

```yaml
query:
    all:
        - field: fields.status
          op: equals
          value: todo
```

The semantics are:

- `all`: every child must match.
- `any`: at least one child must match; an empty `any` should be neutral only
  when the query node is otherwise empty by implementation convention.
- `not`: every child must not match.
- Leaf predicates use `field`, `op`, and optional `value`.

P0 supports these operators:

- `equals`
- `in`
- `contains`
- `exists`

Additional operators can be introduced later when runtime typing and
diagnostics justify them:

- `notEquals`
- `notIn`
- `notContains`
- `intersects`
- `before`
- `beforeOrEqual`
- `after`
- `afterOrEqual`

### Mode-Specific Query Use

List and table views use the top-level `query` as their candidate filter.

Kanban views first apply the top-level `query`, then evaluate
`kanban.columns[].query` in column order. The first matching column wins. Health
checks should warn about overlapping column queries and unmatched items.

Graph views use `source` and optional `query` to define the graph scope, but
their rendering semantics are graph-specific. A repository-wide graph is not a
cross-space table join.

Example global graph view:

```yaml
---
kind: view
title: Graph
description: Workspace page relationship graph.
mode: graph

source:
    type: pages
---
```

Graph should be opened through normal view navigation, tabs, or links. It is a
view mode, not a separate global product surface. Relationship panels may show
backlinks and outgoing links for the current page, but they are not the primary
graph surface.

## Interfaces And Contracts

`view.render` should evaluate:

- view parameters;
- page source filters;
- taxonomy filters;
- normalized-page query definitions;
- sort definitions;
- display fields;
- table configuration;
- kanban column configuration;
- render mount points.

The first public release does not require a committed persistent index. The
serve process can build the read model in memory and expose valid view metadata,
including page-source graph views without taxonomy filters.

`check` should report structured diagnostics for:

- unsupported `source.type`;
- invalid source globs;
- invalid query fields;
- unsupported operators;
- incompatible operator/value combinations;
- missing referenced spaces, fields, or parameters when the view requires
  them;
- invalid kanban column queries;
- overlapping or unmatched kanban items when enough information is available.

Invalid queries should produce diagnostics instead of panics or silent
misrendering.

## P0 Scope

P0 should implement the starter-kit baseline:

- `source.type: pages`;
- taxonomy filters using map-to-list values;
- `query.all`;
- `query.any`;
- `query.not`;
- `field` references over the currently supported starter bindings;
- operators `equals`, `in`, `contains`, and `exists`;
- table, list, kanban, and graph rendering over this model;
- graph view discovery without making graph a special built-in route.

## Later Scope

Later versions may add:

- text query DSL compiled into the same AST;
- reference-aware query targets;
- full-text search predicates;
- date and datetime comparisons;
- runtime temporary filters and advanced table controls;
- saved personal view controls;
- embedded view parameters;
- external source kinds;
- write-capable kanban actions.

## Related Documents

- [[product/product-direction]]
- [[product/forma-p0-starter-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-check-index-spec]]
- [[tasks/align-view-source-query-model]]
