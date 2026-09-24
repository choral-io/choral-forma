---
schemaVersion: 1
kind: release
title: Forma v0.1.37
summary: Read-only Calendar and Gantt Views, shared temporal contract fixtures, editor coverage, and coordinated toolchain refresh.
scope: project
type: release
status: planned
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

Prepare the next coordinated Public Preview release after [[releases/forma-v0.1.36]], following [[planning/temporal-view-release-plan]]. Core, CLI, shared projections, WebApp, VS Code, and the aligned Zed package must use the same coordinated version. The current plan includes the existing local implementation and dependency/toolchain commits; the candidate identifier is recorded only after the complete change is committed.

## Included Changes

- Calendar: explicit date/datetime bindings, workspace timezone semantics, diagnostics, classification, responsive month/Agenda presentations, complete day drawers, and native month/date navigation.
- Gantt: read-only day-resolution intervals, explicit milestones, progress labels/fills, dependency accounting, complete anchored-edge rendering, fan-out lanes, windowed rows, and selected-row locating.
- Static HTML and VS Code: semantic Calendar Agendas and complete Gantt lists with source navigation. These surfaces do not provide the WebApp's interactive timeline or month grid.
- Dedicated real-Core temporal fixtures and shared consumer assertions, a healthy manual validation corpus, and temporal editor-host verification.
- Editor refresh isolation: new callers do not reuse already-cancelled work while the old process is still exiting, and stale preview completions cannot overwrite a newer refresh.
- Coordinated dependency/toolchain maintenance, Lucide editor-build compatibility, and the Zed WASI target.

No specialized Calendar/Gantt runtime dependency is added. Existing View meanings remain unchanged. There is no scheduling engine, drag-to-reschedule, write-back, recurrence, resource planning, or graph-aware row ordering.

## Validation

Local candidate preparation gates passed. [[planning/temporal-view-release-plan]] records the source-bound fixtures, three browser engines, deterministic static output, zero-diagnostic content/health checks, five example workspaces, and the complete repository gate (76 TypeScript files / 494 tests plus all Rust workspace tests, builds, types, lint, formatting, and Zed WASI checking). Exact-candidate main CI, publication, and published-asset verification remain open; this is not a published release.

The source compatibility baseline remains VS Code 1.123.2; its September support-policy review remains current. A source integration run on minimum/stable does not replace packaged-VSIX installation verification.

Trusted integration passed on VS Code 1.123.2 and 1.139.0; a separate restricted-mode test passed. After fixing two deterministic asynchronous refresh defects found during packaging verification, the final `choral-io.forma@0.1.37` VSIX passed three consecutive installation smoke runs on 1.123.2, including Calendar agenda, Gantt complete-list, source-link, and progress assertions through the built-in Markdown renderer. Local artifact: 219,617 bytes; SHA-256 `5ef5f9820b75ed86de322aeb91f662d432e44e1ec71b98d38e6abc9271ddc84f`. This local hash does not assert identity with any future published artifact.

## Known Boundaries

- Every anchored edge is displayed regardless of row count. The maintainer accepted dense connector appearance and deferred further routing optimization.
- Small transient month-heading jitter remains an accepted presentation limitation.
- Installed Safari, physical mobile devices, and real screen-reader announcements remain unverified. On 2026-09-24 the maintainer explicitly accepted deferring these checks for this release while retaining the limitations. Browser-engine tests and emulation are separate evidence, not substitutes for these checks.
- Remote SSH, Dev Container, WSL, signing, notarization, and Zed Registry publication are not established by local checks.

## Rollout Plan

1. Complete local version, repository, content, browser, and packaged-editor gates; commit the concrete candidate.
2. Push after approval and confirm main CI for that exact SHA.
3. Dispatch the protected Release workflow with `0.1.37` and complete the production and Marketplace approvals.
4. Run `mise run release:verify -- v0.1.37` and record exact assets, hashes, CLI/VSIX identity, and managed-install results.
5. Update this record and the delivery ledger in a separate evidence commit; run `mise run release:record-check -- v0.1.37` and content checks.

## Rollback Plan

Before publication, correct the candidate and repeat its affected checks and complete final gates. After publication, preserve the immutable tag and assets and publish a higher coordinated version for corrections.
