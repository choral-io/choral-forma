---
schemaVersion: 1
kind: task
scope: project
title: Cover Temporal View Contract In Committed Fixtures
summary: Add committed Gantt and Calendar contract fixtures and representative validation-corpus cases.
type: task
priority: P2
value: M
module: views
effort: M
status: reviewing
readiness: ready
owners:
    - members/tiscs
assignees:
    - members/tiscs
reviewers:
    - members/tiscs
tags:
    - views
    - gantt
    - calendar
    - fixtures
    - testing
blockedBy: []
relatedTo:
    - tasks/validate-lightweight-gantt-view
    - tasks/implement-read-only-calendar-view
    - tasks/define-temporal-view-contract
sources:
    - proposals/gantt-temporal-view-contract
    - proposals/calendar-temporal-view-contract
severity: ""
sprint: ""
reportedBy: ""
affectedArea: ""
---

# Cover Temporal View Contract In Committed Fixtures

## Goal

Make the committed fixtures exercise the temporal View contract that Core, the WebApp, static export and the editor preview already implement, so a change to that contract fails a test instead of passing unnoticed.

## Sources

- [[proposals/gantt-temporal-view-contract]] and [[proposals/calendar-temporal-view-contract]]: the accepted semantics the fixtures should represent.
- [[tasks/validate-lightweight-gantt-view]]: records the gap that produced this task.
- `packages/shared/src/fixtures/gantt-core.json`: the shared wire fixture.
- `examples/getting-started-workspace/.forma/views/gantt.md`: its source View.
- `fixtures/forma-validation/`: the manual validation corpus and its `guidelines/case-authoring.md`.

## Historical Gap Assessment — 2026-09-22

Measured on 2026-09-22, after the Gantt progress and connector work landed.

The shared Gantt wire fixture has six committed consumers: `crates/forma-core/tests/gantt_view.rs` asserts real Core output equals it exactly, `crates/forma-cli/src/static_html.rs` renders it, and four TypeScript test files import it. Its source View binds two of the six available Gantt bindings (`start` and `dependencies`), so the fixture's 7 nodes, 6 rows and 1 edge leave most of the Gantt contract unrepresented.

| Contract feature                                           | In `gantt-core.json`               |
| ---------------------------------------------------------- | ---------------------------------- |
| `progress`                                                 | absent                             |
| `classification` from `gantt.presentation.rows.colorBy`    | absent                             |
| `milestone: true`                                          | no row has it                      |
| `temporal.kind: datetime`                                  | absent, every row is `date`        |
| `status: invalid`                                          | absent                             |
| `edge.status: unanchored`                                  | absent                             |
| duplicates, self references, outside selection, unresolved | all zero, the fixture has one edge |

Optional fields are skipped when absent, so adding `progress` to the wire contract changed no fixture and failed no test. Calendar has no shared wire fixture at all.

Calendar has a distinct projection contract and does not carry Gantt-only progress, milestone, or dependency fields. It needs its own shared wire fixture and coverage criteria: date and datetime events, optional classification from `calendar.presentation.events.colorBy`, and candidate/scheduled/unscheduled/invalid accounting.

At this assessment, the validation corpus had no Calendar or Gantt cases and lacked temporal fields. This gap and counts describe the 2026-09-22 baseline only; the current coverage is recorded below.

## In Scope

- Extend the shared Gantt wire fixture to represent every Gantt feature in the coverage table, and keep every consumer of it passing.
- Add a separate Calendar wire fixture for Calendar-specific fields and counts; do not require Gantt-only fields in the Calendar projection.
- Add calendar and gantt cases to the validation corpus, with the samples, View and schema additions they need, following `guidelines/case-authoring.md`.
- Pin the static export's progress phrasing against a committed expected-text fixture consumed by both its Rust test and the shared formatter test, so either surface drifting from the common expectation fails.

## Out of Scope

- Changing any accepted temporal semantics. This task represents the contract, it does not amend it.
- Interactive or visual behaviour already verified under [[tasks/validate-lightweight-gantt-view]].
- Performance fixtures and scale corpora.

## Source Workspace Decision — 2026-09-24

Use `fixtures/temporal-views/` as the dedicated source workspace for both wire fixtures. The user authorized autonomous execution of the reviewed release plan. This repository-local placement keeps intentionally invalid intervals and unresolved references out of onboarding examples and the healthy validation corpus. Shared JSON remains under `packages/shared/src/fixtures/`, with real Core equality tests binding it to the dedicated source workspace. The independent manual cases remain in `fixtures/forma-validation/`.

The maintainer, `members/tiscs`, is the owner, assignee, and reviewer. Implementation is ready for review; final user review remains pending. The wire oracle workspace is `fixtures/temporal-views/`; manual interactive cases remain under `fixtures/forma-validation/`. Real Safari, physical-device, and screen-reader evidence is unverified, but the user accepted its deferral for 0.1.37 and it is not a release blocker.

## Current Coverage — 2026-09-24

The shared Gantt wire fixture now has six candidates, four scheduled rows, one invalid node, one unscheduled node, and three edges covering anchored and unanchored states. It exercises civil dates and datetimes, classification, explicit milestone state, progress values including authored zero and absent progress, and all dependency accounting categories. The Core equality test also pins independent counts, selected node values, and temporal boundaries so reducing the JSON snapshot cannot silently remove coverage.

Calendar has a separate shared fixture with six candidates, four scheduled events, one invalid candidate, and one unscheduled entry. It covers date and datetime events, timezone projection, classification including unclassified output, and explicitly verifies that Gantt-only `milestone`, `progress`, `dependencies`, `nodes`, and `edges` do not leak into Calendar output.

| Contract feature | Current evidence |
| --- | --- |
| Gantt progress, including absent versus zero | `gantt-core.json` plus independent Core assertions; `gantt-progress-labels.json` is consumed by both the shared formatter test and static HTML test |
| Gantt classification, milestone, date/datetime, scheduled/invalid/unscheduled | Shared Gantt fixture and Core equality test |
| Gantt anchored/unanchored edges and dependency count closure | Shared Gantt fixture and Core equality test |
| Calendar date/datetime, timezone, classification, and candidate counts | Separate Calendar fixture and Core equality test |
| Cross-consumer decoding/rendering | Core, CLI static HTML, shared TypeScript, WebApp RPC/static clients, and VS Code preview tests consume the shared fixtures |
| Manual Calendar/Gantt coverage | Active cases with stable `CALENDAR-*` and `GANTT-*` assertions in `fixtures/forma-validation/`; dedicated `predecessors` field; non-UTC timestamps; Agenda/list and keyboard instructions |

The Forma validation corpus passes `check` and `workspace health` with no diagnostics. Calendar and Gantt renders each report four candidates, three scheduled and one unscheduled, with no invalid entries. In Gantt, the unscheduled predecessor relationship remains in the complete list and produces an unanchored edge without a timeline bar or connector.

## Acceptance Criteria

- [x] Decide where the wire fixture's source workspace lives and record the reason.
- [x] The shared Gantt wire fixture exercises every feature listed in the coverage inventory.
- [x] A separate Calendar wire fixture exercises date and datetime events, configured classification, and candidate/scheduled/unscheduled/invalid accounting without Gantt-only fields.
- [x] Core equality tests and consumer tests protect the listed Gantt and Calendar output features.
- [x] Static export and shared formatter tests assert progress wording against the shared expected-text fixture.
- [x] The validation corpus has active Calendar and Gantt cases with stable assertion identifiers and passes `check` and health.
- [ ] Record final user review and acceptance.
