---
schemaVersion: 1
kind: task
scope: project
title: Migrate WebApp To Shared Graph View
summary: Replace the WebApp-local Sigma renderer with a thin React Host adapter over the shared Graph View runtime.
type: task
priority: P1
value: H
module: app
effort: S
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - graph
    - webapp
    - shared-renderer
blockedBy: []
relatedTo:
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/design-editor-graph-view-renderer"
    - "tasks/validate-shared-graph-view-cross-host-parity"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: WebApp Graph route, React adapter, routing, theme mapping, and lazy loading
---

# Migrate WebApp To Shared Graph View

## Goal

Remove the independent WebApp Graph behavior and consume `packages/graph-view` through a thin React adapter.

## Sources

- [[discovery/editor-graph-view-technical-research-2026-07-17]]
- [[tasks/implement-shared-graph-view-runtime]]
- [[design/webapp-v2-dashboard-design]]
- [[architecture/webapp-v2-read-model-contract]]

## In Scope

- Replace the current `ViewGraphProjection` graph construction and reducers with mount, update, and destroy calls to the shared runtime.
- Map the active WebApp Page or route to shared `activeNodeId` input.
- Delegate node source activation to React Router without moving navigation logic into the shared package.
- Map WebApp theme values to the shared semantic Graph theme roles and propagate live theme changes.
- Preserve WebApp empty, invalid, loading, and route error states.
- Lazy-load the shared Graph runtime on Graph View routes and remove duplicate direct renderer dependencies where possible.
- Add focused React adapter and route integration tests.

## Out Of Scope

- WebApp-specific graph reducers, layouts, color hashing, or interaction behavior.
- Changing Forma Core query or reference semantics.
- Frontmatter-defined groups and filters.
- A WebApp-only 3D mode.

## Acceptance Criteria

- The WebApp does not construct a Sigma graph or implement Graph selection, layout, node, edge, or presentation reducers outside `packages/graph-view`.
- The React adapter owns only mounting, updates, routing, active-Page input, theme translation, and lifecycle cleanup.
- WebApp selection, one-hop emphasis, arrows, node sizing, labels, and reset behavior match the shared fixtures.
- Live light and dark theme changes update semantic colors without recreating product-specific renderer behavior.
- Graph route code is lazy-loaded and does not regress non-Graph route bundle behavior.
- Existing WebApp navigation, empty, invalid, and disposal tests pass locally.

## Result

The WebApp Graph route now uses a thin React adapter over `@choral-forma/graph-view`. The adapter maps the RPC projection into taxonomy-neutral shared nodes and semantic edges, passes the active route as `activeNodeId`, delegates source activation to React Router, translates live WebApp theme roles, and owns only mount, update, and destroy lifecycle calls.

The Graph projection is lazy-loaded from `DashboardHome`; WebApp no longer directly depends on or constructs Graphology or Sigma objects. The refreshed Alpha 20 Graph route chunk is 203.41 kB, or 51.15 kB gzip, while non-Graph routes do not load it.

The WebApp View route now preserves the complete source-backed View document contract instead of mapping only `result.render`. It renders Markdown before and after the Core-provided `<!-- forma:content -->` mount and appends the projection after the body when no mount is present, matching the VS Code source-first View behavior.

Local validation refreshed on 2026-07-19:

- `CI=true mise run check` passes; the workspace Vitest run reports 200 passing tests.
- Focused shared Graph tests report 33 passing tests, including bounded Worker settling and disposal.
- Browser validation against the example and project Workspace Graphs confirms responsive light and dark rendering, single-click selection with one-hop emphasis, fit behavior, page-contained expansion, taxonomy-driven colors, and readable selected-node summaries. The intentionally removed duplicate node-search list is no longer treated as an accessibility requirement.
- A focused RPC-adapter test covers explicit and missing content mounts, and a running-browser DOM assertion confirms the Release Scope source body appears before its table projection.
- Forma workspace health reports no errors and only the three pre-existing release backlink warnings.
