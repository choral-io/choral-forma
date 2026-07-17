---
schemaVersion: 1
kind: task
scope: project
title: Design editor Graph View renderer
summary: Run a focused post-Alpha-13 design and renderer evaluation for meaningful, themed, accessible knowledge graph exploration.
type: task
priority: P2
value: M
module: app
effort: L
status: backlog
readiness: needs-refinement
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - graph
    - vscode
    - design
blockedBy: []
relatedTo:
    - "design/editor-extension-mvp-design"
    - "architecture/editor-extension-adapter-contract"
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/generalize-taxonomy-neutral-page-model"
    - "tasks/implement-vscode-extension-mvp"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Editor Graph View design and renderer selection
---

# Design Editor Graph View Renderer

## Goal

Treat Graph as a focused product and technical project after the first extension release instead of carrying forward the current WebApp renderer by default.

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
- Evaluate deterministic placement, refresh stability, performance, bundle cost, accessibility, host-theme integration, and maintenance burden.
- Validate persistent single selection, one-hop emphasis, active-document following, directed and reciprocal edges, source navigation, and richer semantic node styling.
- Define the renderer-neutral boundary needed by later frontmatter-driven groups, filters, and an optional 3D renderer.
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
