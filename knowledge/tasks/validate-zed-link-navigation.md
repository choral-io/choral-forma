---
scope: project
type: task
title: Validate Zed link navigation
summary: Validate source navigation and theme-aligned wikilink target highlighting through a reusable Forma language server and Zed Dev Extension.
priority: P2
value: M
module: app
effort: S
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - zed
    - lsp
    - editor-extension
    - navigation
blockedBy: []
relatedTo:
    - "architecture/editor-extension-adapter-contract"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "tasks/implement-zed-extension-mvp"
severity:
sprint:
reportedBy:
affectedArea: Zed Dev Extension and source navigation validation
---

# Validate Zed Link Navigation

## Goal

Prove that a locally installed Zed extension can start a preinstalled matching `forma` binary and provide editor-native navigation for Forma-controlled Markdown.

## In Scope

- Add a minimal Rust/WASM Zed extension under `extensions/zed/`.
- Register `forma lsp` for built-in Markdown.
- Find `forma` through the Zed worktree environment.
- Validate Definition and DocumentLink in `examples/getting-started-workspace/`.
- Correct wikilink and embed target styling through theme-derived semantic tokens.
- Record protocol, latency, idle-resource, invalidation, and restart behavior.

## Out Of Scope

- CLI acquisition or update UX.
- Registry publication.
- Preview, panels, workspace status, completion, backlinks, or write operations.

## Acceptance Criteria

- Zed starts `forma lsp` from the worktree environment and reports an actionable error when the binary is absent.
- A relative Markdown link, wikilink, aliased wikilink, fragment, and embed navigate to canonical Markdown source.
- Multiple schema-declared owner values each have the correct range and target.
- A normal string containing the same text is not treated as a reference.
- Unresolved references do not open an arbitrary file, and ambiguous references return candidates.
- Unsaved source changes participate in navigation.
- Configuration and controlled-scope changes refresh safely, and Zed recovers after the server exits.
- Zed protocol logs contain no material errors and the measured navigation budgets pass.
- Wikilink and embed targets no longer inherit Markdown emphasis styling when semantic tokens are enabled, while alias text remains theme-native.
- No Preview, CLI management, registry publication, or duplicated Core semantics are introduced.

## Current Validation State

This completed task records the Alpha 17/18 validation boundary. Its semantic-token styling evidence is historical: the accepted post-validation direction removes Forma styling from the LSP and leaves Markdown source highlighting entirely to Zed while retaining navigation behavior.

Automated protocol, semantic-token, fixture, WASM build, invalidation, restart, and performance checks pass. The Dev Extension remains intentionally unpublished and requires a matching preinstalled `forma` from the worktree environment.

Real Zed interaction also passes: Markdown links, fragments, wikilinks, aliases, embeds, multi-owner frontmatter, inert values, unsaved overlays, unresolved references, ambiguity candidates, language-server restart, and full editor restart were exercised against the getting-started workspace. Markdown `combined` semantic tokens produce theme-aligned target styling without replacing Zed's native Markdown grammar. Evidence and residual Zed constraints are recorded in [[discovery/forma-lsp-zed-navigation-validation-2026-07-13]].
