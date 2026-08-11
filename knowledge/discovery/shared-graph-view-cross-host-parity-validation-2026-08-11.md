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

This iteration passes the shared projection/model contract, packaged local VSIX smoke, and a real ARM64 Dev Container Graph Preview. It also proves that the official x64 CLI and VS Code extension activate over Remote SSH, but it does not pass the Remote SSH Graph Preview gate: the full-workspace Preview remained blank, and the subsequent small-fixture reconnect failed while establishing dynamic port forwarding on the 1 vCPU, 967 MiB server.

The task remains Doing. Live high-contrast and reduced-motion sessions, browser first-meaningful-render and interaction timing, and long-running retained-memory and idle-CPU profiling remain open. Remote SSH Preview should be repeated on a larger or more stable host before it becomes a release gate.

The Graph parity implementation is commit `868b868`. The aggregate delivery gate was rerun successfully after the independent dependency-refresh commit `6342e24`.

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

## Real Remote Evidence

### Dev Container

Podman `6.0.2` used the running Apple Hypervisor ARM64 machine with a dedicated `node:lts-trixie` container and a read-only workspace mount. The official `forma-linux-arm64.tar.gz` asset for v0.1.30 was assembled from HTTP range responses and matched SHA-256 `7cd4e955698990dc994156fd66067c65feb051d3fc890796b62779923118532c`.

VS Code `1.132.0` attached through Dev Containers `0.466.0`, installed the candidate VSIX into the Remote Extension Host, and reported `Forma: Ready`. The real workspace Graph rendered with Page labels and the taxonomy legend. Expand, Preview disposal, and reopen interactions passed. The isolated VS Code window and dedicated container were removed after validation; existing user containers were not touched.

### Remote SSH

The test server is Debian 13 x64 with glibc 2.41, 1 vCPU, 967 MiB RAM, 1 GiB swap, and approximately 20 GiB free disk. The official `forma-linux-x64.tar.gz` asset matched SHA-256 `9ddc100346392a19443ef813cd796f81f384e5a1320ca5a172887dd424a8de5a`, and `forma 0.1.30` passed configuration summary, workspace health, and Graph View rendering from the committed workspace snapshot.

VS Code Remote SSH `0.124.0` installed the candidate VSIX, started the Remote Extension Host, and reached `Forma: Ready`. The full-workspace native Markdown Preview webview remained blank after 30 seconds. The server still had 177 MiB available memory and used swap, with several VS Code Server processes dominating RSS. Reusing the same window for the small fixture then failed to establish dynamic port forwarding. This host is suitable for CLI and LSP functional smoke, but not accepted as a stable Graph Preview or performance environment.

The Remote SSH and Dev Container VS Code windows were closed immediately after use. The dedicated Podman container, remote test directory, and temporary `/usr/local/bin/forma` installation were removed after exact-target and checksum checks.

## Remaining Gates

- Repeat Remote SSH Graph Preview on a host with at least 2 vCPU and 2–4 GiB RAM, then exercise render, expand, source activation, reload, and disposal.
- Run live light, dark, high-contrast, and reduced-motion sessions; automated policy coverage is not a substitute for the visual checks.
- Capture browser first meaningful render, layout settle, longest main-thread task, and interaction responsiveness for 25, about 500, and about 5,000 nodes.
- Measure idle CPU after settling and retained memory after repeated Preview disposal in both Hosts.
- Define separate budgets for the WebApp Worker settle path and the VS Code synchronous policy instead of treating final coordinates as a parity requirement.

## Verification Commands

- `pnpm exec vitest run packages/graph-view/src`
- `pnpm exec vitest run packages/webapp/src/features/dashboard/graph-adapter-parity.test.ts extensions/vscode/src/graph-preview.test.ts`
- `pnpm exec vitest bench packages/graph-view/src/layout.bench.ts --run`
- `mise run check`
- `forma config summary --json`
- `forma workspace health --json`
- `forma view render .forma/views/workspace-graph --json`
