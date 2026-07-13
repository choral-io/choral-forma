---
scope: project
type: execution-plan
title: Forma LSP And Zed Navigation Execution Plan
summary: Introduce an editor-neutral Forma language server and validate source-mode reference navigation in a Zed Dev Extension without expanding into Preview, CLI acquisition, or publication.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - planning
    - lsp
    - zed
    - editor-extension
    - navigation
sources:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "planning/forma-performance-optimization-plan"
    - "tasks/implement-zed-extension-mvp"
---

# Forma LSP And Zed Navigation Execution Plan

## Objective

Deliver a reusable `forma-lsp` crate, expose it through the single `forma lsp` command, and validate editor-native source navigation in a locally installed Zed Dev Extension. Core remains authoritative for Markdown, schema, reference, workspace, fragment, and ambiguity semantics.

## Goal Cutline

The goal includes:

- Core-owned transient document reference analysis with exact source ranges;
- a rebuildable in-memory workspace snapshot and versioned open-document overlays;
- a separate `crates/forma-lsp` library used by `forma-cli`;
- full-text LSP synchronization, Definition, and DocumentLink;
- a Zed Dev Extension that starts a preinstalled matching `forma` binary;
- automated protocol, semantic, path-safety, and performance checks;
- real Zed validation against `examples/getting-started-workspace/`.

The goal excludes:

- Zed Preview, panels, workspace status, completion, backlinks, references, rename, or write operations;
- CLI download, installation, update, or version selection;
- Zed Extension Registry publication or a new release artifact;
- migration of the VS Code extension to LSP;
- a daemon, persisted index, database, or hidden authoritative cache.

## Delivery Sequence

### Phase 0: Architecture And Task Preparation

- Accept LSP as the editor-neutral language-intelligence transport required by Zed.
- Keep structured CLI and RPC operations authoritative for Explorer, health, and views.
- Create the LSP foundation and Zed navigation child tasks.
- Keep the full Zed MVP umbrella in backlog.

### Phase 1: Core Transient Reference Analysis

- Add an editor-neutral result for document references, including target, intent, syntax, label, fragment, source range, semantic field, list index, resolution, candidates, and diagnostics.
- Derive body references and schema-aware frontmatter references from the supplied source text.
- Distinguish ordinary string values from schema-declared `entryRef` values.
- Keep byte/source locations in Core and convert them to UTF-16 only in the LSP crate.
- Test Markdown links, wikilinks, aliases, embeds, fragments, code ranges, quoted YAML, lists, nested fields, repeated values, CRLF, Chinese text, and emoji.

### Phase 2: Workspace Snapshot And Invalidation

- Extract reference resolution against an already built workspace snapshot.
- Build one non-persisted snapshot per LSP workspace session.
- Keep full-text overlays by document URI and version.
- Update overlays on `didOpen` and `didChange`; remove them on `didClose`.
- Rebuild controlled scope after `.forma.md`, import, taxonomy definition, or include-pattern changes.
- Allow a full snapshot rebuild after saved content changes in the first version, but never rebuild it for every warm Definition request.
- Recover by rebuilding entirely from source files after process exit.

### Phase 3: Forma LSP

- Add `crates/forma-lsp` as a library crate depending on `forma-core`.
- Add `forma lsp` to the single published CLI binary.
- Implement initialize, initialized, full-text open/change/close, Definition, DocumentLink, shutdown, and exit.
- Reject document URIs outside the selected workspace boundary.
- Keep stdout protocol-only and send operational logging to stderr.
- Test protocol lifecycle, cancellation, malformed requests, UTF-16 conversion, ambiguity arrays, unresolved results, fragments, and unsaved buffers without launching an editor.

### Phase 4: Zed Dev Extension

- Add the Rust/WASM extension under `extensions/zed/`.
- Register the Forma language server for built-in Markdown.
- Locate `forma` with the Zed worktree environment and start `forma --workspace <root> lsp`.
- Return an actionable error when `forma` is unavailable.
- Do not download a binary, define a second Markdown grammar, add custom UI, or publish the extension.
- Prefer root Cargo-workspace membership when it preserves normal checks; otherwise isolate the Zed crate and include its manifests in version normalization and dedicated checks.

### Phase 5: Validation And Measurement

- Use generated workspaces for automated semantic and protocol tests.
- Use `examples/getting-started-workspace/` for the real Zed validation.
- Validate relative Markdown links, wikilinks, aliases, fragments, embeds, multi-owner frontmatter references, ordinary string values, unresolved references, ambiguity candidates, and unsaved edits.
- Record initialization, snapshot construction, first and repeated Definition latency, idle CPU, connected RSS, document-version analysis count, snapshot rebuild count, configuration invalidation, and process restart recovery.
- Run the current project, 1,000-entry, and 5,000-entry performance fixtures.

## Performance Gates

- Cold navigation p95 is no more than 250 ms.
- Warm navigation p95 is no more than 100 ms.
- One document version performs at most one Core analysis.
- Warm Definition does not rediscover the complete workspace.
- The connected server performs no intentional idle work.
- Long-lived RSS is recorded before a release-readiness decision; a material increase over the existing short-process baseline requires review rather than a silently increased budget.

## Stop Conditions

Stop rather than broadening the goal when:

- Zed cannot attach the server reliably to built-in Markdown;
- Zed lacks enough root or document context to enforce the Forma workspace boundary;
- frontmatter navigation would duplicate schema semantics outside Core;
- warm navigation repeatedly rebuilds the workspace or exceeds the interaction budget;
- progress requires Preview, custom UI, CLI acquisition, publication, or write operations;
- the Zed WASM crate cannot be integrated or isolated without weakening existing repository checks.

## Suggested Commit Boundaries

1. `docs: define Forma LSP and Zed navigation plan`
2. `feat: add transient document reference analysis`
3. `refactor: add reusable workspace snapshot resolution`
4. `feat: add Forma language server`
5. `feat: add Zed navigation dev extension`
6. `test: validate Zed reference navigation`
7. `docs: record Zed LSP validation evidence`

## Completion Evidence

- `mise run check` passes.
- Focused Core and LSP tests pass.
- The Zed extension build check passes.
- Zed installs the local Dev Extension and starts the preinstalled CLI.
- The corrected getting-started fixture navigates every accepted reference form.
- Protocol logs contain no material errors.
- Performance and resource results are recorded against the current budgets.
- No Zed publication or Forma release occurs as part of this goal.
