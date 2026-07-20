---
schemaVersion: 1
kind: task
scope: project
title: Design Shared Graph View Renderer
summary: Define one meaningful, themed, accessible Graph renderer shared by the WebApp and editor extensions through thin Host adapters.
type: task
priority: P2
value: M
module: app
effort: L
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - graph
    - vscode
    - webapp
    - shared-renderer
    - design
blockedBy: []
relatedTo:
    - "design/editor-extension-mvp-design"
    - "architecture/editor-extension-adapter-contract"
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/generalize-taxonomy-neutral-page-model"
    - "tasks/implement-vscode-extension-mvp"
    - "tasks/implement-shared-graph-view-runtime"
    - "tasks/integrate-shared-graph-view-vscode-preview"
    - "tasks/migrate-webapp-to-shared-graph-view"
    - "tasks/validate-shared-graph-view-cross-host-parity"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Shared Graph View renderer, WebApp adapter, and editor-extension adapters
---

# Design Shared Graph View Renderer

## Goal

Treat Graph as a focused product and technical project implemented once for consistent WebApp and editor-extension behavior, with Host-adapted theme, navigation, active-document, persistence, and lifecycle integration.

## Sources

- [[design/editor-extension-mvp-design]]
- [[architecture/editor-extension-adapter-contract]]
- [[decisions/editor-extension-primary-product-surface]]
- [[discovery/editor-graph-view-technical-research-2026-07-17]]
- [[tasks/generalize-taxonomy-neutral-page-model]]

## In Scope

- Gather concrete feedback on the current fixed-circle WebApp graph and Alpha 13 deferred state.
- Define graph exploration journeys, density thresholds, layouts, selection, filters, source navigation, theme, contrast, keyboard, and reduced-motion requirements.
- Build a Sigma vertical slice and compare at least two Graphology layout approaches using the same fixtures.
- Define `packages/graph-view` as the required framework- and Host-neutral implementation package.
- Evaluate deterministic placement, refresh stability, performance, bundle cost, accessibility, host-theme integration, and maintenance burden.
- Validate persistent single selection, one-hop emphasis, active-document following, directed and reciprocal edges, source navigation, and richer semantic node styling.
- Define the renderer-neutral boundary needed by later frontmatter-driven groups, filters, and an optional 3D renderer.
- Define thin React and native Markdown Preview adapters that cannot reimplement renderer state or Sigma reducers.
- Record layout evidence and any reason to activate a fallback renderer before production implementation.
- Split implementation and validation follow-up tasks.

## Out Of Scope

- Alpha 13 release.
- Editable graph relationships.
- Persisting graph coordinates into Markdown or Forma configuration.
- Frontmatter-driven group and filter controls in the first vertical slice.
- A production 3D renderer.

## Acceptance Criteria

- User dissatisfaction and target experience are expressed as observable criteria.
- Sigma is validated as the 2D renderer with shared small, medium, and large fixtures.
- WebApp and VS Code consume the same shared Graph package, state controller, layout, node and edge programs, and presentation rules.
- Host-specific code is limited to theme mapping, navigation, active-document discovery, persistence, and lifecycle wiring.
- At least two Graphology layout approaches are compared with shared fixtures.
- Single click selects; selected and directly connected nodes and edges are emphasized; unrelated elements are de-emphasized.
- The Graph follows an applicable active managed document and otherwise fits the full graph without selection.
- Unidirectional and reciprocal references are visually unambiguous.
- Node size and color are semantic, independently configurable renderer channels rather than hard-coded taxonomy behavior.
- A layout direction is accepted with evidence or the task records why no option is ready.
- Follow-up tasks have explicit accessibility, theme, performance, and source-navigation acceptance criteria.

## Research Direction

The 2026-07-17 technical assessment accepts Sigma.js plus Graphology as the 2D production direction because Forma already uses Sigma and the fixed-circle layout, rather than the renderer, is the main current limitation. The spike should compare ForceAtlas2 worker and Graphology's simpler force layout rather than pay for a second full renderer prototype. Foam's `force-graph` approach remains a fallback only if Sigma misses an accepted requirement.

The spike can continue with renderer-neutral fixtures and interfaces. Production integration must consume the taxonomy-neutral Page model and must not extend the current `GraphRenderNode.space` compatibility field or introduce special behavior for any taxonomy id. Frontmatter-defined groups and filters are a follow-up over Forma's generic query model. A 3D renderer is a later opt-in, lazily loaded experiment over the same projection and state, not part of the first production acceptance criteria.

## Delivery Slices

1. [[tasks/implement-shared-graph-view-runtime]] owns the framework-neutral package, fixtures, controller, Sigma programs, layout, theme roles, and shared interaction behavior.
2. [[tasks/migrate-webapp-to-shared-graph-view]] removes the package-local WebApp renderer and adds a thin React Host adapter.
3. [[tasks/integrate-shared-graph-view-vscode-preview]] adds the native Preview browser bundle and VS Code Host adapter.
4. [[tasks/validate-shared-graph-view-cross-host-parity]] proves behavior, theme adaptation, lifecycle, accessibility, performance, and packaged integration across both Hosts before the milestone push.

## Result

The design phase accepted Sigma.js plus Graphology as Forma's shared 2D Graph direction and established `packages/graph-view` as the only owner of layout, interaction state, node and edge programs, presentation rules, fixtures, and renderer lifecycle. The comparison retained Graphology's simple force layout for small graphs and bounded ForceAtlas2 plus Worker settling for larger graphs, with deterministic placement and reduced-motion behavior defined as shared runtime concerns.

The accepted interaction model separates single-click selection from source activation, keeps one-hop emphasis and active-document following consistent across Hosts, renders directed and reciprocal relationships explicitly, and exposes node size, color, outline, shape or icon, and label density as renderer-neutral semantic channels. Thin WebApp and native Markdown Preview adapters own only Host theme translation, navigation, active-document discovery, persistence, mounting, and disposal.

The planned delivery slices were created and executed: the shared runtime and WebApp migration are complete, VS Code Preview integration is in review, and cross-Host validation remains active. Remote Extension Host validation, live high-contrast sessions, long-running resource profiling, and full 25/500/5,000-node render measurements belong to [[tasks/validate-shared-graph-view-cross-host-parity]] rather than keeping this design task open. Frontmatter-defined groups and filters and any optional 3D renderer remain explicit follow-up scope.
