---
scope: member
type: handoff
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - workspace
    - handoff
    - forma
    - starter-kit
    - refactor
---

# Forma Starter Kit To System Refactor

## Purpose

Hand off the next phase of Choral Forma work: stabilize `examples/getting-started-workspace/` as the user-facing configuration and content baseline, then refactor backend, WebApp contracts, and documentation backward from that baseline.

This handoff is execution context. Canonical product and architecture documents remain the source of truth when they are updated.

## Source Context

Relevant knowledge:

- [Settings-driven taxonomy decision](../../../decisions/use-settings-driven-taxonomy-and-navigation-model.md)
- [Forma P0 starter specification](../../../product/forma-p0-starter-spec.md)
- [Forma view query model](../../../architecture/forma-view-query-model.md)
- [WebApp V2 read model contract](../../../architecture/webapp-v2-read-model-contract.md)

Relevant example workspace:

- `examples/getting-started-workspace/.forma.md`
- `examples/getting-started-workspace/.forma/dashboard.md`
- `examples/getting-started-workspace/.forma/spaces/index.md`
- `examples/getting-started-workspace/.forma/spaces/*.md`
- `examples/getting-started-workspace/.forma/views/*.md`
- `examples/getting-started-workspace/.forma/spaces/templates/*.md`
- `examples/getting-started-workspace/README.md`

## Materials

The starter kit currently demonstrates:

- `.forma.md` as the main configuration entry.
- `.forma/` as a conventional support directory, not a privileged root.
- Markdown configuration nodes whose frontmatter is configuration and whose body is the render template.
- `<!-- forma:content -->` as the generated-content slot.
- A `spaces` taxonomy configured by `.forma/spaces/index.md` and term nodes.
- Views configured with `source.type: pages`.
- Taxonomy filters using map-to-list values.
- Table column objects.
- View-level sort and kanban column-level sort.
- Create templates using `!expr input.*` in frontmatter and `{{ input.* }}` in Markdown body.
- Multilingual variants using `zh-Hans` in config and `.zh-hans.md` filename suffixes.
- Public assets in ordinary `assets/`, not under `.forma/`.

## Actions Taken

- Removed the old `collection` direction from the product discussion.
- Changed visible product terminology from Documents/Entries toward Pages.
- Moved the example workspace toward a user-facing starter guide instead of a test fixture.
- Removed `navigation.yml` from the starter configuration direction.
- Removed the committed-index requirement from the first public release direction.
- Chose not to record a final runtime object model yet. Current `fields.*`, `source.*`, and taxonomy binding paths are only starter-kit baseline usage.

## Decisions Made

- Product code should not contain mock-data switches. Demonstrations should run the backend against a real example workspace.
- The first public release should not require users to maintain a persistent index file.
- Navigation is a WebApp concern derived from routes and read-model data, not a service-side `navigation.yml` contract.
- `spaces` is a configured taxonomy in the starter kit, not a built-in product primitive.
- `source.type` is the target view source field name; `source.kind` is transitional old design.
- Query predicates should use `field`, not `target`.
- `runtime.values.currentDate` should not be part of the current starter baseline.

## Missing Information

- The final runtime object model still needs a focused design pass.
- Backend data structures and RPC names still lag behind the starter-kit baseline.
- WebApp route names and sidebar active-state rules need to be reconciled with Pages, taxonomies, and views.
- Template expression evaluation has an accepted initial syntax, but the exact evaluator implementation and diagnostics still need design and tests.
- Multilingual variant discovery needs backend implementation and diagnostics.

## Risks

- Older documents and implementation may still mention `Documents`, `Entries`, `collection`, `source.kind`, `frontmatter.*`, `target`, `navigation.yml`, or persistent index files.
- Treating the current binding paths as a final runtime object model would freeze a design that the project owner explicitly wants to revisit.
- Refactoring backend and WebApp independently from the starter kit could recreate hidden product logic that the configuration model is trying to remove.

## Next Action

Use the starter kit as the baseline and create an implementation plan that updates the backend configuration loader, read model, WebApp contracts, and route/rendering code in one coherent pass.

## Acceptance Criteria

This handoff is complete when the next phase has:

- a reviewed implementation plan;
- backend config/read-model changes aligned with the starter kit;
- WebApp route and read-model changes aligned with the starter kit;
- stale terminology and old config shapes removed from implementation;
- validation against `examples/getting-started-workspace/`.

## Response

Pending.
