---
schemaVersion: 1
kind: task
scope: project
title: Implement Shared Graph View Runtime
summary: Build the Host-neutral Sigma and Graphology runtime that defines consistent Graph layout, interaction, and presentation behavior for WebApp and editor adapters.
type: task
priority: P1
value: H
module: app
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - graph
    - shared-renderer
    - sigma
    - graphology
blockedBy: []
relatedTo:
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/design-editor-graph-view-renderer"
    - "tasks/generalize-taxonomy-neutral-page-model"
    - "tasks/implement-interactive-graph-view-render"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Shared Graph View package, renderer state, layout, presentation, and fixtures
---

# Implement Shared Graph View Runtime

## Goal

Create `packages/graph-view` as the single framework- and Host-neutral implementation used by the WebApp and editor extensions.

## Sources

- [[discovery/editor-graph-view-technical-research-2026-07-17]]
- [[tasks/design-editor-graph-view-renderer]]
- [[tasks/generalize-taxonomy-neutral-page-model]]

## In Scope

- Define the public projection, presentation, theme-role, external active-node, navigation-callback, update, and disposal contracts.
- Implement graph construction, persistent single selection, one-hop emphasis, stage reset, and external active-document following.
- Implement directed and reciprocal edge programs while preserving underlying semantic edges for details.
- Implement bounded degree-based node sizing, adaptive labels, semantic visual roles, and non-color selection signals.
- Compare deterministic ForceAtlas2 and the simpler Graphology force layout on shared small and medium fixtures.
- Use deterministic initial placement, bounded settling, coordinate reuse where available, reduced-motion behavior, and complete renderer and Worker disposal.
- Add empty, small, medium, and large deterministic fixtures and focused unit or browser-runtime tests.
- Keep the public API independent of React, React Router, VS Code, WebApp theme context, and Sigma instance escape hatches.

## Out Of Scope

- WebApp routing or React lifecycle integration.
- VS Code native Preview bundling or active-editor discovery.
- Frontmatter-defined groups and filters.
- A production 3D renderer.
- Final taxonomy-driven styling.

## Acceptance Criteria

- `packages/graph-view` is the only owner of Sigma graph construction, layout, reducers, node and edge programs, and Graph interaction state.
- The same projection and presentation inputs produce deterministic normalized node, edge, selection, and layout state.
- Single click selects without navigating; the selected node, direct neighbors, and connecting edges are emphasized while unrelated elements are de-emphasized.
- External `activeNodeId` updates select and center an applicable node; an absent or inapplicable active node falls back to an unselected fit-to-graph state.
- Single-direction edges show one arrow and reciprocal references show an unambiguous two-direction treatment without discarding semantic edge details.
- Node size, color role, focus halo, label visibility, label surface, and edge emphasis are semantic shared rules rather than Host-specific reducers.
- The runtime ignores the compatibility `GraphRenderNode.space` field and introduces no special behavior for any taxonomy id.
- Renderer, Worker, observer, timer, and listener resources are released by `destroy` and covered by focused tests.
- Package checks, deterministic fixture tests, and bundle-cost evidence pass locally.

## Result

Implemented `packages/graph-view` as the Host-neutral owner of Graphology construction, deterministic layout seeding, bounded settling, Sigma programs, selection state, presentation reducers, active-document following, navigation callbacks, and disposal.

The public API exposes Forma projection, theme, presentation, update, snapshot, navigation, fit, and destroy contracts without exposing Sigma or Graphology instances. Single-click selection, one-hop emphasis, separate double-click or Enter activation, reciprocal edge aggregation, adaptive labels, bounded logarithmic node sizing, stage reset, coordinate reuse, reduced-motion behavior, and taxonomy-neutral node handling are covered by focused tests.

Layout behavior uses the simple Graphology force layout for up to 64 nodes. Larger graphs use ForceAtlas2; graphs above 2,000 nodes skip synchronous ForceAtlas2 work and move directly from deterministic placement to the bounded Worker session. The Worker, renderer, resize observer, animation frame, timer, and keyboard listener all have explicit idempotent disposal paths.

Local validation refreshed on 2026-07-19:

- `CI=true mise run check` passes across TypeScript, Rust, WebApp, VS Code, and Zed validation; the workspace Vitest run reports 200 passing tests.
- `pnpm --filter @choral-forma/graph-view test` reports 33 passing focused tests.
- Deterministic layout benchmark means are approximately 0.41 ms for 25 nodes and 50 edges, 15.67 ms for the 500-node and 1,500-edge synchronous ForceAtlas2 seed, and 21.54 ms for constructing the deterministic 5,000-node and 15,000-edge Worker seed without a synchronous large-graph simulation.
- The package-owned ESM output is 32.48 kB, or 8.48 kB gzip, with runtime dependencies left to Host bundlers.
