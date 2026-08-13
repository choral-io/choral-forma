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

This iteration passes the shared projection/model contract, packaged local VSIX smoke, a real ARM64 Dev Container Graph Preview, the 2026-08-12 local WebApp and packaged VS Code performance and accessibility follow-up, and the 2026-08-13 Remote SSH acceptance loop. Browser evidence covers first render, layout settle, longest task, reset responsiveness, 30-second idle samples, high contrast where supported, reduced motion, repeated Preview disposal, Remote source navigation, window reload restoration, and 5,000-node Remote interaction.

The exact `d57079e3e734206cee8f34a169837ea8c3a74727` candidate was already pushed and passed main CI run `31596442939`. Its CI-produced Linux x64 CLI and VSIX were used on `tiscs@10.0.0.53`. The complete Remote loop passed, all validation-created state was restored to the recorded baseline, and the task is now ready for review.

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
- 67 pnpm test files and 394 tests in the final aggregate run;
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

## Recorded Acceptance Budgets And 2026-08-13 Closeout

The following budgets are the first release baseline for the shared Graph surface. They use rounded product-level ceilings rather than the exact observations and are evaluated separately for each Host policy. They are not presented as pre-existing regression thresholds.

| Surface and fixture | Recorded budget | Observed | Result |
| --- | --: | --: | --- |
| WebApp, about 500 nodes, first render | at most 200 ms | 76.4 ms | Pass |
| WebApp, about 5,000 nodes, first render | at most 200 ms | 108.3 ms | Pass |
| WebApp, about 500 and 5,000 nodes, Worker settle | at most 1,500 ms | 1,247.1 ms and 1,239.0 ms | Pass |
| WebApp, about 500 and 5,000 nodes, longest main-thread task | at most 150 ms | 76.0 ms and 108.7 ms | Pass |
| WebApp, about 5,000 nodes, reset to next paint | at most 50 ms | 18.5 ms | Pass |
| WebApp, settled 30-second main-thread share | at most 1% of one core | 0.047% | Pass |
| Packaged VS Code, 25 nodes, first render and synchronous settle | at most 100 ms | 26.4 ms | Pass |
| Packaged VS Code, 25 nodes, reset to next paint | at most 50 ms | 17.3 ms | Pass |
| Packaged VS Code, about 500 nodes, first render and synchronous settle | at most 200 ms | 100.7 ms | Pass |
| Packaged VS Code, about 500 nodes, longest main-thread task | at most 150 ms | 109 ms | Pass |
| Packaged VS Code, about 500 nodes, reset to second animation frame | at most 50 ms | 13.9 ms worst of five | Pass |
| Remote packaged VS Code, about 5,000 nodes, first render and synchronous settle | at most 200 ms | about 124 ms | Pass |
| Packaged VS Code, settled 30-second process-group CPU | at most 1% of one core | about 0.67% | Pass |
| Large Graph projection stdout | at most 8 MiB | 2,314,372 bytes | Pass |
| WebApp disposal, second block of ten route cycles | at most 1 MiB retained-heap growth and zero canvases | about 28 KiB and zero canvases | Pass |
| VS Code disposal reachability | zero Graph iframe targets and zero Forma-owned canvas resources after close | zero | Pass |

The VS Code natural renderer heap high-water remains a diagnostic risk outside the reachability gate: it reached about 2.84 GiB before an explicit DevTools collection reduced it to about 773 MiB. This result must not be reinterpreted as immediate natural memory reclamation.

### Bundle Delta

Bundle comparisons use the immediate code-integration parent and child commits, each exported with `git archive`, installed from its own frozen lockfile, and built with the same local pnpm 11.20.0 executable. The historical repositories requested pnpm 11.13.1, so the measurements are comparable within each pair but do not claim byte identity with the original CI builders.

| Surface | Baseline -> integration | Budget | Observed delta | Integrated artifact | Result |
| --- | --- | --: | --: | --: | --- |
| WebApp `dist/assets` | `9bb14df` -> `deeb79b` | at most 128 KiB raw and 32 KiB gzip | +34,421 bytes raw (+0.323%); +10,012 bytes gzip (+0.441%) | 10,677,727 bytes raw; 2,282,532 bytes gzip | Pass |
| VSIX | `f171b40` -> `a86187b` | at most 64 KiB delta and 256 KiB final | +56,046 bytes (+54.73 KiB; +37.54%) | 205,324 bytes (200.51 KiB) | Pass |

The WebApp migration moved Graph into a lazy `ViewGraphProjection` chunk of 198,412 bytes raw and 48,815 bytes gzip while reducing the main entry chunk. The final `09a6788` review candidate packages as a 215,839-byte (210.78 KiB) VSIX, still below the 256 KiB absolute budget.

The packaged VS Code medium-fixture closeout used VS Code 1.133.0 arm64 and `choral-io.forma@0.1.30` from the `09a6788` candidate in disposable user-data and extension directories. The real native Markdown Preview rendered one Graph Host for the 500-node, 1,500-edge field View. Mount to first Sigma render and synchronous settle was 100.7 ms. A buffered Long Task observer recorded 109 ms as the longest initial main-thread task. After foregrounding the Webview to avoid Chromium's background `requestAnimationFrame` pause, five F-reset handler samples reached the second animation frame in 7.4-13.9 ms. The isolated VS Code process, CDP session, VSIX, user-data, and extensions were removed after the result and screenshot were copied to ignored `target/performance/` evidence.

### Refresh Movement

A real-Chrome policy harness instantiated the shared runtime with the exact Host layout settings: WebApp Worker layout and VS Code synchronous layout. The adapter parity tests separately cover Host projection mapping. For each Host, five independent page reloads used the deterministic approximately 500-node and 5,000-node fixtures, replaced 2% of nodes, removed their incident edges, attached each replacement to three surviving nodes, retained the selected node, and waited through the WebApp's 1,200 ms Worker window plus two animation frames.

Movement is measured for surviving nodes after anchoring each snapshot on the selected node and normalizing by that snapshot's maximum graph span. The hard budget is 100% finite positions and selection retention; the stability budget is p95 movement at most 1% of the normalized span and at most 1% of surviving nodes moving more than 5% of the span.

The first measurement found a shared-runtime defect: projection refresh reused coordinates and then started another whole-graph layout. Across five pre-fix runs, the approximately 500-node WebApp policy reached a worst p95 of 39.64% with 98.37% of surviving nodes above the 5% threshold; VS Code reached p95 6.78% with 31.43% above the threshold. Commit `09a6788` keeps initial Host layout behavior unchanged, but projection refresh now preserves surviving coordinates and uses the existing neighbor-aware deterministic seed only for new nodes.

| Host policy | Fixture | Worst p50 / p95 / maximum across five post-fix runs | Nodes above 5% span | Selection and finite positions | Result |
| --- | --: | --: | --: | --- | --- |
| WebApp Worker | about 500 nodes | 0% / 0% / 0% | 0% | 100% | Pass |
| WebApp Worker | about 5,000 nodes | 0% / 0% / 0% | 0% | 100% | Pass |
| VS Code synchronous | about 500 nodes | 0% / 0% / 0% | 0% | 100% | Pass |
| VS Code synchronous | about 5,000 nodes | 0% / 0% / 0% | 0% | 100% | Pass |

The compact raw summary remains intentionally uncommitted under `target/performance/`; the reproducible browser harness is tracked at `packages/webapp/scripts/graph-refresh-movement-gate.html`. The runtime contract is preserved by focused tests that assert refresh sessions start neither synchronous nor Worker layout, surviving positions remain exact, and a new linked node is seeded near its existing neighbor.

## 2026-08-12 Local Host Follow-Up

### VS Code Output Budgets

The original 1 MiB combined-process-output limit blocked the observed 2,314,372-byte 5,000-node `view render` payload. The client now bounds stdout and stderr independently:

- `check`, `workspace health`, `workspace dashboard`, and `view render` receive an 8 MiB stdout budget;
- `config inspect`, Explorer, entry inspection, reference resolution, and other smaller calls keep the 1 MiB stdout budget;
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

### 2026-08-12 Unsuccessful Remote SSH Attempt

The approved host is reachable at the TCP layer on port `8022`, but it closes after the local SSH version is sent and before the server banner or key exchange. Port `22` completes SSH negotiation but rejects the available public key. Because authentication never began on `8022`, this follow-up created no directories, installed no extension or CLI, and changed no remote files or services. There is therefore no new remote state to clean, and the earlier instruction to preserve incomplete validation state does not apply to any newly created state in this attempt.

## Real Remote Evidence

### Dev Container

Podman `6.0.2` used the running Apple Hypervisor ARM64 machine with a dedicated `node:lts-trixie` container and a read-only workspace mount. The official `forma-linux-arm64.tar.gz` asset for v0.1.30 was assembled from HTTP range responses and matched SHA-256 `7cd4e955698990dc994156fd66067c65feb051d3fc890796b62779923118532c`.

VS Code `1.132.0` attached through Dev Containers `0.466.0`, installed the candidate VSIX into the Remote Extension Host, and reported `Forma: Ready`. The real workspace Graph rendered with Page labels and the taxonomy legend. Expand, Preview disposal, and reopen interactions passed. The isolated VS Code window and dedicated container were removed after validation; existing user containers were not touched.

### Remote SSH

The test server is Debian 13 x64 with glibc 2.41, 1 vCPU, 967 MiB RAM, 1 GiB swap, and approximately 20 GiB free disk. The official `forma-linux-x64.tar.gz` asset matched SHA-256 `9ddc100346392a19443ef813cd796f81f384e5a1320ca5a172887dd424a8de5a`, and `forma 0.1.30` passed configuration summary, workspace health, and Graph View rendering from the committed workspace snapshot.

VS Code Remote SSH `0.124.0` installed the candidate VSIX, started the Remote Extension Host, and reached `Forma: Ready`. The full-workspace native Markdown Preview webview remained blank after 30 seconds. The server still had 177 MiB available memory and used swap, with several VS Code Server processes dominating RSS. Reusing the same window for the small fixture then failed to establish dynamic port forwarding. This host is suitable for CLI and LSP functional smoke, but not accepted as a stable Graph Preview or performance environment.

The Remote SSH and Dev Container VS Code windows were closed immediately after use. The dedicated Podman container, remote test directory, and temporary `/usr/local/bin/forma` installation were removed after exact-target and checksum checks.

### Accepted Remote SSH Run — 2026-08-13

The accepted host `tiscs@10.0.0.53` ran Debian 13 x64 with 4 CPUs, 7.8 GiB RAM, no swap, and approximately 24 GiB free disk. Baseline inspection found no `forma` executable, no `~/.vscode-server`, and no validation directory. The run created only `/home/tiscs/choral-forma-validation-d57079e`, allowed Remote SSH to create `~/.vscode-server`, and did not change system packages, services, or `/usr/local/bin`.

The exact CI artifacts for `d57079e` were verified before use. The CLI passed configuration summary, workspace health, field Graph render, and taxonomy Graph render for the empty, 25-node, approximately 500-node, and 5,000-node fixtures. The field Graph outputs were 604, 12,826, 232,123, and 2,314,372 bytes respectively; the large result confirms that the scoped 8 MiB `view render` stdout budget covers the observed payload without raising smaller-operation budgets.

VS Code `1.132.1` with Remote SSH `0.124.0` installed `choral-io.forma@0.1.30` into the Remote Extension Host and reached `Forma: Ready`. The 25-node Preview rendered one Graph host, eight Sigma canvases, and one expand control. A real node selection navigated the native Markdown Preview to `notes/note-00023.md`; expand and Escape passed. After `Developer: Reload Window`, `Forma: Ready` returned and exactly one Graph host, eight canvases, and one expand control were restored.

Ten small-fixture Preview open/close cycles followed by a final 30-second wait left zero Webview iframe targets. Across the approximately 53-second process sample, the Remote Extension Host accumulated no additional whole CPU second and the Forma LSP remained at 0 CPU seconds; relevant RSS values did not show per-cycle growth. This evidence covers the Remote Extension Host and LSP separately from the earlier local Webview renderer measurements.

The same isolated VS Code window then rendered the 5,000-node and 5,000-edge field Graph. Mount to first Sigma paint and synchronous layout settlement was approximately 124 ms. Selection produced a real `notes/note-04957.md` summary; F reset, expand, Escape, and close passed. When the VS Code window was backgrounded, Chromium correctly reported the Webview hidden and paused the 250 ms camera animation; once foregrounded, the trusted F key reset the camera to `{x: 0.5, y: 0.5, ratio: 1, angle: 0}`. After close, zero iframe targets remained. At the final sample, the Remote Extension Host had accumulated 2 CPU seconds over 377 seconds and used 160,700 KiB RSS, while the large-workspace Forma LSP had accumulated 0 CPU seconds and used 45,288 KiB RSS.

The complete change log, four-fixture CLI results, and three process snapshots were copied to ignored local evidence under `target/validation/remote-ssh-10.0.0.53/` before cleanup. The isolated local VS Code instance was released. Only validation-owned remote processes and the exact validation root, validation-created `~/.vscode-server`, and three observed validation-created `/tmp/code-*` paths were removed. Post-cleanup checks found both remote directories absent, zero matching processes, zero matching temporary paths, and no remaining validation-created loopback listeners. Pre-existing services and listeners were unchanged.

## Review Boundary And Residual Risks

- Carry the VS Code reduced-motion propagation gap and natural renderer high-water behavior as explicit Host risks; do not describe either as resolved by shared-runtime unit coverage.
- Preserve the explicit Host layout boundary: WebApp Worker settlement and VS Code synchronous layout are comparable policy outcomes, not identical final coordinates.
- The validation task is ready for Human review; acceptance and a later move from Reviewing to Done remain separate decisions.

## Verification Commands

- `pnpm exec vitest run packages/graph-view/src`
- `pnpm exec vitest run packages/webapp/src/features/dashboard/graph-adapter-parity.test.ts extensions/vscode/src/graph-preview.test.ts`
- `pnpm exec vitest bench packages/graph-view/src/layout.bench.ts --run`
- `VSIX_OUT=/tmp/forma-review.vsix pnpm --filter forma package:vsix`
- Real-Chrome refresh gate: serve `packages/webapp/scripts/graph-refresh-movement-gate.html` from `packages/webapp` with Vite, then run five fresh page loads; the harness publishes `window.__formaGraphRefreshMovementResult`.
- Packaged VS Code medium gate: install the candidate VSIX into disposable `--user-data-dir` and `--extensions-dir`, open `target/validation/wsl2/fixtures/medium/.forma/views/graph-by-field.md`, click `Open Preview to the Side`, and read `forma.graph.vscode.*` marks plus buffered Long Tasks from the Markdown Preview OOPIF over CDP. Foreground the window before the five F-reset two-frame samples.
- `mise run check`
- `forma config summary --json`
- `forma workspace health --json`
- `forma view render .forma/views/workspace-graph --json`
