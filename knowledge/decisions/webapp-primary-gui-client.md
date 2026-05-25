---
scope: project
type: decision
owners:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - product
    - architecture
    - webapp
    - gui
supersedes: []
superseded_by: []
---

# WebApp Primary GUI Client

## Context

Choral Forma P0 established a local service, CLI operations, JSON-RPC over
HTTP, and a read-only WebApp for repository-backed Markdown workspaces. After
the first internal-test release, the next product direction needs a clear main
surface before adding editor extensions.

Two directions were considered:

- Build VS Code and Zed extensions first, with the WebApp as a fallback GUI.
- Treat the WebApp as the primary GUI client, then derive CLI/RPC backend
  capabilities from WebApp workflows; editor extensions become later adapters.

The product goal remains editor-independent repository-backed knowledge. Forma
should not depend on any single editor plugin as the source of truth.

## Decision

The WebApp is the primary GUI client for P1 product development.

CLI commands and local HTTP RPC are the backend capability layer for the WebApp.
When a WebApp workflow needs structured data, previews, diagnostics, graph data,
search, dry-runs, proposals, or apply gates, Forma should add or refine shared
operations rather than duplicating behavior in frontend code.

VS Code and Zed extensions are deferred until the WebApp product loop is more
complete. Future editor extensions should act as adapters over Forma RPC and the
primary WebApp, not as separate full GUI implementations.

## Consequences

- P1 planning should start from GUI user journeys, then derive operation and CLI
  requirements.
- The WebApp should become a complete read-oriented knowledge client: workspace
  overview, navigation, views, diagnostics, graph, search, proposals, and AI
  assistance surfaces.
- "Read-only" means repository facts are not silently mutated. Interactive GUI
  actions may create proposed operations, dry-runs, plans, or reviewable change
  proposals, but applying changes requires an explicit approved write path.
- Drag-and-drop kanban, predefined action buttons, and AI Chat must not directly
  rewrite repository files until the reviewable operation proposal and approved
  apply model exists.
- CLI and RPC operations should remain the shared contract for WebApp, Agents,
  scripts, and future editor extensions.
- VS Code and Zed work should wait until there is a stable adapter contract and
  enough WebApp behavior to bridge to.

## Alternatives Considered

### Editor Extensions First

This would make writing workflows feel closer to existing editor use. It was
rejected as the main P1 path because it would split product behavior across
editor APIs and weaken the editor-independent product surface.

### WebApp As Fallback Only

This would minimize WebApp investment, but it would leave graph, health,
proposal review, and AI-assisted workflows without a controlled product home.

### WebApp Primary GUI

This is accepted because it keeps product behavior centralized while preserving
direct Markdown and editor access.

## Related Knowledge

- [[product/choral-forma]]
- [[product/product-direction]]
- [[architecture/forma-core-technical-direction]]
- [[decisions/forma-p0-core-architecture]]
- [[planning/webapp-primary-gui-roadmap]]

## Related Tasks

- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[tasks/expose-read-only-knowledge-health-in-webapp]]
- [[tasks/implement-interactive-graph-view-render]]
- [[tasks/implement-quick-switcher-search]]
- [[tasks/design-reviewable-operation-proposal-flow]]
- [[tasks/design-ai-chat-interaction-model]]
- [[tasks/design-editor-extension-adapter-contract]]
- [[tasks/implement-vscode-extension-mvp]]
- [[tasks/implement-zed-extension-mvp]]
