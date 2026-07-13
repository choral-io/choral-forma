---
scope: project
type: task
priority: P2
severity:
value: L
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p2
    - zed
    - editor-extension

effort: M
status: backlog
readiness: needs-refinement
sprint:

blockedBy: []
relatedTo:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/editor-extension-adapter-contract"
    - "planning/editor-extension-mvp-roadmap"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "tasks/implement-forma-lsp-foundation"
    - "tasks/validate-zed-link-navigation"

reportedBy:
affectedArea: Zed extension
---

# Implement Zed Extension MVP

## Goal

Implement a Zed adapter after the VS Code MVP validates which contracts and renderer boundaries are genuinely editor-independent.

## Sources

- [[decisions/editor-extension-primary-product-surface]]
- [[architecture/editor-extension-adapter-contract]]
- [[planning/editor-extension-mvp-roadmap]]
- [[tasks/design-editor-extension-adapter-contract]]
- [[tasks/implement-vscode-extension-mvp]]

## Context

Zed is an important editor target, but it should follow the first VS Code adapter. It should reuse proven Core operations and adapter-neutral contracts rather than copying VS Code lifecycle or WebView assumptions.

## In Scope

- Add a Zed extension scaffold when the adapter contract and VS Code MVP provide a proven baseline.
- Invoke a compatible Forma transport according to the accepted adapter contract.
- Map workspace discovery, reference navigation, source opening, status, diagnostics, and view preview into the Zed APIs that are available at implementation time.
- Add focused extension build/type checks.

## Out Of Scope

- Copying VS Code-specific APIs or theme variables into shared modules.
- Full Markdown editing features.
- Direct file mutation commands.
- VS Code extension implementation.
- Extension marketplace publishing.

## Acceptance Criteria

- The Zed extension can connect a workspace to Forma according to the accepted adapter contract.
- Supported editor-independent behavior is mapped to Zed without moving Core semantics into the extension.
- Extension checks pass.
- The implementation does not duplicate core Forma semantics.

## Relationship Notes

The VS Code MVP baseline is now published. The first Zed work is split into [[tasks/implement-forma-lsp-foundation]] and [[tasks/validate-zed-link-navigation]]. This umbrella task remains in backlog until that focused navigation validation establishes which additional Zed capabilities are feasible and valuable.

## Open Questions

- Which workspace status and diagnostic experiences remain useful after native navigation is available?
- Does Zed expose a stable Preview or project UI extension point that can represent Forma Views without creating a parallel renderer?
- When should Zed CLI acquisition and release-aligned version management follow the preinstalled-CLI validation?
