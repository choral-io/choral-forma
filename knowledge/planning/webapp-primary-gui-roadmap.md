---
scope: project
type: roadmap
owners:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - forma
    - p1
    - webapp
    - gui
    - roadmap
sources:
    - "[[decisions/webapp-primary-gui-client]]"
    - "[[product/choral-forma]]"
    - "[[product/product-direction]]"
    - "[[architecture/forma-core-technical-direction]]"
    - "[[planning/KANBAN]]"
---

# WebApp Primary GUI Roadmap

## Goal

Plan P1 around the WebApp as Choral Forma's primary GUI client. Start from user
journeys in the GUI, then derive the CLI and RPC backend capabilities needed to
support those journeys.

## Product Shape

The WebApp should become a complete read-oriented knowledge client for local
repository workspaces:

- workspace overview and navigation;
- space, file, view, and resource browsing;
- rendered Markdown and source preview;
- reference navigation and graph views;
- diagnostics and knowledge health;
- quick switching and lightweight entry search;
- reviewable operation proposals and dry-run previews;
- AI Chat for explanation, planning, proposal drafting, and guided maintenance.

The WebApp should not become a full Markdown editor. Existing editors remain the
primary text editing surface. WebApp interactions that would change repository
facts must route through proposed operations, dry-runs, reviewable changes, and
explicit apply gates.

## Backend Derivation Rule

When a GUI workflow needs new data or behavior, define the product interaction
first, then add the smallest shared operation needed by CLI/RPC:

```text
GUI workflow
-> required structured state or action
-> shared operation/RPC contract
-> CLI exposure only when script or human terminal use needs it
```

The WebApp must not re-scan raw Markdown, infer health rules, or duplicate core
semantics that belong in shared Forma operations.

## Sequencing

1. Reinitialize the WebApp V2 dashboard shell from the P0 cutline, using
   WebApp-local Tailwind CSS, shadcn/ui, Base UI, and fake workspace data.
2. Validate the V2 dashboard layout in the in-app browser before reconnecting
   real RPC data.
3. Reconnect the dashboard through a WebApp workspace client backed by Forma RPC.
4. Add diagnostics and knowledge health surfaces over existing and new checks.
5. Add graph view render data and a minimal graph surface.
6. Add quick switcher and entry search over the summary index.
7. Design reviewable operation proposals for interactive GUI actions.
8. Design the AI Chat interaction model around explain, draft, dry-run, and
   propose modes.
9. Revisit VS Code and Zed extensions as adapters after WebApp workflows and
   shared operation contracts stabilize.

## Deferred Editor Extension Strategy

VS Code and Zed extensions should not duplicate the WebApp. Their first useful
role is to:

- locate or start `forma serve`;
- connect the current editor workspace to the Forma local service;
- show status and diagnostics;
- open the WebApp focused on the current file or workspace;
- send current-file context to WebApp-backed workflows;
- expose a small command palette bridge to stable Forma operations.

VS Code should be considered before Zed because the repository already has VS
Code/Foam-oriented editor integration. Zed should follow after the adapter
contract is proven.

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
