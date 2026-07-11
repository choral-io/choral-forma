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
readiness: blocked
sprint:

blockedBy:
    - "tasks/implement-vscode-extension-mvp"
relatedTo:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/editor-extension-adapter-contract"
    - "planning/editor-extension-mvp-roadmap"

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

This task remains blocked behind the VS Code MVP so the second adapter is based on implementation evidence rather than parallel assumptions.

## Open Questions

-
