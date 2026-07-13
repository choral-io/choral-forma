---
scope: project
type: technical-assessment
title: Forma LSP And Zed Navigation Validation — 2026-07-13
summary: Records automated and real-editor correctness, performance, resource, packaging, navigation, and wikilink highlighting evidence for the first Forma LSP and Zed slice.
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

The local Zed Dev Extension was built, installed, cold-started, restarted, and exercised in `examples/getting-started-workspace/`. Navigation, unsaved overlays, ambiguity handling, restart recovery, and theme-aligned wikilink target highlighting all passed. [[tasks/validate-zed-link-navigation]] is complete.

## Validated Behavior

Automated Core and protocol tests cover:

- Markdown links and images, wikilinks, aliases, embeds, and heading fragments;
- schema-declared frontmatter references, including multiple owners, nested and repeated values, comments, quoted values, and CRLF;
- ordinary frontmatter strings that resemble paths without becoming references;
- unresolved targets, multiple ambiguity candidates, external links, and local non-Markdown resources;
- UTF-16 positions with Chinese text and surrogate-pair emoji;
- full-text `didOpen`, `didChange`, `didSave`, and `didClose` overlays;
- full-document semantic tokens for wikilink and embed targets, with UTF-16 ranges;
- workspace-boundary rejection, malformed-request recovery, shutdown, exit, and process restart;
- one document analysis per overlay version and snapshot reuse across warm requests.

The persistent validation fixture is `examples/getting-started-workspace/tasks/validate-editor-link-navigation.md`. The example workspace passes `forma check --json` with no diagnostics.

## Real Zed Evidence

The Dev Extension compiled to WASM and installed locally in Zed. After a full editor restart, Zed resolved the preinstalled matching `0.1.0-alpha.17` CLI from the global mise installation, started it with the example workspace root, and reported no Forma LSP errors. Unrelated edit-prediction requests continued to report HTTP 403 and are not caused by Forma.

Direct source-mode checks passed for:

- both values in the multi-owner frontmatter list;
- relative Markdown links and heading fragments;
- ordinary, aliased, and heading-fragment wikilinks;
- Obsidian-style embeds;
- ordinary frontmatter strings and fenced examples remaining inert;
- an unsaved wikilink resolving immediately through the document overlay;
- an unresolved unsaved reference remaining in place;
- an ambiguous basename opening Zed's Definitions multibuffer with both candidates;
- navigation continuing after `editor: restart language server` and after a full Zed restart.

Zed's native Markdown Tree-sitter query classifies wikilink targets as `text.literal.markup`, which the active theme renders like emphasized link text. Forma now returns standard LSP `string` semantic tokens only for the target portion of wikilinks and embeds. With Markdown semantic tokens in `combined` mode, the target adopts the active theme's link-target/string style while aliases retain the Markdown link-text style. The example workspace records this setting in `.zed/settings.json`; the extension README documents it for other workspaces.

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

## Residual Zed Constraints

- Zed keeps semantic tokens off by default. Workspaces must enable `combined` mode for Markdown to receive Forma's theme-aligned wikilink target styling.
- The current Zed extension manifest registers Forma for the built-in Markdown language. It cannot express an activation condition based on the presence of `.forma.md`, so Zed may ask the adapter to start in non-Forma Markdown worktrees. Workspace-aware activation or a graceful no-workspace path remains an MVP design concern.
- The Dev Extension requires a matching preinstalled CLI. CLI acquisition, registry publication, Preview, and additional project UI remain outside this validation slice.
