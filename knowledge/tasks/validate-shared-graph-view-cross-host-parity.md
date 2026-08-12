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
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers:
    - "members/tiscs"
tags:
    - forma
    - graph
    - vscode
    - webapp
    - validation
    - performance
blockedBy: []
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
- The text legend exposes configured taxonomy and Term identities, while the accessible selected-node summary exposes the active Page identity, path, and relationship count in both Hosts without duplicating the complete searchable node collection. Filter summaries become required when filters are implemented.
- Medium and large fixtures remain responsive within recorded budgets, layout work is bounded, and idle graphs do not consume continuous CPU after settling.
- WebApp checks, VS Code package and integration checks, shared package tests, performance evidence, and the milestone local validation gate pass before push and CI.

## Result

The 2026-08-11 validation iteration strengthened shared fixtures and adapter coverage, passed the packaged local VSIX smoke, and rendered the real workspace Graph through an ARM64 Dev Container Remote Extension Host. The x64 Remote SSH path reached `Forma: Ready` and passed direct CLI workspace and Graph rendering, but its native Markdown Preview remained blank and the following small-fixture reconnect failed dynamic port forwarding on the 1 vCPU, 967 MiB host.

The task therefore remains Doing. Live high-contrast and reduced-motion sessions, browser render and interaction timing, long-running retained-memory and idle-CPU profiling, and a stable Remote SSH Graph Preview remain open. Full evidence, benchmark interpretation, the explicit WebApp Worker versus VS Code synchronous-layout boundary, and environment cleanup are recorded in [[discovery/shared-graph-view-cross-host-parity-validation-2026-08-11]].
