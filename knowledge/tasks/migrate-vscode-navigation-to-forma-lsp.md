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
status: done
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

## Implementation Evidence

Implemented on 2026-07-14 as the VS Code navigation cutover to the shared Forma language server.

Delivered behavior:

- The trusted ready or warning runtime now synchronizes exactly one `forma --workspace <active-root> lsp` client. Transient runtime rechecks retain an unchanged client; root changes, trust loss, invalid configuration, and disposal stop it through the serialized lifecycle.
- Forma LSP owns Definition for wikilink targets, explicit labels, heading fragments, embeds, and schema-declared frontmatter references. VS Code receives a positionless-wikilink Definition in addition to the non-competing DocumentLink needed for link interaction.
- Forma LSP owns DocumentLink for positionless wikilink targets and explicit labels. Ordinary Markdown links remain owned by VS Code's built-in Markdown extension, including heading navigation.
- The adapter Definition provider, adapter DocumentLink provider, `forma.openReference` command, manifest contribution, and navigation-only result conversion were removed. Hover and saved-document Diagnostics remain CLI-backed; Preview, Explorer, View rendering, and managed CLI recovery remain extension-owned.
- LSP initialization uses the pure `forma --workspace <root> lsp` command. The executable intentionally omits an explicit `TransportKind.stdio`, because `vscode-languageclient` otherwise appends the unsupported `--stdio` CLI argument; a unit test guards this contract.
- The LSP now separates its canonical filesystem root from the editor-visible root. This preserves workspace-boundary checks while supporting macOS `/var` to `/private/var` canonicalization and symlink-visible editor URIs without returning unusable target paths.
- Internal runtime diagnostics expose `lspState` and `lspRoot`, allowing installed-extension tests to prove that navigation runs through the active language client.

Verification:

- `cargo test -p forma-lsp`: 23 tests passed, including VS Code positionless definitions, Zed behavior preservation, managed-document gating, unsaved overlays, and symlink-visible URI preservation.
- VS Code extension unit tests: 123 passed.
- The installed VSIX smoke suite passed against the existing official VS Code 1.128.0 executable without downloading another Code.app. It verifies LSP state, LocationLink Definition results, fragment/alias/embed/frontmatter navigation, positionless target/label DocumentLinks, native Markdown ownership, View previews, source opening, and diagnostics.
- Manual validation in the user's existing `software-product-rd-workspace` window passed for simple wikilinks, aliases, heading fragments, `owners` frontmatter references, native Markdown heading links, and Task Board View rendering. The active workspace had one idle Forma LSP process at approximately 13.6 MiB RSS and 0% CPU during the check.
- Packaged internal artifact: 21 files, 128.73 KiB VSIX; no release was published.
- `mise run check`: passed.
