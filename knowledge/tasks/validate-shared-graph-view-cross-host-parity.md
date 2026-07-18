---
schemaVersion: 1
kind: task
scope: project
title: Validate Shared Graph View Cross-Host Parity
summary: Prove that WebApp and VS Code use the same Graph behavior and presentation semantics while adapting themes, navigation, and lifecycle to each Host.
type: task
priority: P1
value: H
module: app
effort: M
status: backlog
readiness: blocked
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - graph
    - vscode
    - webapp
    - validation
    - performance
blockedBy:
    - "tasks/integrate-shared-graph-view-vscode-preview"
    - "tasks/migrate-webapp-to-shared-graph-view"
relatedTo:
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/design-editor-graph-view-renderer"
    - "tasks/implement-shared-graph-view-runtime"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Cross-Host Graph behavior, visual semantics, accessibility, performance, packaging, and milestone gate
---

# Validate Shared Graph View Cross-Host Parity

## Goal

Establish evidence that the WebApp and VS Code Graph surfaces share one implementation and produce consistent behavior and visual semantics under Host-specific themes and navigation.

## Sources

- [[discovery/editor-graph-view-technical-research-2026-07-17]]
- [[tasks/implement-shared-graph-view-runtime]]
- [[tasks/migrate-webapp-to-shared-graph-view]]
- [[tasks/integrate-shared-graph-view-vscode-preview]]

## In Scope

- Run the same empty, small, medium, and large projection fixtures through WebApp and VS Code adapters.
- Compare normalized node attributes, edge programs, selected and neighbor state, labels, viewport actions, and source-activation outcomes.
- Validate light, dark, high-contrast where supported, reduced motion, long labels, reciprocal references, unresolved targets, and empty graphs.
- Measure bundle delta, projection size, first meaningful render, layout settle time, longest main-thread task, interaction responsiveness, refresh movement, idle CPU, and retained memory after disposal.
- Exercise 25-node, approximately 500-node, and approximately 5,000-node fixtures.
- Run real WebApp, packaged VSIX, Preview reload, extension restart, and Remote validation.
- Record discrepancies as shared-runtime defects or explicit Host-adapter differences rather than silently accepting divergent implementations.

## Out Of Scope

- Pixel-identical colors, fonts, borders, or focus styling across different Host themes.
- Frontmatter-defined groups and filters.
- A production 3D renderer.
- Editable graph relationships.

## Acceptance Criteria

- Both Hosts use `packages/graph-view`; no duplicate Host-specific Sigma construction, layout, reducers, or Graph state remains.
- The same projection and presentation configuration produce equivalent normalized layout, node sizing, edge direction, label policy, selection, one-hop emphasis, and reset behavior.
- Theme differences are traceable only to explicit Host semantic-token mappings.
- Source navigation, active-document following, reload, and disposal work according to each Host adapter contract.
- The accessible companion surface exposes searchable nodes, selected-node details, incoming and outgoing neighbors, and a graph-size summary in both Hosts; filter summaries become required when filters are implemented.
- Medium and large fixtures remain responsive within recorded budgets, layout work is bounded, and idle graphs do not consume continuous CPU after settling.
- WebApp checks, VS Code package and integration checks, shared package tests, performance evidence, and the milestone local validation gate pass before push and CI.
