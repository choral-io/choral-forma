---
schemaVersion: 1
kind: task
scope: project
title: Validate Lightweight Gantt View
summary: Validate read-only timeline bars, explicit dependencies, and a bounded implementation plan using representative data.
type: task
priority: P2
value: H
module: views
effort: M
status: backlog
readiness: blocked
owners: []
assignees: []
reviewers: []
tags:
    - views
    - gantt
    - validation
blockedBy:
    - tasks/define-temporal-view-contract
relatedTo:
    - tasks/implement-read-only-calendar-view
sources:
    - architecture/forma-view-query-model
    - guidelines/dependency-governance
---

# Validate Lightweight Gantt View

## Goal

Validate whether read-only Gantt support without new specialized libraries can meet real interval and dependency-reading needs. Produce a reviewable implementation scope and a go/no-go conclusion. This task delivers validation evidence and a plan, not a commitment to ship complete Gantt support.

## Sources

- [[tasks/define-temporal-view-contract]]
- [[tasks/implement-read-only-calendar-view]]
- [[architecture/forma-view-query-model]]
- [[guidelines/webapp-engineering-and-visual-validation]]
- [[guidelines/dependency-governance]]

## Planning Review — 2026-09-20

The lightweight technical direction passed assessment for validation; product fit remains unconfirmed. Repository Tasks lack start/end fields, and duration must not be inferred from effort, status, or a single dueDate. The temporal contract shared with Calendar is a hard dependency. Calendar delivery experience can be reused, but shipping the complete Calendar must not be treated as a hard blocker for read-only Gantt research.

## In Scope

- Build neutral project fixtures with explicitly configured start/end fields. Use authorized, sanitized representative real plans where available. Otherwise label data as synthetic and do not treat synthetic results as demand validation.
- Validate date bars, same-day/cross-month intervals, missing dates, and milestone representation using Core temporal semantics. Bind start/end and dependency fields explicitly.
- Validate HTML/CSS bars, title columns, date ticks, local horizontal scrolling, and a narrow-screen list fallback. Begin with a minimal isolated prototype and measure host scrolling behavior; do not introduce a scroll-synchronization framework or Canvas by default.
- Resolve dependencies from explicitly configured entryRef/referenceList fields. Define edge direction and the initial relationship type, detect self-dependencies, cycles, unresolved targets, and filtered-out targets, and do not automatically schedule from these relationships.
- Compare navigable dependency lists with small inline SVG connectors. Lists provide baseline accessibility. Without connectors, report only timeline-bar/dependency-list capabilities rather than claiming validation of graphical dependency reading.
- Reuse existing Rust date libraries and native browser capabilities with zero new specialized libraries. Do not add d3 for date-to-coordinate mapping or introduce a generic timeline package in advance.
- Measure node counts, computation, scrolling, and initial-render costs for small/1000/5000-entry datasets and long time spans. Clip ranges by date column, avoid creating a full year of daily DOM nodes for every entry, and consider row windowing only when evidence requires it.
- Propose a capability matrix for WebApp, VS Code, and static output, cross-surface reuse boundaries, implementation slices, and required verification.

## Out of Scope

- Changing real task schedules, drag-and-drop write-back, automatic scheduling, resource load, critical paths, and working-day/holiday engines.
- Providing progress percentages, complex grouping, every dependency relationship type, or pixel-identical behavior across hosts by default.
- Installing candidate libraries, publishing the prototype, or integrating it directly into a production View mode.

## Acceptance Criteria

- [ ] Reference the reviewed temporal contract and assign an owner/reviewer. Make sample provenance, synthetic/real-data boundaries, and field coverage verifiable.
- [ ] Demonstrate stable bar positioning across DST, month boundaries, and different workspace timezones without inventing unknown dates.
- [ ] Provide examples of dependency-edge semantics and exceptional-case diagnostics, explaining the benefits and complexity of graphical connectors relative to lists and the initial choice.
- [ ] Record actual evidence for long titles, overlapping spans, narrow screens, keyboard navigation, light/dark themes, and host-local scrolling.
- [ ] Record performance samples, output/DOM size, bottlenecks, and whether windowing is necessary. Do not promise performance against unmeasured thresholds.
- [ ] Produce an evidence-backed go/no-go conclusion. If successful, provide a Gantt implementation plan with acceptance criteria; otherwise document missing data/value evidence or complexity limits. Subsequent implementation task creation and publication remain subject to the authorization in effect at that time.
- [ ] Add no runtime dependencies and make no unreviewed changes to production modes or public DSL.

## Readiness

Backlog / blocked: awaiting [[tasks/define-temporal-view-contract]]; owner/reviewer assignments are pending. Gantt product implementation has not passed review, and creating this validation task does not approve that implementation.
