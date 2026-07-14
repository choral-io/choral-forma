---
scope: project
type: execution-plan
title: VS Code LSP Navigation Migration Plan
summary: Migrate Forma-owned VS Code Definition and DocumentLink behavior to the shared language server in small, reversible iterations while preserving native Markdown, Preview, Explorer, and CLI responsibilities.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - planning
    - vscode
    - lsp
    - editor-extension
    - navigation
    - performance
sources:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "discovery/forma-lsp-zed-navigation-validation-2026-07-13"
    - "tasks/implement-vscode-reference-navigation"
    - "tasks/implement-forma-lsp-foundation"
---

# VS Code LSP Navigation Migration Plan

## Objective

Reuse `forma lsp` for Forma-owned source navigation in VS Code without turning the language server into a replacement for the editor adapter or built-in Markdown support. Deliver the migration through independently testable tasks so each behavior change can be measured, reviewed, and reverted without discarding unrelated work.

## Confirmed Decisions

- Run at most one Forma LSP process for the active Forma root. Discovered roots remain separate workspaces, but switching the active document to another applicable root stops the previous session and starts the selected root rather than keeping one server per root.
- Migrate Definition and DocumentLink in the first cutline. Keep Hover and Diagnostics on the existing structured CLI path until separate evidence shows that another migration is valuable.
- Keep Preview, Explorer, workspace health, View rendering, status, commands, CLI acquisition, and exact-version compatibility in the VS Code adapter and structured CLI operations.
- Keep standard Markdown links, images, headings, code rendering, source highlighting, and Preview ownership with VS Code. Forma must not advertise semantic tokens or duplicate working native Markdown providers.
- Use explicit LSP client behavior profiles. Zed-specific navigation fallbacks must not become generic or VS Code behavior.
- Preserve the current `extensionKind: ["workspace"]` model so CLI and LSP execution occur in the Extension Host beside local or remote workspace files.
- Do not publish a release as part of this plan. Release selection and publication require a separate cutline decision.

## Goal Cutline

The first deliverable includes:

- explicit Generic, Zed, and VS Code LSP behavior profiles;
- a VS Code Language Client lifecycle that reuses the existing trusted, release-aligned CLI resolution;
- one active-root server with deterministic start, stop, root switch, crash recovery, and disposal;
- local and `vscode-remote` URI conversion at the VS Code adapter boundary;
- LSP-backed Definition and DocumentLink for managed Pages and Views;
- removal of the superseded VS Code navigation provider and command paths;
- local, simulated remote, active-root switching, package, performance, and resource validation.

The first deliverable excludes:

- LSP Hover, Diagnostics, Completion, References, Rename, Code Actions, or write operations;
- multiple concurrent Forma LSP processes for multiple roots;
- changes to native Markdown highlighting or semantic tokens;
- migration of Preview, Explorer, View rendering, health, or general RPC operations to LSP;
- a daemon, persisted index, database, or hidden authoritative cache;
- automatic CLI installation beyond the existing user-initiated managed lifecycle.

## Delivery Sequence

### Iteration 0: Preserve Evidence And Define Ownership

Executed through [[tasks/normalize-forma-lsp-client-profiles]].

- Capture a client behavior matrix for ordinary Markdown links, heading fragments, wikilinks, aliases, embeds, frontmatter references, inline code, Markdown fences, unmanaged documents, and source highlighting.
- Treat the existing LSP benchmark as the server baseline rather than building a second benchmark harness.
- Identify which current behaviors are editor-neutral Forma semantics and which are Zed-only compatibility projections.
- Keep Generic and VS Code behavior conservative: do not add standard Markdown fallback or code-example navigation without a demonstrated host gap.

### Iteration 1: Normalize LSP Client Profiles

Executed through [[tasks/normalize-forma-lsp-client-profiles]].

- Replace the single URI-style switch with an explicit client behavior profile.
- Keep Zed's positionless `zed://file`, managed Markdown fragment fallback, and bounded code-example projections only where current Zed evidence requires them.
- Use standard `file:` targets for Generic and VS Code clients.
- Preserve managed-document gating, exact UTF-16 ranges, ambiguity behavior, workspace boundaries, dynamic watcher registration, and the absence of semantic tokens.
- Run focused Rust tests and the quick LSP performance suite before continuing.

### Iteration 2: Add A Dormant VS Code LSP Lifecycle

Executed through [[tasks/add-vscode-forma-lsp-lifecycle]].

- Add the Microsoft VS Code Language Client as a bundled runtime dependency through the repository-pinned pnpm toolchain.
- Expose one ready runtime context containing the already resolved, exact-version Forma command and active workspace root; do not create a second binary resolver or downloader.
- Add a lifecycle manager with start, stop, restart, root-switch, cancellation, output, and disposal behavior, but do not activate it for user-facing navigation in this iteration.
- Start no process in Restricted Mode, no-workspace, missing-binary, incompatible-version, unsupported-workspace, or invalid lifecycle states.
- Convert `vscode-remote:` document URIs to Extension Host-visible `file:` protocol URIs and convert returned targets back in the client adapter.
- Measure extension bundle and VSIX size deltas, and test that no process is orphaned after failure or disposal.

### Iteration 3: Switch Definition And DocumentLink

Executed through [[tasks/migrate-vscode-navigation-to-forma-lsp]].

- Activate the Language Client only for the selected active Forma root and managed Markdown documents.
- Replace the adapter-owned Definition and DocumentLink providers with LSP results as one coherent cutover; never leave two providers active for the same Forma syntax.
- Preserve native VS Code navigation for ordinary Markdown.
- Verify wikilink target, alias, fragment, embed, schema-declared frontmatter reference, ambiguity, unresolved target, and unsaved-buffer behavior.
- Keep Hover and saved-document Diagnostics on their existing paths.
- Remove `forma.openReference` and navigation-only adapter code only after parity tests pass; retain shared parsing used by Preview, Hover, or Diagnostics.

### Iteration 4: Validate Active-Root, Remote, Recovery, And Performance

Executed through [[tasks/validate-vscode-lsp-remote-and-performance]].

- Verify local activation and navigation in the maintainer's installed VS Code without downloading or retaining additional local Code.app copies.
- Test one, two, and five discovered roots while asserting that at most one LSP process is running and that switching roots disposes the previous session.
- Test URI conversion for Remote SSH, Dev Containers, or WSL semantics. Record a real remote smoke when an environment is available; otherwise state the unvalidated host matrix explicitly rather than claiming it.
- Kill the server and verify bounded automatic recovery, useful output, and no restart storm.
- Record activation, cold and warm Definition, DocumentLink, connected RSS, idle CPU, process count, document-analysis count, snapshot rebuild count, bundle size, and VSIX size.
- Remove remaining navigation-only duplication, update durable architecture or validation evidence when behavior changes, and run the complete project gate.

## Performance And Resource Gates

- Cold navigation p95 is no more than 250 ms.
- Warm navigation p95 is no more than 100 ms.
- One document version performs at most one Core analysis.
- Warm navigation does not rebuild or rediscover the workspace.
- Unmanaged Markdown produces no Forma analysis, Definition, DocumentLink, or watcher-driven rebuild.
- At most one Forma LSP child process runs for the active VS Code window under this cutline.
- The connected server performs effectively zero intentional idle CPU work.
- Connected RSS, extension activation, bundle size, and VSIX size are recorded. A material unexplained regression requires review rather than a silently increased budget.
- Root switching, process exit, workspace-folder removal, trust changes, and extension disposal leave no orphan process, timer, watcher, or stale provider.

## Stop Conditions

Stop the migration rather than broadening it when:

- VS Code receives Zed-only standard Markdown or code-example fallbacks;
- Forma results appear in unmanaged Markdown documents;
- native and Forma providers return competing results for the same syntax;
- Remote URI conversion escapes the selected workspace or opens a local-machine path;
- the lifecycle requires a second CLI acquisition, version, or trust model;
- one navigation request rebuilds the complete workspace or misses the interaction budget;
- recovery enters a restart loop or resource use grows without a bound;
- progress requires Preview, Explorer, Hover, Diagnostics, multiple concurrent roots, or general RPC migration.

## Suggested Commit Boundaries

1. `test: capture VS Code LSP ownership baseline`
2. `refactor: define Forma LSP client profiles`
3. `test: validate client-specific navigation behavior`
4. `refactor: expose active Forma runtime context`
5. `feat: add dormant VS Code LSP lifecycle`
6. `feat: migrate VS Code navigation to Forma LSP`
7. `test: validate VS Code LSP remote and recovery behavior`
8. `refactor: remove superseded VS Code navigation paths`
9. `docs: record VS Code LSP migration evidence`

## Completion Evidence

- All four linked tasks meet their acceptance criteria and the final validation task records the exact candidate commit.
- `mise run check` passes with the repository-pinned pnpm version.
- Focused LSP, VS Code unit, Extension Host, package, and VSIX smoke checks pass.
- The installed VS Code validates source navigation without a second Forma preview or source-highlighting surface.
- Local resource and performance evidence is recorded; untested remote hosts remain explicitly unclaimed.
- Preview, Explorer, View rendering, health, CLI lifecycle, and native Markdown behavior remain operational and outside the LSP transport.
- Hover and Diagnostics migration remain separate follow-up decisions rather than hidden extensions of this goal.
