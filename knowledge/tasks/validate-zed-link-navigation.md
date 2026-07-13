---
scope: project
type: task
title: Validate Zed link navigation
summary: Attach the reusable Forma language server to built-in Markdown in a Zed Dev Extension and validate real source-mode navigation with a preinstalled matching CLI.
priority: P2
value: M
module: app
effort: S
status: backlog
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
blockedBy:
    - "tasks/implement-forma-lsp-foundation"
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
- No Preview, CLI management, registry publication, or duplicated Core semantics are introduced.
