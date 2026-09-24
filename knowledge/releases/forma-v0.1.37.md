---
schemaVersion: 1
kind: release
title: Forma v0.1.37
summary: Read-only Calendar and Gantt Views, shared temporal contract fixtures, editor coverage, and coordinated toolchain refresh.
scope: project
type: release
status: released
version: v0.1.37
date: 2026-09-24
owners:
    - members/tiscs
tags:
    - release
    - public-preview
    - calendar
    - gantt
relatedTasks:
    - tasks/define-temporal-view-contract
    - tasks/implement-read-only-calendar-view
    - tasks/validate-lightweight-gantt-view
    - tasks/cover-temporal-view-contract-in-committed-fixtures
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.37

## Scope

Coordinated Public Preview release after [[releases/forma-v0.1.36]], delivered through [[planning/temporal-view-release-plan]]. Core, CLI, shared projections, WebApp, VS Code, and the aligned Zed package use version 0.1.37. The immutable source candidate is `12c7dd69a9ce5b96ebb05718adc87b2839ca6df6`. Later uncommitted dependency updates and unrelated Task governance edits were excluded.

## Included Changes

- Calendar: explicit date/datetime bindings, workspace timezone semantics, diagnostics, classification, responsive month/Agenda presentations, complete day drawers, and native month/date navigation.
- Gantt: read-only day-resolution intervals, explicit milestones, progress labels/fills, dependency accounting, complete anchored-edge rendering, fan-out lanes, windowed rows, and selected-row locating.
- Static HTML and VS Code: semantic Calendar Agendas and complete Gantt lists with source navigation. These surfaces do not provide the WebApp's interactive timeline or month grid.
- Dedicated real-Core temporal fixtures and shared consumer assertions, a healthy manual validation corpus, and temporal editor-host verification.
- Editor refresh isolation: new callers do not reuse already-cancelled work while the old process is still exiting, and stale preview completions cannot overwrite a newer refresh.
- Coordinated dependency/toolchain maintenance, Lucide editor-build compatibility, and the Zed WASI target.

No specialized Calendar/Gantt runtime dependency is added. Existing View meanings remain unchanged. There is no scheduling engine, drag-to-reschedule, write-back, recurrence, resource planning, or graph-aware row ordering.

## Validation

Local candidate preparation gates passed. [[planning/temporal-view-release-plan]] records the source-bound fixtures, three browser engines, deterministic static output, zero-diagnostic content/health checks, five example workspaces, and the complete repository gate (76 TypeScript files / 494 tests plus all Rust workspace tests, builds, types, lint, formatting, and Zed WASI checking). The complete gate was repeated in a clean detached candidate checkout with frozen dependencies. Exact-candidate main CI, publication, and published-asset verification also passed, as recorded below.

The source compatibility baseline remains VS Code 1.123.2; its September support-policy review remains current. A source integration run on minimum/stable does not replace packaged-VSIX installation verification.

Trusted integration passed on VS Code 1.123.2 and 1.139.0; a separate restricted-mode test passed. After fixing two deterministic asynchronous refresh defects found during packaging verification, the final `choral-io.forma@0.1.37` VSIX passed three consecutive installation smoke runs on 1.123.2, including Calendar agenda, Gantt complete-list, source-link, and progress assertions through the built-in Markdown renderer. Local artifact: 219,617 bytes; SHA-256 `5ef5f9820b75ed86de322aeb91f662d432e44e1ec71b98d38e6abc9271ddc84f`. This local hash does not assert identity with any future published artifact.

## Delivery Acceptance — 2026-09-24

The maintainer explicitly accepted the four related temporal delivery Tasks. Calendar host visual checks passed on VS Code 1.123.2 at narrow/wide preview widths in built-in light/dark themes, including source-link keyboard navigation; see [[design/calendar-view-validation-2026-09-21]]. Post-candidate UI polish adds intrinsic capped Gantt height and container-responsive Calendar density. These changes passed targeted three-engine checks and the full local gate and are included in the published candidate. Task acceptance and release approval were separate decisions. Day-resolution Gantt rendering remains the accepted scope; fractional-day geometry is deferred.

The maintainer subsequently authorized pushing the completed candidate on 2026-09-24 to run exact-source main CI. The maintainer later separately approved Release and Marketplace publication. Uncommitted dependency upgrades and unrelated Task governance changes are excluded from this candidate.

## Published Release Verification — 2026-09-24

- [Main CI 35994091126](https://github.com/choral-io/choral-forma/actions/runs/35994091126) passed for exact source `12c7dd69a9ce5b96ebb05718adc87b2839ca6df6`.
- [Release workflow 36009565231](https://github.com/choral-io/choral-forma/actions/runs/36009565231) passed every job, including all five CLI platforms, VSIX build, source-bound assembly, protected promotion, published verification, and Marketplace publication.
- Annotated tag `v0.1.37` is object `f13f6105aa7a22847d71f55147bb39ea89be55ad`, peeling to the exact candidate above. It was not moved or recreated during verification.
- [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.1.37) was published at `2026-09-24T14:25:22Z`, with `draft=false` and `prerelease=false` and all 22 expected assets.
- `mise run release:verify -- v0.1.37` passed from the clean candidate checkout on macOS arm64. All 11 payloads matched their published SHA-256 files. The downloaded native CLI and a fresh installation through the production managed-install code both executed as `forma 0.1.37`; temporary verification downloads and managed storage were cleaned.
- Native `forma-macos-arm64` SHA-256: `fd633d2f17db83c760235583033bae9d614c87444976246cdfa66f61d2f2478e`.
- Published VSIX: `choral-io.forma@0.1.37`, engine `^1.123.2`, 219,617 bytes, SHA-256 `979e1bc614d3cb677809de1a367d0d2ccd72572ee82c7a293ee4d035981014bf`. This is the published artifact identity, distinct from the earlier local package hash.
- Marketplace readback through `vsce show choral-io.forma --json` found `0.1.37`, last updated `2026-09-24T14:34:29.507Z`; its `Microsoft.VisualStudio.Services.VsixSha256` matches the published VSIX above.

The maintainer separately authorized pushing and then the complete release, including GitHub and Marketplace publication. Earlier authority boundaries in Delivery Acceptance describe their original stages and are superseded by those approvals. Transient local EOF/TLS failures interrupted monitoring, not the successful workflow; all final facts above were read back after connectivity recovered. Release evidence is committed separately from the immutable source tag.

## Known Boundaries

- Every anchored edge is displayed regardless of row count. The maintainer accepted dense connector appearance and deferred further routing optimization.
- Small transient month-heading jitter remains an accepted presentation limitation.
- Installed Safari, physical mobile devices, and real screen-reader announcements remain unverified. On 2026-09-24 the maintainer explicitly accepted deferring these checks for this release while retaining the limitations. Browser-engine tests and emulation are separate evidence, not substitutes for these checks.
- Remote SSH, Dev Container, WSL, signing, notarization, and Zed Registry publication are not established by local checks.

## Executed Rollout

1. Completed local version, repository, content, browser, and packaged-editor gates; committed the concrete candidate.
2. Pushed after approval and confirmed main CI for that exact SHA.
3. Dispatched the protected Release workflow with `0.1.37`; production and Marketplace jobs completed successfully.
4. Ran `mise run release:verify -- v0.1.37` and recorded exact assets, hashes, CLI/VSIX identity, and managed-install results.
5. Prepared this record and the delivery ledger as separate post-release evidence, with the release-record and content checks.

## Rollback Plan

Before publication, correct the candidate and repeat its affected checks and complete final gates. After publication, preserve the immutable tag and assets and publish a higher coordinated version for corrections.
