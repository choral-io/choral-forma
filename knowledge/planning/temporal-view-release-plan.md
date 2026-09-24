---
scope: project
type: execution-plan
title: Calendar And Gantt Release Preparation
summary: Complete temporal View contract coverage, targeted host verification, and candidate preparation for the next coordinated Public Preview release.
owners:
    - members/tiscs
reviewers:
    - members/tiscs
sources:
    - releases/forma-v0.1.37
    - releases/forma-v0.1.36
    - proposals/calendar-temporal-view-contract
    - proposals/gantt-temporal-view-contract
    - tasks/define-temporal-view-contract
    - tasks/implement-read-only-calendar-view
    - tasks/validate-lightweight-gantt-view
    - tasks/cover-temporal-view-contract-in-committed-fixtures
    - guidelines/release-execution-and-verification
tags:
    - calendar
    - gantt
    - release
---

# Calendar And Gantt Release Preparation

## Scope And Authority

The user authorized autonomous preparation following review of the release path, including bounded parallel implementation and verification. The maintainer owns Task responsibility and final acceptance. The planned coordinated version is 0.1.37, following the released 0.1.36 baseline; publication remains a distinct step after a concrete candidate has passed its gates.

Calendar provides a WebApp month view and Agenda, with semantic Agendas in static HTML and VS Code. Gantt provides a read-only day-resolution WebApp timeline with labels, progress, milestones, dependency connectors, selection, and locating; static HTML and VS Code provide complete semantic lists. Core owns temporal and dependency semantics. No runtime dependency is added for this release preparation.

Every anchored Gantt edge remains displayed at every row count. The maintainer accepted the current dense appearance and deferred visual optimization. Dragging, write-back, automatic scheduling, graph-aware ordering, and new routing algorithms are outside this cutline.

## Execution Sequence

The candidate record is [[releases/forma-v0.1.37]].

1. Review and consolidate current implementation changes. Preserve other local work, identify which existing commits enter the candidate, and synchronize current connector documentation.
2. Complete the temporal contract fixture Task. Use an independent source workspace at `fixtures/temporal-views/`, keeping intentional invalid data out of onboarding examples and the healthy manual corpus. Pin real Core output in shared JSON and consume it from host tests; share progress wording expectations between Rust and TypeScript. Add valid manual cases under `fixtures/forma-validation/`.
3. Close targeted verification gaps. Recheck full-edge rendering after the threshold change across Playwright browser engines. Open Calendar and Gantt in installed VS Code integration tests; distinguish command/activation evidence from visible preview validation. Reuse unaffected existing evidence.
4. Prepare the coordinated release version, changelog, and candidate record. Run version consistency, the complete local check, example and content checks, and VSIX packaging/installation checks. Bind evidence to the candidate commit and verify main CI for that exact commit after authorized push.
5. Dispatch the protected release workflow after candidate approval, verify published assets and managed installation, and record the result in the release record and delivery ledger. Commit publication evidence separately from the immutable release candidate.

## Acceptance Boundaries

- The fixture Task is regression hardening for existing accepted contracts; it does not add product semantics.
- Installation/activation tests alone do not establish Calendar/Gantt preview rendering. The original installed-host suite opened only list, table, kanban, and graph Views; this preparation adds temporal View coverage.
- Playwright WebKit and mobile emulation do not establish installed Safari or physical-device behavior. Real screen-reader announcements also remain a separate validation boundary. On 2026-09-24 the maintainer explicitly accepted deferring these three checks for 0.1.37 while retaining them as unverified limitations. This accepted deferral removes their release-blocking status; it does not turn them into passing evidence.
- High-density legibility and small transient month-heading jitter are accepted presentation limitations. Verify that full connector rendering does not break basic interaction; do not restore a row-count cutoff.
- Task closure follows its actual acceptance criteria. A green test run or publication does not automatically accept unrelated Tasks.

## Initial Snapshot — 2026-09-24

Preparation began on local `main` at `a9bb34a`, 17 commits ahead of the local `origin/main` reference, with nine modified files. This is a starting snapshot, not a current candidate identifier or a statement about fresh remote state. Calendar, Gantt, and temporal-contract Tasks were reviewing; the fixture Task was backlog. Both temporal proposals were accepted. Workspace health and whitespace checks passed before preparation.

## Preparation Evidence — 2026-09-24

- Source-bound shared fixtures now cover Calendar and Gantt independently. Core equality tests also assert feature presence and accounting, preventing snapshot regeneration from silently erasing coverage. Static HTML, shared formatting, WebApp RPC/static clients, and editor-renderer consumers pass their focused checks. Progress wording is pinned by one expected-text fixture used from Rust and TypeScript.
- The healthy validation corpus contains active Calendar and Gantt cases; intentionally invalid contract data lives separately in `fixtures/temporal-views/`. Independent review found and corrected a manual-case gap: absent progress needs its own sample, distinct from authored zero.
- Playwright CLI checked Chromium 154, Firefox 156, and WebKit 26.6 against the real local backend and production WebApp assets. The synthetic 5,000-entry Gantt contained 4,849 scheduled rows, 151 unscheduled entries, and 1,839 anchored edges. All edges remained present at 1,440px and 390px widths in light/dark themes and after keyboard selection, locating, and native two-axis wheel scrolling. The complete list contained all 5,000 entries; mounted timeline rows remained windowed. These are interaction smoke checks, not a new latency benchmark or evidence of user demand.
- Calendar navigation used native `month` input in Chromium and `date` fallback in Firefox/WebKit. Month submission, day drawer, Escape focus restoration, Agenda, unscheduled content, and narrow layout passed. Screenshots were inspected; the initial Chromium capture caught the closing-drawer transition, and a settled capture confirmed clear content. WebKit emitted unused-preload warnings; no page JavaScript errors were observed.
- VS Code source integration passed on 1.123.2 and 1.139.0, plus restricted mode. Tests render through the built-in Markdown engine and assert Calendar agenda, Gantt complete list, source links, and progress text. Merely opening a preview tab is not counted as semantic rendering evidence.
- Version consistency passes for 0.1.37. Root content checks and workspace health report zero findings. All five example workspaces pass using the source-built 0.1.37 CLI. Two static builds of the healthy validation corpus are byte-identical (47 pages, six Views, zero warnings).

The first packaged-VSIX temporal preview run lacked Calendar enhancement; retry alone was not accepted. Investigation reproduced two asynchronous defects: a new scheduler subscriber could join already-aborted work before process exit, and a stale preview refresh could reuse a generation number and overwrite newer state. Deterministic tests failed before each fix and passed afterward. The scheduler now replaces cancelled work; preview refreshes use controller identity as their completion guard. Independent review found no remaining issue in these changes. No fixed-delay retry was added to the semantic host assertions.

After these fixes, `CI=true mise run check` passed with 76 TypeScript test files / 494 tests, all Rust workspace tests, type/lint/format gates, frontend builds, and the Zed WASI check. Trusted editor-host suites passed again on 1.123.2 and 1.139.0; restricted-mode verification also passed. The refreshed `choral-io.forma@0.1.37` VSIX passed three consecutive disposable-install smoke runs on 1.123.2, including actual Calendar/Gantt Markdown enhancement assertions. Its 219,617-byte artifact has SHA-256 `5ef5f9820b75ed86de322aeb91f662d432e44e1ec71b98d38e6abc9271ddc84f`. These bounded repetitions supplement the deterministic regressions; they do not prove absence of every possible race.

Local preparation gates are complete. On 2026-09-24 the maintainer authorized scoped local commits only and explicitly withheld push authorization. Final Task acceptance, exact-SHA main CI after authorized push, protected publication, and published-asset verification remain. The existing changes to `define-cross-surface-capability-matrix` and `design-markdown-import-normalization-flow` are unrelated local Task governance and are excluded from the temporal candidate change set. Local screenshots and runner logs are retained only in the maintainer's ignored scratch area; temporary browser sessions and the two test servers were stopped.
