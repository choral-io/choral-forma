---
scope: project
type: execution-plan
title: Forma LSP Navigation Intelligence Extension Plan
summary: Extend the existing Forma LSP and Zed Dev Extension with Hover, Diagnostics, context-aware Completion, and Find References while preserving Core semantic ownership and host-native UI.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - lsp
    - zed
    - editor-extension
    - navigation
    - diagnostics
sources:
    - "architecture/editor-extension-adapter-contract"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "tasks/refine-zed-link-navigation-and-highlighting"
---

# Forma LSP Navigation Intelligence Extension Plan

## Objective

Extend the accepted editor-neutral Forma language server with four host-native language-intelligence capabilities:

1. Hover for resolved and unresolved Forma-owned references;
2. document Diagnostics, including a best-effort Zed CLI compatibility advisory;
3. context-aware Completion for wikilinks, embeds, fragments, and schema-declared `entryRef` values;
4. Find References backed by exact Forma reference occurrences and exposed through the editor's native references UI.

Forma Core remains authoritative for workspace classification, schemas, reference syntax, target resolution, ambiguity, completion candidates, and incoming relationships. `forma-lsp` owns protocol capabilities, UTF-16 conversion, request and notification lifecycle, and client-specific transport. The Zed extension remains a launcher and configuration adapter.

## Accepted Boundary

The goal includes:

- Forma-managed Markdown content and configured view documents;
- wikilinks, embeds, fragments, title-searchable canonical targets, and schema-declared `entryRef` fields;
- full-text open-document overlays;
- Zed-native Hover, diagnostics, completion, and Find All References UI;
- a best-effort version mismatch warning with an installation-documentation link;
- focused protocol, semantic, invalidation, path-boundary, and performance tests;
- local Zed Dev Extension validation while retaining extension version `0.1.29`.

The goal excludes:

- a custom Zed Preview, panel, Explorer, backlinks view, status surface, or grammar;
- semantic-token source styling;
- rename, repair, code actions, or automatic workspace writes;
- CLI download, installation, update, or version selection;
- `process:exec` capability or a separate `forma --version` subprocess;
- Zed Extension Registry publication, a Forma release, or a version bump;
- a persisted index, database, daemon, or hidden authoritative cache;
- migration of VS Code Hover, document Diagnostics, Completion, or References to the new LSP capabilities; the package-version advisory may be shared by both editor adapters.

Ordinary Markdown links remain host-owned except for the already accepted bounded Zed navigation fallback. Forma diagnostics, Hover, Completion, and References must not treat lexical links inside inline code or Markdown example fences as workspace relationships.

## Delivery Sequence

### Phase 0: Contract And Fixture Alignment

- Record this follow-up as a separate expansion of the completed Definition and DocumentLink baseline.
- Replace the obsolete Zed pre-launch exact-version-check contract with the accepted best-effort LSP advisory boundary.
- Keep one Core-owned document-analysis result per source version and one workspace snapshot per LSP session generation.
- Define fixtures for managed and unmanaged Markdown, neutral configured paths and field ids, unsaved buffers, CRLF, Chinese text, emoji, display labels, fragments, ambiguity, and workspace-boundary rejection.
- Keep operational model, session, timing, and cost details local to the execution run.

### Phase 1: Hover

- Advertise `hoverProvider` and handle `textDocument/hover`.
- Resolve the reference at the cursor through the existing Core document analysis and workspace session.
- Return native Markdown hover content containing the canonical path and available title, space, kind, fragment, field, and candidate information.
- Return no Forma Hover outside a Forma-owned reference or managed document.
- Reuse the cached analysis for the current document version and avoid workspace rediscovery.

Exit criteria:

- resolved, unresolved, ambiguous, display-label, fragment, embed, and `entryRef` cases have protocol tests;
- UTF-16 ranges and unsaved overlays are verified;
- warm Hover stays within the existing warm navigation budget.

### Phase 2: Diagnostics And CLI Advisory

- Add an outbound LSP notification path and publish push diagnostics.
- Combine Core document-analysis diagnostics with per-reference resolution diagnostics without duplicating messages.
- Publish after open and change, refresh after save and relevant workspace invalidation, and clear stale diagnostics after close or successful correction.
- Anchor document diagnostics to exact source ranges whenever Core provides a span; use a conservative file-level range only when no exact range exists.
- Pass the VS Code or Zed extension version to `forma lsp` through standard LSP `initializationOptions` without invoking another process.
- Compare the expected extension version with `forma_core::version()` in the running LSP and publish one editor-labelled Warning on the workspace `.forma.md` when they differ.
- Include `https://github.com/choral-io/choral-forma#installing-forma` in the diagnostic message and populate `codeDescription.href` when supported.

The compatibility warning is advisory. An older CLI that predates this protocol cannot emit it, and a CLI that fails before LSP initialization cannot publish diagnostics. Those cases continue to rely on the existing actionable command error and Zed logs.

Exit criteria:

- diagnostics publish, update, deduplicate, and clear deterministically;
- unmanaged documents receive no Forma diagnostics;
- VS Code and Zed version match, mismatch, missing-version, host binary override, and missing-startup cases are documented and tested at the owning layer;
- the Zed manifest still declares no `process:exec` capability.

### Phase 3A: Wikilink, Embed, And Fragment Completion

- Add a Core-owned cursor-aware completion context for incomplete wikilink and embed syntax.
- Enumerate candidates from the current workspace snapshot rather than scanning files in the LSP adapter.
- Support path and title search plus fragment candidates with deterministic ranking. Entry candidates insert a canonical reference spelling that resolves uniquely; a wikilink display label is not an entry alias identity.
- Advertise `completionProvider` and map Core candidates to LSP completion items and text edits.
- Preserve delimiters and replace only the active target or fragment span.
- Gate completion strictly to accepted Forma syntax contexts so ordinary Markdown input remains quiet.

Exit criteria:

- manual invocation and accepted trigger behavior are verified in Zed;
- replacement ranges pass CRLF, Chinese, emoji, and partially typed syntax tests;
- warm completion does not rebuild or rediscover the workspace.

### Phase 3B: Schema-Aware `entryRef` Completion

- Extend the Core completion context to incomplete frontmatter values whose effective schema declares `entryRef` or a list of `entryRef`.
- Derive target-space filtering and candidate semantics from the resolved workspace model.
- Support scalar, block-list, and flow-list values without treating ordinary strings as references.
- Keep tolerant partial-input parsing narrow and deterministic; do not introduce a second general YAML parser in the LSP layer.

If partial frontmatter completion cannot preserve the schema and source-range contract without broad parser work, stop Phase 3B as a separately documented follow-up. Phase 3A may still complete independently.

### Phase 4: Occurrence-Aware Find References

- Define a Core reference occurrence containing source path, exact source span, target path, optional fragment, syntax, intent, field, and resolution status.
- Build the private occurrence index and existing summary index from one parsed document projection; do not reread and reparse every source after discovery.
- Query incoming occurrences from the current workspace snapshot while replacing saved results for open documents with their current overlays.
- Define cursor behavior explicitly:
    - on a Forma-owned reference, query references to its uniquely resolved target;
    - otherwise return no result.
- Advertise `referencesProvider` and map occurrences to LSP locations.
- Return no declaration in the first version. A later contract may define stable entry identity and declaration ranges before honoring `includeDeclaration`.
- Exclude external targets, local non-Markdown resources, lexical example projections, unresolved references, and ambiguous references.

Exit criteria:

- saved and unsaved incoming references have exact locations;
- duplicate edges and stale overlay results are absent;
- neutral configured paths and workspace boundaries are tested;
- warm queries do not perform a complete workspace rediscovery.

### Phase 5: Integration And Validation

- Reload the local Zed Dev Extension at version `0.1.29` after each user-visible phase.
- Validate Hover, diagnostics, completion, and Find All References in `examples/getting-started-workspace/` and at least one neutral generated workspace.
- Validate a missing CLI, matching CLI, mismatched compatible CLI, ordinary Markdown file, unmanaged Markdown file, configuration change, unsaved edit, and language-server restart.
- Identify the responsible provider before attributing any editor behavior to Forma.
- Record cold, warm, invalidation, snapshot-build, and document-analysis evidence without presenting dirty-worktree measurements as release-quality thresholds.

## Performance And Correctness Gates

- Cold interaction p95 remains no more than 250 ms for representative navigation-intelligence requests.
- Warm interaction p95 remains no more than 100 ms.
- One document version performs at most one Core syntax analysis; derived resolution results may be cached only against explicit document and snapshot generations.
- Warm Hover, Completion, and References do not rediscover the complete workspace.
- Diagnostics do not publish stale results after a newer document version or workspace generation.
- The connected server performs no intentional idle work.
- Every fast path preserves configured document classification and workspace-boundary validation.

## Delivery Coordination

- The coordinating Agent owns shared contracts, edits to common dispatch and session state, integration, conflicts, and the final repository gate.
- Delegate only bounded investigation, disjoint Core modules, or independent review. Two workers must not edit the same LSP or Core module concurrently.
- Keep the implementation in the current working tree unless an independently reviewable Core slice has a clean, explicit base. Do not copy unrelated uncommitted work into a feature worktree.
- Review each phase before starting the next. A focused test is feedback for that phase, not final readiness evidence.

## Suggested Commit Boundaries

1. `docs: define LSP navigation intelligence extension plan`
2. `feat: add Forma reference hover`
3. `feat: publish Forma language diagnostics`
4. `feat: add Forma CLI compatibility advisory`
5. `feat: add Forma reference completion`
6. `feat: add schema-aware entry reference completion`
7. `feat: add occurrence-aware reference lookup`
8. `test: validate Zed navigation intelligence`
9. `docs: record Zed navigation intelligence evidence`

## Completion Evidence

- `cargo test -p forma-core` passes for every Core semantic change.
- `cargo test -p forma-lsp` passes for every protocol change.
- `cargo test -p forma-zed-extension` passes for every adapter change.
- `cargo check -p forma-zed-extension --target wasm32-wasip1` passes.
- `mise run perf:lsp:quick` remains within the accepted interaction budgets.
- `CI=true mise run check` passes after cross-surface integration.
- `cargo run -q -p forma-cli -- check --json` and `cargo run -q -p forma-cli -- workspace health --json` contain no new project-content regressions.
- Real Zed Dev Extension evidence covers all four capabilities and the documented compatibility limitations.
- No publication, release, version bump, custom UI, CLI acquisition, or workspace mutation capability is introduced.

## Execution Evidence — 2026-08-05

Implemented at Zed Dev Extension version `0.1.29`:

- Hover for resolved, unresolved, ambiguous, fragment, embed, and schema-owned `entryRef` references.
- Push Diagnostics with exact ranges, lifecycle clearing, deduplication, and an advisory CLI-version mismatch warning that links to the Forma installation instructions.
- Wikilink, embed, fragment, and schema-aware `entryRef` Completion with full active-token replacement, canonical path insertion, `.md`/`.mdx` support, deterministic ranking, and inert code examples.
- Occurrence-aware Find References backed by a target-indexed saved projection plus open-document overlays. The first version intentionally returns no declaration for either value of `includeDeclaration`.

Integration evidence:

- `cargo test -p forma-core`: 268 tests passed after independent review fixes.
- `cargo test -p forma-lsp`: 34 tests passed, including explicit `.mdx` adapter behavior and request-local source-cache reuse.
- The full workspace, Zed WebAssembly, formatter, project-content, and workspace-health gates are recorded in the execution handoff for this change set.
- `mise run perf:lsp:quick` now measures Completion and References directly. On the 1,000-entry synthetic fixture, Completion was 4.4 ms cold / 3.6 ms warm p95 and References was 0.2 ms cold / 0.2 ms warm p95. On the current project snapshot, Completion was 0.1 ms cold / 0.1 ms warm p95 and References was 1.0 ms cold / 0.9 ms warm p95.
- The same benchmark recorded a 327.4 ms project cold Definition because synchronous initial diagnostics are still charged to the first request; this exceeds the plan's 250 ms release-quality threshold and remains explicit rather than being hidden by the new-feature measurements.
- Zed loaded the local dev-extension symlink without a `process:exec` capability and started the repository release binary through a temporary project-level binary override. Computer Use could not complete the four editor gestures after Zed became unresponsive while changing worktree roots, so protocol integration tests remain the feature-level evidence for this run. The override was removed, and the installed `/Users/Tiscs/.local/bin/forma` binary was not modified.

The version advisory was subsequently unified across editor adapters. VS Code and Zed now pass their package version through `initializationOptions`; the LSP owns comparison, diagnostic code, severity, installation link, deduplication, and editor-specific naming. Zed no longer transports the version through a process environment variable, and VS Code no longer blocks a well-formed CLI solely because its package version differs. VS Code continues to reject incompatible structured operation schemas.

The repository-wide `CI=true mise run check` remains blocked only by the pre-existing local `.claude/settings.local.json` Prettier finding. That local file is outside this implementation scope and was not changed.
