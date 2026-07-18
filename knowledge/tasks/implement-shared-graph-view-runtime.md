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
status: ready
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
- Node size, color role, outline, label visibility, and edge emphasis are semantic shared rules rather than Host-specific reducers.
- The runtime ignores the compatibility `GraphRenderNode.space` field and introduces no special behavior for any taxonomy id.
- Renderer, Worker, observer, timer, and listener resources are released by `destroy` and covered by focused tests.
- Package checks, deterministic fixture tests, and bundle-cost evidence pass locally.
