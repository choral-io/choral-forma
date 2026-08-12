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
status: doing
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
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

The 2026-08-12 follow-up completed the local WebApp and packaged VS Code performance loop, including 25-, approximately 500-, and approximately 5,000-node fixtures; first render, layout settle, longest task, reset responsiveness, 30-second idle samples, high-contrast, reduced-motion, and repeated disposal evidence. It also raised only the full-workspace VS Code command stdout budgets from 1 MiB to 8 MiB while keeping smaller calls at 1 MiB and stderr independently bounded at 64 KiB.

Local behavior is ready for review with two explicit Host boundaries: WebApp Worker settle and VS Code synchronous layout are measured separately, and VS Code `workbench.reduceMotion: on` did not propagate to the native Markdown Preview webview even though the shared runtime honored reduced motion when the media feature was present. Repeated VS Code Preview disposal released the iframe and all Forma lifecycle references, but Chromium retained collectible renderer memory until DevTools garbage collection; this Host high-water behavior remains a recorded performance risk rather than being reported as zero growth.

The task remains Doing because the approved Remote SSH host currently closes port `8022` before SSH key exchange; port `22` completes negotiation but rejects the available public key. No remote files or services were changed during this attempt, so there is nothing new to clean. The complete small- and large-fixture Remote interaction loop, exact-candidate push, and CI confirmation remain required before assigning the reviewer and moving the task to Reviewing. Full evidence is recorded in [[discovery/shared-graph-view-cross-host-parity-validation-2026-08-11]].
