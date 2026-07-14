---
schemaVersion: 1
scope: project
type: task
title: Migrate VS Code Navigation To Forma LSP
summary: Replace VS Code adapter-owned Forma Definition and DocumentLink behavior with the shared language server while retaining native Markdown, Hover, Diagnostics, Preview, and Explorer ownership.
priority: P1
value: H
module: app
effort: M
status: backlog
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - lsp
    - navigation
    - wikilink
blockedBy:
    - "tasks/normalize-forma-lsp-client-profiles"
    - "tasks/add-vscode-forma-lsp-lifecycle"
relatedTo:
    - "planning/vscode-lsp-navigation-migration-plan"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/implement-vscode-reference-navigation"
    - "tasks/implement-forma-lsp-foundation"
severity:
sprint:
reportedBy:
affectedArea: VS Code source Definition and DocumentLink providers for Forma-managed Markdown
---

# Migrate VS Code Navigation To Forma LSP

## Goal

Enable the prepared Language Client for the active Forma workspace and cut Definition and DocumentLink over to the shared language server without duplicating native Markdown or retaining two Forma navigation pipelines.

## Sources

- [[planning/vscode-lsp-navigation-migration-plan]]
- [[architecture/editor-extension-adapter-contract]]
- [[tasks/implement-vscode-reference-navigation]]
- [[tasks/implement-forma-lsp-foundation]]

## In Scope

- Activate one Language Client for the selected active Forma root after the existing runtime reaches a trusted ready or warning state.
- Scope synchronization and language features to Markdown documents managed by the effective Forma configuration.
- Replace the adapter-owned Forma Definition and DocumentLink providers as one coherent cutover.
- Preserve VS Code's native provider for ordinary Markdown links, images, headings, and source highlighting.
- Support managed wikilink paths, aliases, heading fragments, embeds, schema-declared frontmatter references, ambiguity candidates, unresolved targets, non-ASCII positions, and unsaved buffers.
- Keep Hover and saved-document Diagnostics on the current CLI-backed implementation.
- Remove `forma.openReference`, its manifest contribution, and navigation-only adapter code after LSP parity is proven.
- Retain reference parsing and inspect data still used by Preview, Hover, or Diagnostics.
- Update unit, protocol, Extension Host, command, package-content, and installed-extension tests for the new provider ownership.

## Out Of Scope

- LSP Hover or Diagnostics.
- Multiple concurrent root sessions.
- Preview, Explorer, View rendering, health, status, or managed CLI migration.
- Semantic tokens, Markdown grammar replacement, or source-style changes.
- General LSP Completion, References, Rename, Code Actions, or write operations.

## Acceptance Criteria

- Cmd/Ctrl-click and Go to Definition work for every accepted Forma reference form in managed documents.
- Wikilink targets and explicit labels navigate consistently; fragment links land at the resolved heading.
- Ambiguous references expose all canonical candidates without silently choosing, and unresolved references do not open an arbitrary target.
- Unsaved managed source changes participate in navigation without writing the document.
- Ordinary Markdown navigation continues to come from VS Code without duplicate or competing Forma results.
- Unmanaged Markdown receives no Forma Definition or DocumentLink and causes no Forma document analysis.
- Exactly one Forma navigation provider owns each accepted syntax after cutover.
- Hover, Diagnostics, Preview, Explorer, and managed CLI recovery continue to work.
- Focused tests, installed-extension validation, and `mise run check` pass.
