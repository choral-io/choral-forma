---
schemaVersion: 1
kind: task
scope: project
title: Define Temporal View Contract
summary: Specify schema-driven date semantics and lightweight cross-surface Calendar and Gantt projections.
type: task
priority: P1
value: H
module: views
effort: M
status: backlog
readiness: needs-refinement
owners: []
assignees: []
reviewers: []
tags:
    - views
    - calendar
    - gantt
    - architecture
blockedBy: []
relatedTo:
    - tasks/implement-read-only-calendar-view
    - tasks/validate-lightweight-gantt-view
sources:
    - product/product-direction
    - architecture/forma-view-query-model
    - guidelines/dependency-governance
---

# Define Temporal View Contract

## Goal

Define a temporal View contract interpreted by Core and consumed by each surface, with implementable boundaries for read-only Calendar and subsequent Gantt support. Reuse existing dependencies and implement simple layouts internally.

## Sources

- [[product/product-direction]]: Calendar is a subsequent P1 direction.
- [[architecture/forma-view-query-model]]: Reuse the source/query/sort model; date comparisons and a general runtime query parameter contract are not currently available.
- [[guidelines/forma-product-model-and-configuration-fidelity]]
- [[guidelines/dependency-governance]]
- Current implementation entry points: `crates/forma-core/src/render.rs`, `crates/forma-core/src/schema.rs`, and `packages/shared/src/index.ts`.

## Planning Review — 2026-09-20

The review supports the lightweight implementation direction, and the user authorized task creation following a successful assessment. This record admits the plan to the task queue. The specific DSL, interval endpoints, and cross-surface capabilities remain design deliverables of this task, not published or accepted product contracts.

Core was verified to use `chrono` / `chrono-tz`, and WebApp uses `date-fns`. The repository Tasks schema has no temporal intervals; Releases has a `date` field. In the getting-started Tasks configuration, the `dueDate` schema type is string while its create input type is date. These facts do not justify inferring task duration or changing real task dates.

The earlier plan needs these corrections: date arithmetic must not substitute a fixed 86400 seconds for a local calendar day; the default local-time behavior of `date-fns` cannot own workspace timezone normalization; plain timeline bars establish timeline capability, while explicit Gantt dependencies require separate validation. Surfaces need not provide identical interactions initially, but must share temporal semantics and clearly describe fallback capabilities.

## In Scope

- Propose separate `calendar` / `gantt` modes and minimal typed projections. Field binding syntax must follow existing View conventions and undergo review.
- Resolve bound fields in Core using the effective schema, including named types, missing types, and type conflicts across sources. Configured field names and directories have no built-in domain meaning.
- Distinguish civil dates from timestamps. Dates retain calendar-date semantics; datetimes preserve a definite instant and the information needed for workspace timezone handling. Define explicit rejection or interpretation rules for datetimes without offsets, invalid timezones, and mixed date/datetime values.
- Define missing ends, same-day intervals, multi-day events, point events, reversed intervals, date-end inclusion, and datetime-end exclusion. Prefer evaluating normalized half-open intervals without losing the distinction between original dates and instants.
- Define grids based on local calendar dates, today in the selected timezone, and clipping across DST and month boundaries. Do not calculate date columns by dividing the millisecond difference between adjacent midnights by 86400000.
- Specify multi-day coverage, month-overlap checks, stable sorting, first-day-of-week settings, and locale sources. Show missing dates as an unscheduled count or list; report invalid dates through source-locatable diagnostics.
- Define minimal output, candidate/visible/unscheduled counts, and range boundaries. The first version may project all candidates but must not silently truncate results. If server-side range parameters are needed, define their operation contract rather than assuming existing params are executable.
- Provide a capability matrix for Core, RPC, CLI, WebApp, static export, and VS Code, including compatibility when older consumers encounter a new mode and deterministic ranges for static rendering.
- Keep the dependency budget at zero new Calendar, Gantt, or timezone libraries. Reuse chrono/chrono-tz, and use existing date-fns and Intl in WebApp as needed. Prefer contracts only in shared; require actual reuse evidence for shared layout algorithms rather than introducing a timeline framework in advance.

## Out of Scope

- Product implementation, global date-display refactoring, and bulk date population for real repository tasks.
- Recurring events, date editing, automatic scheduling, resource load, critical paths, and a general date query DSL.
- Installing dependencies or documenting draft designs as implemented behavior.

## Acceptance Criteria

- [ ] Produce a reviewable specification draft covering DSL, projection examples, diagnostic rules, endpoint/timezone decisions, and the cross-surface capability matrix. Mark unaccepted decisions as proposed.
- [ ] Define fixtures for leap days, month/year boundaries, short/long DST days, a workspace timezone different from the browser timezone, multi-day events crossing months, invalid/missing dates, and mixed field types.
- [ ] Include at least one non-task domain and one nonstandard configuration path to demonstrate configuration-driven binding.
- [ ] Identify existing crate/package reuse boundaries and an implementation path with zero added dependencies. Confirm date calculations do not depend on the host machine timezone.
- [ ] Record a benchmark plan for small workspaces and 1000/5000 entries, measuring output bytes, Core duration, browser initial rendering, and month switching. Establish performance targets after measurement without claiming existing guarantees.
- [ ] Assign review responsibility and record the contract review outcome, then refine Calendar acceptance criteria and assess its readiness. Report recommendations only when lifecycle changes are not authorized.

## Readiness

The Calendar contract was approved by the user on 2026-09-21. Owner/reviewer assignments and formal lifecycle promotion remain pending; existing board metadata is preserved rather than inferred from execution approval. Gantt-specific design remains a separate follow-up.

## Execution Progress — 2026-09-21

The user authorized the Calendar-first sequence and subsequently approved the concrete contract in [[proposals/calendar-temporal-view-contract]]. The English contract defines DSL and typed output, civil-date and instant semantics, endpoint normalization, schema conflicts, diagnostics, cross-surface fallbacks, compatibility handling, fixture oracles, and a performance measurement plan.

Source inspection found two boundaries that the earlier plan had not made concrete: schema date validation currently checks lexical shape only, and configured named semantic types support enum/entryRef rather than date aliases. The draft accounts for both without expanding global schema semantics. It also addresses the WebApp mapper's Table fallback for unrecognized projections.

Implementation and measured evidence are recorded in [[design/calendar-view-validation-2026-09-21]]. User approval is not represented as independent review, task acceptance, or publication. Gantt-specific contracts remain deferred to their validation task. Unchecked acceptance criteria and ownership remain explicit review follow-up rather than an automatic Done transition.
