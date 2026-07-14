---
scope: project
type: technical-assessment
title: VS Code LSP Navigation Validation — 2026-07-14
summary: Records installed-extension correctness, lifecycle recovery, remote URI boundaries, packaging, and performance evidence for the VS Code Definition and DocumentLink migration to Forma LSP.
owners:
    - "members/tiscs"
tags:
    - discovery
    - vscode
    - lsp
    - remote
    - performance
    - validation
sources:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "planning/vscode-lsp-navigation-migration-plan"
    - "tasks/add-vscode-forma-lsp-lifecycle"
    - "tasks/migrate-vscode-navigation-to-forma-lsp"
    - "tasks/validate-vscode-lsp-remote-and-performance"
---

# VS Code LSP Navigation Validation — 2026-07-14

## Outcome

The VS Code Definition and DocumentLink migration passes the automated project, package, installed-VSIX, Restricted Mode, lifecycle, URI-boundary, and performance gates. Forma owns only managed-document navigation through the shared LSP. VS Code retains ordinary Markdown navigation, source highlighting, Preview, and editor behavior; the extension retains Explorer, View rendering, workspace health, Hover, Diagnostics, and CLI lifecycle responsibilities.

The exact code-and-test candidate is commit `b8f028dc07125d8f054fa22c08737bd6b07ef094`. It retains the released `0.1.0-alpha.18` version because this validation did not publish, tag, or select a new release.

## Environment

- Host: macOS arm64.
- Editor: the maintainer's existing official Visual Studio Code `1.128.0`, commit `fc3def6774c76082adf699d366f31a557ce5573f`.
- CLI: locally built `forma 0.1.0-alpha.18` from the candidate source.
- Installed workspace: `/Users/Tiscs/Projects/software-product-rd-workspace`.
- Packaged smoke: the same official VS Code executable with disposable user-data, extension, and workspace directories.
- No additional Code.app was downloaded or retained.

## Navigation And Product Behavior

The packaged-VSIX smoke validates:

- wikilink targets, aliases, heading fragments, and embeds;
- schema-declared frontmatter entry references;
- an unsaved full-text document overlay;
- every candidate for an ambiguous wikilink and no navigation for an unresolved target;
- ordinary tag values remaining non-references;
- native Markdown link ownership remaining with VS Code;
- source opening and native Markdown Preview for list, table, kanban, and deferred Graph Views.

The maintainer's installed workspace additionally passed direct navigation for normal Markdown links, wikilinks, heading fragments, and multi-owner frontmatter values; the Forma Explorer, Hover, saved-document Diagnostics, CLI selection, Task Board Preview, and native Markdown Preview remained operational. The extension no longer registers its superseded adapter Definition, DocumentLink, or `forma.openReference` path.

Restricted Mode ran in a disposable official VS Code profile. It reported `restricted`, kept the LSP state `stopped`, did not execute the configured sentinel binary, and did not create managed CLI storage.

## Active Root And Lifecycle

Automated discovery tests exercise one, two, and five explicit workspace roots without nested scanning. Lifecycle tests select all five roots, observe a maximum of one active client, stop the previous client before starting the next, and remove the final client when the workspace root disappears. A same-root include/configuration scope change restarts the client so `.forma.md` import and managed-file changes cannot leave a stale selector.

Extension wiring refreshes the runtime on workspace-folder changes, Workspace Trust grant, `forma.*` configuration changes, active-root changes, and explicit refresh. Disposal stops and disposes the client. Full packaged Extension Host exit completed without an orphaned test process.

## Failure And Recovery

In the official VS Code window, terminating one active LSP process caused the language client to start one replacement process. Navigation remained available, the replacement was the only Forma LSP child, and its observed idle state was `0%` CPU with approximately `18.6 MiB` RSS.

Rapidly terminating the server inside the 60-second restart window exhausted the bounded budget without a restart storm. Forma Output recorded three bounded restarts followed by the actionable diagnostic:

`[lsp] server repeatedly exited; automatic restart is now stopped.`

The recovery review found one gap: the lifecycle cached a Language Client whose transport had stopped, so an explicit `Forma: Refresh Workspace` could incorrectly treat the same root as already running. Commit `afca7ed` now checks `LanguageClient.isRunning()`, reports the cached state as failed, disposes it, and creates a fresh client. Unit coverage verifies this same-root recovery path.

The final installed VSIX containing that correction is installed in the official editor. The corrected post-budget Refresh path is covered by the lifecycle test rather than a second real-window gesture because macOS locked the interactive session after installation. The required real-window evidence remains the successful single-exit restart and the bounded repeated-exit stop; the skipped post-budget gesture is recorded as residual evidence rather than claimed.

## Remote And Workspace Boundaries

Automated round trips cover `vscode-remote` authorities shaped like Remote SSH, Dev Containers, and WSL. Editor URIs are converted to Extension Host-visible `file:` URIs only inside the selected root and converted back to the original scheme and authority. Cross-authority, sibling-prefix, outside-root, and virtual-workspace URIs are rejected rather than opened as local-machine paths.

No live Remote SSH or Dev Container host was available during this validation. WSL is not available on the macOS host. Codespaces and generic virtual workspaces remain explicitly unsupported and unclaimed. Real-host latency, watcher behavior, reconnect behavior, and CLI acquisition therefore remain future remote smoke work.

## Installed Extension Performance

The installed-VSIX runner records the extension's actual activation duration returned after initial workspace refresh and then issues 50 warm Definition and DocumentLink requests. Five independent disposable VS Code launches provide the cold distribution. The warm result below is the highest per-run p95 across the five launches, a conservative bound over 250 requests.

| Metric                        |    Result |
| ----------------------------- | --------: |
| Extension activation p95      | 93.208 ms |
| Cold Definition p95           | 86.388 ms |
| Highest warm Definition p95   | 17.637 ms |
| Cold DocumentLink p95         |  1.727 ms |
| Highest warm DocumentLink p95 |  3.420 ms |

Cold requests remain below the accepted 250 ms interaction gate and warm p95 remains below 100 ms.

## LSP Baseline

The release binary baseline uses 50 warm repetitions. Generated JSON evidence is `target/performance/lsp-baseline-2026-07-14T15-08-40-321Z.json` and remains intentionally uncommitted.

| Workspace | Initialize | Cold Definition | Warm Definition p95 | Warm DocumentLink p95 | Connected RSS | Idle CPU |
| --- | --: | --: | --: | --: | --: | --: |
| Project | 1,633.666 ms | 125.202 ms | 0.170 ms | 0.053 ms | 24.05 MiB | 0% |
| 1,000 entries | 3.915 ms | 34.856 ms | 0.106 ms | 0.064 ms | 16.92 MiB | 0% |
| 5,000 entries | 3.905 ms | 175.419 ms | 0.102 ms | 0.107 ms | 35.98 MiB | 0% |

Against the preceding recorded baseline, the project RSS decreased from `26.34 MiB` to `24.05 MiB`; 1,000-entry RSS increased from `15.67 MiB` to `16.92 MiB`; and 5,000-entry RSS increased from `32.31 MiB` to `35.98 MiB`. The 5,000-entry result remains below the `64 MiB` single-process budget, while its cold Definition improved from `183.04 ms` to `175.42 ms`. Warm results and zero intentional idle CPU remain stable. Project initialization has substantial cold-cache variance across local runs and has no accepted interaction budget; request latency, not that single startup sample, is the release gate.

Core session tests assert one analysis per document version, no workspace rebuild on warm requests, and no Forma lifecycle or language work for unmanaged Markdown.

## Package Review

| Artifact                  | Before validation |     Candidate |      Delta |
| ------------------------- | ----------------: | ------------: | ---------: |
| Minified extension bundle |     503,295 bytes | 502,879 bytes | -416 bytes |
| VSIX                      |     132,088 bytes | 131,969 bytes | -119 bytes |

The candidate VSIX contains 21 files. The added activation measurement and strengthened smoke coverage do not create a material package-size regression.

## Verification

Passed checks include:

- VS Code extension unit tests: 20 files and 128 tests;
- package script tests: 10 tests;
- installed VSIX smoke with official VS Code `1.128.0`;
- five independent installed-VSIX cold-start samples, each with 50 warm Definition and DocumentLink requests;
- Restricted Mode Extension Host smoke with official VS Code `1.128.0`;
- `mise run perf:lsp:baseline` for the project, 1,000, and 5,000 entries;
- `mise run check`, including 142 pnpm tests, the Rust workspace, Zed WASM check, formatting, lint, type checks, and production builds;
- Forma configuration inspection with no errors or warnings;
- Forma workspace health with only the two pre-existing no-backlink warnings for the Alpha 15 and Alpha 16 release records.

One aggregate rerun exposed a test-only abort race: under parallel load the 5 ms deadline could fire while the fake downloader was writing its partial file, before it registered an abort listener. The test double now checks the already-aborted state before waiting. The focused test completed in 10 ms, and the full aggregate gate passed before the candidate was finalized.

## Residual Risk And Release Cutline

- Optionally repeat the post-budget `Forma: Refresh Workspace` gesture in the official window after macOS is unlocked; the corrected path is already unit-tested, but this specific gesture is not claimed as real-window evidence.
- Run a real Remote SSH or Dev Container smoke before claiming those environments as validated; WSL and virtual workspaces remain unclaimed.
- The project initialization sample is sensitive to filesystem and OS cache state. Keep tracking it, but do not conflate it with Definition or DocumentLink interaction latency.
- Hover and Diagnostics remain on the structured CLI path. Preview, Explorer, View rendering, health, and CLI acquisition remain adapter responsibilities.
- No release was published. A later release decision should select the exact final candidate and run the separate release guideline and CI gates.
