---
scope: project
type: technical-assessment
title: Shared Graph View Cross-Host Parity Validation — 2026-08-11
summary: Records automated parity, packaged VSIX, Dev Container, Remote SSH, performance, and residual evidence for the shared Graph runtime.
owners:
    - "members/tiscs"
tags:
    - discovery
    - graph
    - vscode
    - webapp
    - remote
    - performance
    - validation
sources:
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/implement-shared-graph-view-runtime"
    - "tasks/migrate-webapp-to-shared-graph-view"
    - "tasks/integrate-shared-graph-view-vscode-preview"
    - "tasks/validate-shared-graph-view-cross-host-parity"
---

# Shared Graph View Cross-Host Parity Validation — 2026-08-11

## Outcome

This iteration passes the shared projection/model contract, packaged local VSIX smoke, a real ARM64 Dev Container Graph Preview, and the 2026-08-12 local WebApp and packaged VS Code performance and accessibility follow-up. Browser evidence now covers first render, layout settle, longest task, reset responsiveness, 30-second idle samples, high contrast where supported, reduced motion, and repeated Preview disposal.

The task remains Doing because the approved Remote SSH host at `114.67.117.38:8022` currently closes the connection before SSH key exchange. The complete current-candidate Remote interaction loop, push, and CI confirmation remain open. No remote state was changed during the failed 2026-08-12 connection attempts.

The Graph parity implementation is commit `868b868`. The aggregate delivery gate was rerun successfully after the independent dependency-refresh commit `6342e24`.

The 2026-08-12 follow-up adds bounded VS Code workspace-output handling in `89f3f1a`, runtime timing marks in `2d18798`, and explicit Graph WebGL and canvas disposal in `8ae1b68`, `258090e`, and `b139b82`.

## Shared Contract Evidence

The WebApp and VS Code adapters now run the same empty, small, medium, and large projections through `packages/graph-view`. A dedicated semantic fixture additionally covers:

- long labels and the shared truncation policy;
- reciprocal references and edge aggregation;
- unresolved targets and their omission from the rendered model;
- configured taxonomy colors.

Shared runtime tests cover Enter activation, Escape clearing, fit/reset keyboard behavior, selected-node summaries, taxonomy legends, reduced-motion policy, theme-derived presentation, and disposal. The WebApp adapter test title now describes the comparison it actually performs instead of claiming an unexecuted VS Code comparison.

Final layout coordinates are not claimed to be identical across Hosts. The WebApp enables Worker layout by default, while VS Code Preview intentionally disables it. For more than 2,000 nodes, the synchronous policy performs zero ForceAtlas2 iterations and supplies deterministic seed coordinates before the WebApp Worker settles the layout. This is an explicit Host-adapter difference, not evidence of duplicate Graph semantics.

## Automated And Packaged Verification

Passed evidence includes:

- 40 shared Graph View tests;
- 16 focused WebApp and VS Code adapter tests;
- 67 pnpm test files and 386 tests in the final aggregate run;
- the Rust workspace, Zed WASM check, formatting, lint, type checks, and production builds through `mise run check`;
- a locally packaged `forma-0.1.30-parity.vsix` with 57 files and a size of 210.32 KiB;
- installed-VSIX activation in 50.413 ms, cold Definition in 35.764 ms, highest warm Definition p95 in 28.881 ms, cold DocumentLink in 1.814 ms, and highest warm DocumentLink p95 in 2.448 ms.

The installed-VSIX runner also opened and closed native Markdown Preview for list, table, kanban, and Graph Views.

## Graph Microbenchmark

The benchmark now separates normalization, model construction, Graphology construction, and synchronous layout. It uses 100 small, 30 medium, and 20 large samples. Five independent local processes were run; raw JSON remains intentionally uncommitted under `target/performance/`.

A representative run measured:

| Fixture           | Normalize mean | Model mean | Graphology mean | Synchronous layout mean |
| ----------------- | -------------: | ---------: | --------------: | ----------------------: |
| 25 nodes          |       0.002 ms |   0.076 ms |        0.039 ms |                2.027 ms |
| about 500 nodes   |       0.037 ms |   1.871 ms |        1.158 ms |               11.704 ms |
| about 5,000 nodes |       0.361 ms |  24.240 ms |       17.567 ms |                0.000 ms |

The 5,000-node synchronous layout result is near zero because the shared policy performs no synchronous ForceAtlas2 iterations above 2,000 nodes. It measures deterministic seeding and construction, not Worker settle, Sigma paint, first meaningful render, interaction latency, disposal memory, or idle CPU. These microbenchmarks are feedback signals rather than browser budgets.

## 2026-08-12 Local Host Follow-Up

### VS Code Output Budgets

The original 1 MiB combined-process-output limit blocked the observed 2,314,372-byte 5,000-node `view render` payload. The client now bounds stdout and stderr independently:

- `config inspect`, `check`, `workspace health`, `workspace dashboard`, and `view render` receive an 8 MiB stdout budget;
- Explorer, entry inspection, reference resolution, and other smaller calls keep the 1 MiB stdout budget;
- every call keeps a separate 64 KiB stderr budget.

The change is covered by operation-specific budget tests, an observed-size regression test, and independent stdout/stderr overflow tests. The larger budget is not applied globally.

### WebApp Browser Measurements

Production WebApp builds were served through the real Forma backend against the same 25-, approximately 500-, and approximately 5,000-node fixture workspaces. Marks distinguish mount, first Sigma paint, and synchronous or Worker layout settlement.

| Fixture | Mount to first render | Mount to layout settle | Longest main-thread task | Settled 30-second main-thread work |
| --- | --: | --: | --: | --: |
| 25 nodes | 49.2 ms | 49.2 ms | 50.0 ms | 9.306 ms |
| about 500 nodes | 76.4 ms | 1,247.1 ms | 76.0 ms | 6.706 ms |
| about 5,000 nodes | 108.3 ms | 1,239.0 ms | 108.7 ms | 14.167 ms |

The approximately 500- and 5,000-node fixtures used the Web Worker settle path. The 5,000-node reset reached the next paint in 18.5 ms. Light and dark themes rendered with shared semantic state, and emulated `prefers-reduced-motion: reduce` changed the large fixture to the synchronous policy after reload. WebApp exposes System, Light, and Dark rather than a dedicated high-contrast mode; high contrast is therefore validated on the VS Code Host under the acceptance criterion's “where supported” boundary.

The WebApp disposal loop reached approximately 15.317 MiB after ten route disposals and 15.346 MiB after twenty, a second-block increase of about 28 KiB with zero retained canvases. This is treated as a plateau rather than per-disposal growth.

### Packaged VS Code Measurements

The current locally packaged VSIX rendered the same 25-node fixture with the repository-built CLI. Selection, keyboard reset, expand and Escape, source activation, theme refresh, and Preview reopen worked. High-contrast tokens resolved to contrast border `#6fc3df` and focus border `#f38518`; labels, edges, legend, summary, controls, and focus remained legible.

With reduced motion present in the Webview media environment, mount to first render and synchronous layout settle were 26.4 ms, reset reached the next paint in 17.3 ms, and interaction state remained correct. However, setting VS Code `workbench.reduceMotion` to `on` and reloading the window did not make the native Markdown Preview Webview report `prefers-reduced-motion: reduce`. CDP media emulation proved that the shared runtime honors the media feature, while the missing VS Code setting propagation is an explicit Host gap.

After layout settlement, the isolated VS Code process group used about 0.20 CPU seconds over a 30-second sample, or approximately 0.67% of one core. Preview disposal fired `pagehide` in both the outer Webview and actual Graph document, removed the iframe target, disconnected Forma observers, destroyed Sigma, lost WebGL contexts, and zeroed canvas backing stores.

Chromium did not naturally collect the detached renderer heap during the 30-second disposal windows: the retained renderer rose from about 1.70 GiB after ten cycles to 2.84 GiB after twenty. A DevTools `HeapProfiler.collectGarbage` call reduced the same renderer to about 773 MiB, and it remained about 773 MiB after the final Preview close and 30-second idle. The evidence shows that the objects are collectible and no longer Forma-reachable, but it also records a significant Host renderer high-water risk rather than claiming that natural disposal immediately returns memory.

The isolated VS Code instance and WebApp browser and server processes were closed immediately after measurement.

### Current Remote SSH Attempt

The approved host is reachable at the TCP layer on port `8022`, but it closes after the local SSH version is sent and before the server banner or key exchange. Port `22` completes SSH negotiation but rejects the available public key. Because authentication never began on `8022`, this follow-up created no directories, installed no extension or CLI, and changed no remote files or services. There is therefore no new remote state to clean, and the earlier instruction to preserve incomplete validation state does not apply to any newly created state in this attempt.

## Real Remote Evidence

### Dev Container

Podman `6.0.2` used the running Apple Hypervisor ARM64 machine with a dedicated `node:lts-trixie` container and a read-only workspace mount. The official `forma-linux-arm64.tar.gz` asset for v0.1.30 was assembled from HTTP range responses and matched SHA-256 `7cd4e955698990dc994156fd66067c65feb051d3fc890796b62779923118532c`.

VS Code `1.132.0` attached through Dev Containers `0.466.0`, installed the candidate VSIX into the Remote Extension Host, and reported `Forma: Ready`. The real workspace Graph rendered with Page labels and the taxonomy legend. Expand, Preview disposal, and reopen interactions passed. The isolated VS Code window and dedicated container were removed after validation; existing user containers were not touched.

### Remote SSH

The test server is Debian 13 x64 with glibc 2.41, 1 vCPU, 967 MiB RAM, 1 GiB swap, and approximately 20 GiB free disk. The official `forma-linux-x64.tar.gz` asset matched SHA-256 `9ddc100346392a19443ef813cd796f81f384e5a1320ca5a172887dd424a8de5a`, and `forma 0.1.30` passed configuration summary, workspace health, and Graph View rendering from the committed workspace snapshot.

VS Code Remote SSH `0.124.0` installed the candidate VSIX, started the Remote Extension Host, and reached `Forma: Ready`. The full-workspace native Markdown Preview webview remained blank after 30 seconds. The server still had 177 MiB available memory and used swap, with several VS Code Server processes dominating RSS. Reusing the same window for the small fixture then failed to establish dynamic port forwarding. This host is suitable for CLI and LSP functional smoke, but not accepted as a stable Graph Preview or performance environment.

The Remote SSH and Dev Container VS Code windows were closed immediately after use. The dedicated Podman container, remote test directory, and temporary `/usr/local/bin/forma` installation were removed after exact-target and checksum checks.

## Remaining Gates

- Restore SSH access to the approved host and run the current packaged candidate through small-fixture source activation, expand and Escape, window reload and Preview restoration, ten disposal cycles, and a 5,000-node render, select, reset, expand, and close loop.
- Record Remote Extension Host CPU and memory separately from the local Webview renderer evidence.
- Push the exact candidate and confirm its main CI gate before assigning the reviewer and moving the task to Reviewing.
- Carry the VS Code reduced-motion propagation gap and natural renderer high-water behavior as explicit Host risks; do not describe either as resolved by shared-runtime unit coverage.

## Verification Commands

- `pnpm exec vitest run packages/graph-view/src`
- `pnpm exec vitest run packages/webapp/src/features/dashboard/graph-adapter-parity.test.ts extensions/vscode/src/graph-preview.test.ts`
- `pnpm exec vitest bench packages/graph-view/src/layout.bench.ts --run`
- `mise run check`
- `forma config summary --json`
- `forma workspace health --json`
- `forma view render .forma/views/workspace-graph --json`
