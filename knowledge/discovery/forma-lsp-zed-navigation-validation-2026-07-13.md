---
scope: project
type: technical-assessment
title: Forma LSP And Zed Navigation Validation — 2026-07-13
summary: Records automated correctness, performance, resource, and packaging evidence for the first Forma LSP and Zed navigation slice, with real Zed interaction still pending.
owners:
    - "members/tiscs"
tags:
    - discovery
    - lsp
    - zed
    - performance
    - validation
sources:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "tasks/implement-forma-lsp-foundation"
    - "tasks/validate-zed-link-navigation"
---

# Forma LSP And Zed Navigation Validation — 2026-07-13

## Outcome

The editor-neutral LSP foundation is complete and passes the automated delivery gates. Core owns transient reference semantics, the long-lived session reuses a rebuildable in-memory snapshot, and the Zed extension remains a thin WASM adapter that invokes `forma lsp` from the worktree environment.

The measured implementation stays inside the accepted interaction budgets through the 5,000-entry fixture. Warm Definition p95 remains below 0.2 ms, connected RSS remains below 33 MiB, and the server performs no intentional idle CPU work on the measured host.

Real Zed interaction is not yet recorded. The local Dev Extension must still be installed and exercised in source mode before [[tasks/validate-zed-link-navigation]] can move to `done`.

## Validated Behavior

Automated Core and protocol tests cover:

- Markdown links and images, wikilinks, aliases, embeds, and heading fragments;
- schema-declared frontmatter references, including multiple owners, nested and repeated values, comments, quoted values, and CRLF;
- ordinary frontmatter strings that resemble paths without becoming references;
- unresolved targets, multiple ambiguity candidates, external links, and local non-Markdown resources;
- UTF-16 positions with Chinese text and surrogate-pair emoji;
- full-text `didOpen`, `didChange`, `didSave`, and `didClose` overlays;
- workspace-boundary rejection, malformed-request recovery, shutdown, exit, and process restart;
- one document analysis per overlay version and snapshot reuse across warm requests.

The persistent validation fixture is `examples/getting-started-workspace/tasks/validate-editor-link-navigation.md`. The example workspace passes `forma check --json` with no diagnostics.

## Performance Evidence

The baseline used the release `forma` binary, 50 warm repetitions, the current project workspace, and generated 1,000- and 5,000-entry workspaces.

| Workspace | Initialize | Cold Definition | Warm Definition p95 | Warm DocumentLink p95 | Connected RSS | Idle CPU |
| --------- | ---------: | --------------: | ------------------: | --------------------: | ------------: | -------: |
| Project   |    4.36 ms |        95.59 ms |             0.15 ms |               0.05 ms |     26.34 MiB |       0% |
| 1,000     |    4.04 ms |        38.55 ms |             0.10 ms |               0.08 ms |     15.67 MiB |       0% |
| 5,000     |    3.99 ms |       183.04 ms |             0.15 ms |               0.11 ms |     32.31 MiB |       0% |

The 5,000-entry cold Definition result is below the 250 ms cold gate. All warm results are well below the 100 ms gate. The one-second idle CPU-time delta was zero for all measured workspaces.

The benchmark is reproducible through:

- `mise run perf:lsp:quick`
- `mise run perf:lsp:baseline`

Generated JSON evidence remains under `target/performance/` and is intentionally not committed.

## Verification Commands

- `cargo test -p forma-core -p forma-lsp --locked`
- `cargo check -p forma-zed-extension --target wasm32-wasip1`
- `node scripts/lsp-performance-benchmark.mjs --mode baseline`
- `forma --workspace examples/getting-started-workspace check --json`
- `CI=true mise run check`
- `node scripts/check-release-version.mjs`

The aggregate check includes Rust formatting, compilation and workspace tests; TypeScript checks, lint, builds and tests; release-version normalization tests; and the Zed WASM check. `CI=true` supplies pnpm's required non-interactive purge behavior in the Agent environment and does not relax the project checks.

## Remaining Editor Gate

Install `extensions/zed/` as a local Zed Dev Extension while a worktree-matching `forma` binary is available through the Zed worktree environment. Then verify:

1. Markdown, wikilink, alias, fragment, embed, and multi-owner frontmatter navigation.
2. Ordinary string and unresolved values do not open an arbitrary target.
3. Ambiguous Definition offers all candidates.
4. Unsaved source changes participate immediately.
5. Save-triggered scope rebuild and server restart recover without material protocol errors.

No Zed registry publication, CLI acquisition, VS Code migration, Preview, or Forma release belongs to this validation slice.
