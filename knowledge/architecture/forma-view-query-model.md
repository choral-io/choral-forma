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

Forma views are managed Markdown definitions under `.forma/views/**/*.md`.
They render structured knowledge from repository-backed Markdown files without
turning view definitions into ordinary domain notes.

The initial design previously leaned toward collection-bound views. The
accepted model is broader: a view starts from a workspace data source, narrows
candidate files with `source`, then filters normalized entry records with
`query`. A space view is a common shortcut, not a separate source model.

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

## Proposed Architecture

### Source Before Query

View evaluation has two layers:

1. `source` selects candidate files.
2. `query` filters normalized entry records derived from those files.

`source.kind: workspace` is the only P0 source kind. It reads Markdown files
from the current Forma workspace and may use `include` and `exclude` globs:

```yaml
view:
    source:
        kind: workspace
        include:
            - "**/*.md"
        exclude:
            - ".forma/**"
            - "**/local/**"
```

The `source.kind` field is intentionally explicit. P0 implements only
`workspace`, but the shape leaves room for future external render inputs. Those
future inputs should be treated as view inputs, not as durable workspace truth,
unless a separate import or promotion flow writes them into repository files.

### Space Shorthand

The direct `view.space` field remains valid because it is readable and
useful for starter views:

```yaml
view:
    surface: page
    mode: table
    space: todos
```

It is equivalent to a workspace-source query over the normalized
`entry.space` field:

```yaml
view:
    surface: page
    mode: table
    source:
        kind: workspace
    query:
        all:
            - target: entry.space
              op: equals
              value: todos
```

Runtime behavior should treat `space` as an additional filter. It should
not prevent graph views, file navigation views, or uncatalogued-document views
from using the same workspace source model.

### Normalized Entry Record

Queries operate on normalized entry records, not directly on raw Markdown text.
The exact internal representation can evolve, but the stable conceptual shape
is:

```ts
entry = {
    path: "todos/review-webapp.md",
    space: "todos" | null,
    kind: "todo" | null,
    title: "Review WebApp" | null,
    frontmatter: {},
    refs: {},
    text: {},
};
```

The stable P0 target namespaces are:

- `entry.space`
- `entry.path`
- `entry.kind`
- `entry.title`
- `frontmatter.<field>`

Future targets such as `refs.*`, `text.*`, `diagnostics.*`, or derived fields
should be added only after their data shape and diagnostics are clear.

### Query AST

The query model is a structured AST with boolean composition:

```yaml
query:
    all:
        - target: entry.space
          op: equals
          value: todos
        - any:
              - target: frontmatter.status
                op: equals
                value: todo
              - target: frontmatter.status
                op: equals
                value: doing
        - not:
              - target: frontmatter.archived
                op: equals
                value: true
```

The semantics are:

- `all`: every child must match.
- `any`: at least one child must match; an empty `any` should be neutral only
  when the query node is otherwise empty by implementation convention.
- `not`: every child must not match.
- Leaf predicates use `target`, `op`, and optional `value`.

P0 supports these operators:

- `equals`
- `in`
- `contains`
- `exists`

`exists` uses an explicit boolean value. Missing fields are represented without
a special `missing` operator:

```yaml
query:
    all:
        - target: entry.space
          op: exists
          value: false
```

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

List and table views use the top-level `view.query` as their candidate filter.

Kanban views first apply the top-level `view.query`, then evaluate
`kanban.columns[].query` in column order. The first matching column wins. Health
checks should warn about overlapping column queries and unmatched items.

Graph views use `source` and optional `query` to define the graph scope, but
their rendering semantics are graph-specific. A repository-wide graph is not a
cross-space table join.

Example global graph view:

```yaml
view:
    surface: page
    mode: graph
    title: Knowledge Graph
    source:
        kind: workspace
        include:
            - "**/*.md"
        exclude:
            - ".forma/**"
            - "**/local/**"
```

Graph should be opened through normal view navigation, tabs, or links. It is a
view mode, not a separate global product surface. Relationship panels may show
backlinks, outgoing links, and mentions for the current document, but they are
not the primary graph surface.

## Interfaces And Contracts

`view.render` should evaluate:

- view parameters;
- workspace source filters;
- space shorthand;
- normalized-entry query definitions;
- sort definitions;
- display fields;
- table configuration;
- kanban column configuration;
- render mount points.

`index.rebuild` should include valid view metadata in
`.forma/index.summary.json`, including workspace-source graph views without a
space filter. The index should not persist rendered query results.

`check` should report structured diagnostics for:

- unsupported `source.kind`;
- invalid source globs;
- invalid query targets;
- unsupported operators;
- incompatible operator/value combinations;
- missing referenced spaces, fields, or parameters when the view requires
  them;
- invalid kanban column queries;
- overlapping or unmatched kanban items when enough information is available.

Invalid queries should produce diagnostics instead of panics or silent
misrendering.

## P0 Scope

P0 implements:

- `source.kind: workspace`;
- `source.include`;
- `source.exclude`;
- `query.all`;
- `query.any`;
- `query.not`;
- targets `entry.space`, `entry.path`, `entry.kind`, `entry.title`, and
  `frontmatter.<field>`;
- operators `equals`, `in`, `contains`, and `exists`;
- `view.space` as shorthand for `entry.space`;
- table and kanban rendering over this model;
- graph view discovery and indexing, but not necessarily interactive graph
  rendering.

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
