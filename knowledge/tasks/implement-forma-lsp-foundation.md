---
scope: project
type: task
title: Implement Forma LSP foundation
summary: Add Core-owned transient document reference analysis, a reusable workspace session, and an editor-neutral stdio language server exposed through the existing Forma binary.
priority: P2
value: H
module: app
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - lsp
    - rust
    - editor-extension
    - navigation
blockedBy: []
relatedTo:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "tasks/implement-zed-extension-mvp"
severity:
sprint:
reportedBy:
affectedArea: Forma Core transient analysis and editor-neutral LSP transport
---

# Implement Forma LSP Foundation

## Goal

Provide one reusable language-intelligence process that keeps Forma semantics in Rust Core and can serve Zed first and other editor adapters later.

## In Scope

- Add exact body and schema-aware frontmatter reference ranges to Core transient document analysis.
- Resolve supplied unsaved source text without persisting it.
- Add a rebuildable workspace snapshot and versioned document overlays.
- Add the separate `forma-lsp` library crate.
- Expose the server as `forma lsp` from the existing binary.
- Implement Definition and DocumentLink with full-text document synchronization.
- Add focused semantic, protocol, path-safety, and performance tests.

## Out Of Scope

- A separate LSP executable or release artifact.
- VS Code migration.
- Preview, Explorer, completion, backlinks, rename, or write operations.
- Persisted indexes or databases.

## Acceptance Criteria

- Core identifies exact reference ranges for Markdown links, wikilinks, embeds, fragments, and schema-aware frontmatter values.
- Ordinary string values with reference-like text remain ordinary values.
- Unsaved source text participates in navigation without changing repository files.
- `forma lsp` completes a valid LSP lifecycle over stdio.
- Definition returns one canonical target or all ambiguity candidates without choosing silently.
- DocumentLink omits unresolved and ambiguous targets rather than opening an arbitrary file.
- Workspace-relative path safety, UTF-16 conversion, CRLF, Chinese text, emoji, and repeated YAML values are tested.
- Warm Definition reuses the workspace snapshot and remains within the current navigation budget.
- Existing CLI and RPC behavior remains compatible and `mise run check` passes.

## Completion Evidence

- Core transient analysis owns exact reference ranges, semantic frontmatter classification, labels, list indexes, fragments, ambiguity candidates, and diagnostics.
- `WorkspaceSnapshot` and `WorkspaceSession` reuse one in-memory discovery generation and one document analysis per open-document version.
- `forma lsp` implements the agreed stdio lifecycle, full-text overlays, Definition, DocumentLink, save invalidation, workspace-boundary rejection, UTF-16 conversion, and malformed-request recovery.
- Focused Core and LSP tests pass, including the real getting-started fixture and unsaved overlays.
- `CI=true mise run check` passes; `CI=true` only provides pnpm's required non-interactive behavior in the Agent environment.
- The 2026-07-13 baseline remains within the navigation gates through 5,000 generated entries. See [[discovery/forma-lsp-zed-navigation-validation-2026-07-13]].
