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
status: backlog
readiness: needs-refinement
owners: []
assignees: []
reviewers: []
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

## Current Coverage

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

The validation corpus has active cases for kanban, table, graph, reader, mermaid, shell and workspace, and none for calendar or gantt; neither `afc3bc7` nor `217fa2e` added one. Its `caseArea` enum has no temporal value and its samples schema has no temporal fields, so a case needs both extended. Its `sample` type is already an `entryRef`, but `relatedSamples` does not mean predecessors and should not be reused as a dependency binding. The corpus passes `check` today, and its `Asia/Kuala_Lumpur` timezone is deliberately not UTC, which a temporal case should exercise.

## In Scope

- Extend the shared Gantt wire fixture to represent every Gantt feature in the coverage table, and keep every consumer of it passing.
- Add a separate Calendar wire fixture for Calendar-specific fields and counts; do not require Gantt-only fields in the Calendar projection.
- Add calendar and gantt cases to the validation corpus, with the samples, View and schema additions they need, following `guidelines/case-authoring.md`.
- Pin the static export's progress phrasing against a committed expected-text fixture consumed by both its Rust test and the shared formatter test, so either surface drifting from the common expectation fails.

## Out of Scope

- Changing any accepted temporal semantics. This task represents the contract, it does not amend it.
- Interactive or visual behaviour already verified under [[tasks/validate-lightweight-gantt-view]].
- Performance fixtures and scale corpora.

## Open Decisions

**Where the richer wire-fixture workspace comes from.** Extending `examples/getting-started-workspace` is the smallest change, but that workspace is the product's onboarding example, and `fixtures/forma-validation/guidelines/case-authoring.md` already states that validation fixtures must not be copied into `examples/` or presented as a product default. Milestones, progress values and a deliberately invalid interval would make the first workspace a new user opens read as test data. The alternative is a dedicated contract-fixture workspace outside `examples/`, which keeps the onboarding example clean at the cost of moving the Gantt equality assertion's source. This needs a decision before either wire fixture is authored; the validation-corpus work does not depend on it.

## Acceptance Criteria

- [ ] Decide where the wire fixture's source workspace lives and record the reason.
- [ ] The shared Gantt wire fixture exercises every row in its coverage table.
- [ ] A separate Calendar wire fixture exercises date and datetime events, configured classification, and candidate/scheduled/unscheduled/invalid accounting without requiring Gantt-only fields.
- [ ] For every listed Gantt and Calendar feature, at least one committed test fails if Core omits or changes that feature.
- [ ] The static export and shared formatter tests both assert the progress wording against the same committed expected-text fixture.
- [ ] The validation corpus has active calendar and gantt cases with stable assertion identifiers, and still passes `check`.
- [ ] Assign owner and reviewer, and record the review outcome.
