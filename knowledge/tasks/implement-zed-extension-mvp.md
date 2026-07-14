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
    - "tasks/refine-zed-link-navigation-and-highlighting"

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

The VS Code MVP baseline is now published. [[tasks/implement-forma-lsp-foundation]] and [[tasks/validate-zed-link-navigation]] establish that Zed can reuse Core-owned navigation, unsaved overlays, and ambiguity candidates through a thin adapter. Forma deliberately leaves Markdown source highlighting entirely to Zed.

The validation also exposes one MVP constraint: the language-server manifest registers against all built-in Markdown worktrees rather than only roots containing `.forma.md`. The umbrella task remains in backlog until its remaining workspace lifecycle, diagnostics, CLI management, and View scope is refined around the Zed APIs that actually exist.

The Alpha 18 developer-preview boundary keeps CLI acquisition manual but removes version ambiguity for the adapter-controlled path. The adapter resolves `forma` from the worktree `PATH`, requires it to match the extension version exactly, and reports missing or incompatible binaries before starting the server. Zed's native `lsp.forma.binary` setting remains a host-level, user-owned escape hatch because the host applies it before invoking the extension command callback; it is not part of Forma's checked or managed lifecycle. Automatic acquisition is staged after Alpha 18 so its first end-to-end test can use a published CLI that already contains `forma lsp`. That follow-up must define exact-tag asset selection, checksum verification, atomic caching, failure recovery, workspace-trust behavior, native-override precedence, and local-versus-remote installation semantics before it can become a release requirement.

## Open Questions

- Which workspace status and diagnostic experiences remain useful after native navigation is available?
- Does Zed expose a stable Preview or project UI extension point that can represent Forma Views without creating a parallel renderer?
- How should the extension avoid noisy startup attempts in non-Forma Markdown worktrees when the manifest cannot express a `.forma.md` activation condition?
