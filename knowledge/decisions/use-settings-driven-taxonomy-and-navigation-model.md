---
scope: project
type: decision
owners: []
reviewers: []
tags:
    - architecture
    - configuration
    - taxonomy
    - navigation
supersedes:
    - "[[decisions/use-space-as-core-partition-model]]"
superseded_by: []
---

# Use Settings Driven Taxonomy And Navigation Model

## Context

Earlier Forma design treated `Space` as the core partition concept. That was a
useful simplification while removing the older `collection` terminology, but
the WebApp design review exposed a deeper issue: Pages, Spaces, Views,
Dashboard navigation, and graph projections should come from one explicit
configuration model rather than from several special built-in concepts.

Choral Forma should stay repository-native. A workspace should be understandable
from ordinary files plus one clear configuration entry, without hidden product
logic such as "Spaces always exist" or "Pages is always the global uncategorized
index".

## Decision

Use a settings-driven model centered on a repository-level `.forma.yml`
configuration entry.

`.forma/` remains only a recommended conventional directory for supporting
configuration, templates, view definitions, or assets. It is not a privileged
location by itself. Paths in `.forma.yml` are resolved from the directory that
contains `.forma.yml`, unless a field explicitly says otherwise.

The minimal built-in model is:

- **Page**: a renderable Markdown-backed knowledge entry.
- **Taxonomy**: a configured classification system over pages.
- **Term**: one value inside a taxonomy.
- **View**: a configured projection over pages, terms, references, or other
  derived read-model data.
- **Navigation**: configured groups and items that point to routes, pages,
  terms, or views.
- **Dashboard**: the workspace home route assembled from configured sections,
  not an ordinary page.

Taxonomies are user-configurable. A taxonomy can use:

- `mode: primary` when a page should have one main term for that taxonomy.
- `mode: multiple` when a page can belong to multiple terms.

The familiar "Spaces" experience should be produced by a configured primary
taxonomy, not by a unique hardcoded product concept. Starter workspaces may
configure a taxonomy named `spaces`, but the core should not require that exact
taxonomy.

Navigation groups should use one generic group mechanism. A group source can
read terms from a taxonomy or read saved views. If `include` is omitted, the
group includes all source items. If `include` is present, it includes only the
listed ids in that order. `exclude` can remove ids from the final set. Avoid
additional fields such as `all` or `pin` unless a future need cannot be
expressed by `include` and `exclude`.

Display concerns should use an explicit `display` object. The first supported
field is `display.order`; future `display.icon`, `display.color`, and
`display.title` can be added without changing the underlying model.

Templates and create behavior attach to taxonomy terms, page types, or other
explicit configuration nodes. They should not be implicitly tied to a unique
Space concept.

## Consequences

- The target configuration entry is `.forma.yml`, not a mandatory
  `.forma/settings.yml`.
- `.forma/` can still be used in examples and docs as a conventional support
  directory.
- `spaces.yml` becomes a transitional file in the current implementation, not
  the long-term configuration boundary.
- WebApp navigation should be generated from configuration rather than from
  hardcoded Dashboard, Pages, Spaces, and Views assumptions.
- Pages with no primary taxonomy term do not need a special built-in Inbox or
  Uncategorized term. They can be surfaced by a configured view or navigation
  group.
- Raw workspace serving should not expose hidden internal config by default.
  Public assets should live in ordinary public workspace paths such as
  `assets/logo.svg`, not under privileged internal config paths.
- The first public release can make breaking changes because no stable public
  config contract has shipped yet.

## Alternatives Considered

### Keep Space As The Core Built-In Partition

This is simpler but makes one taxonomy special forever. It also creates awkward
rules for unassigned pages, multi-space pages, and future taxonomy-like concepts
such as tags, categories, teams, or project areas.

### Make Spaces A Preset View Only

This removes one special concept, but a taxonomy is a better fit because Spaces
classify pages and can drive schema, creation, display, and navigation behavior.

### Use Hugo-Style Built-In Tags And Categories

Hugo is a useful reference for taxonomy behavior, but Choral Forma should not
ship built-in taxonomy names. Starter workspaces can provide common examples,
while the core stays generic.

### Put All Support Files Under `.forma/`

This keeps configuration tidy, but it makes `.forma/` a semi-hidden product
store. The preferred model is one explicit `.forma.yml` entry with ordinary
paths for assets and optional supporting files.

## Related Knowledge

- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-view-query-model]]
- [[product/product-direction]]
- [[product/forma-p0-starter-spec]]
