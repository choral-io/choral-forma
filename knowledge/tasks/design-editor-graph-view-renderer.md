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
- Build comparable prototypes for at least two renderer/layout approaches using the same fixtures.
- Evaluate deterministic placement, refresh stability, performance, bundle cost, accessibility, host-theme integration, and maintenance burden.
- Record the selected approach and rejected alternatives before production implementation.
- Split implementation and validation follow-up tasks.

## Out Of Scope

- Alpha 13 release.
- Editable graph relationships.
- Persisting graph coordinates into Markdown or Forma configuration.

## Acceptance Criteria

- User dissatisfaction and target experience are expressed as observable criteria.
- At least two renderer approaches are compared with shared fixtures.
- A renderer and layout direction are accepted with evidence or the task records why no option is ready.
- Follow-up tasks have explicit accessibility, theme, performance, and source-navigation acceptance criteria.

## Research Direction

The 2026-07-17 technical assessment selects Sigma.js plus Graphology ForceAtlas2 and Foam's `force-graph` approach as the two required comparison prototypes. Sigma plus a worker layout is the provisional production direction because Forma already uses Sigma and the fixed-circle layout, rather than the renderer, is the main current limitation.

The spike can continue with renderer-neutral fixtures and interfaces. Production integration must consume the taxonomy-neutral Page model and must not extend the current `GraphRenderNode.space` compatibility field or introduce special behavior for any taxonomy id.
