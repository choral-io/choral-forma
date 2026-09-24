---
schemaVersion: 1
kind: task
scope: project
title: Implement Read-only Calendar View
summary: Deliver a dependency-light month and agenda Calendar projection across supported Forma surfaces.
type: task
priority: P1
value: H
module: views
effort: L
status: done
readiness: ready
owners:
    - members/tiscs
assignees:
    - members/tiscs
reviewers:
    - members/tiscs
tags:
    - views
    - calendar
    - core
    - webapp
blockedBy: []
relatedTo:
    - tasks/define-temporal-view-contract
    - tasks/validate-lightweight-gantt-view
sources:
    - product/product-direction
    - architecture/forma-view-query-model
---

# Implement Read-only Calendar View

## Goal

Implement a read-only Calendar month view and Agenda after temporal contract review, supporting configured date-based content while keeping Markdown as the content source.

## Sources

- [[tasks/define-temporal-view-contract]]
- [[product/product-direction]]
- [[architecture/forma-view-query-model]]
- [[guidelines/webapp-engineering-and-visual-validation]]
- [[guidelines/forma-runtime-cache-and-performance]]
- [[guidelines/dependency-governance]]

## In Scope

- Implement Core date normalization, field validation, typed Calendar projections, and diagnostics according to the accepted contract, integrating RPC/CLI/shared. Consumers must not independently infer schemas or date field names.
- Use native HTML/CSS Grid, existing React/DaisyUI styling, and a lazy-loaded Calendar component in WebApp. Provide previous/next month controls, today, a month heading, date cells, navigable events, and Agenda.
- Display events crossing month boundaries according to interval-overlap rules. Provide a discoverable expansion control for crowded dates so hidden content remains accessible. Support Agenda on narrow screens while retaining date and event navigation.
- Reuse existing chrono/chrono-tz. Use date-fns only for display/layout helpers verified not to introduce host-timezone drift, and specify temporal semantics explicitly with Intl. Add no runtime libraries, specialized calendar components, or generic timeline packages.
- Provide at least a semantic, date-grouped Agenda with navigation in VS Code and static HTML. Describe capabilities accurately without presenting a fallback as an interactive month view. Static date ranges must follow the accepted determinism rules.
- Correct dueDate type consistency in the getting-started fixture and add neutral-domain, multi-day, and datetime/timezone cases. Do not require domain fields to be added to repository Tasks.
- Update canonical View documentation, CLI/RPC contracts, and related built-in help while preserving the existing four View modes.

## Out of Scope

- Dragging, rescheduling, or write-back; recurring events, hourly scheduling, external calendar synchronization, and resource calendars.
- General before/after query operators, saved personal filters, and date-component refactoring unrelated to Calendar.
- Introducing virtualization libraries, persistent Workers, or new indexes without measurement.

## Acceptance Criteria

- [x] Review the prerequisite temporal contract and link its final documentation and specific decisions. Assign an owner/reviewer before moving into execution.
- [x] Cover date types, timezones, DST, cross-month overlap, missing dates, invalid/reversed intervals, neutral fields, and nonstandard configuration paths in Core fixtures.
- [x] Ensure CLI JSON, RPC, WebApp, static output, and VS Code consume the same event semantics, with traceable links, unscheduled counts, and diagnostics.
- [x] Validate WebApp at 1440/1024/768/390 widths in choral-light/dark. Month controls, events, and expanded content must be keyboard-accessible, with visible focus, readable date semantics, and no page-level horizontal overflow.
- [x] Validate narrow/wide VS Code previews and themes. Verify actual static HTML, navigation, ranges, and readability with scripts disabled.
- [x] Return only data needed for rendering. Record projection size, duration, initial rendering, and month switching for representative small workspaces and 1000/5000 entries, with an explicit range/loading plan if targets are exceeded.
- [x] Cover new contracts and existing View regressions through affected crate/consumer tests, WebApp checks and build, and mise run check as required for shared behavior. Documentation changes must pass Forma check/health.
- [x] Add no dependencies for this feature to manifests or lockfiles. Record actual evidence, unverified host capabilities, and remaining risks.

## Readiness

Calendar was committed as `afc3bc7`; shared temporal extraction and current cross-surface integration followed in `217fa2e` and the current release-preparation worktree. `members/tiscs` is owner, assignee, and reviewer. Readiness is `ready`; status is `done` following user acceptance on 2026-09-24. Release gates are tracked in [[planning/temporal-view-release-plan]].

## Acceptance Reconciliation — 2026-09-24

The remaining VS Code narrow/wide, light/dark visual matrix passed on 1.123.2, including visible link focus and keyboard source navigation. Evidence is recorded in [[design/calendar-view-validation-2026-09-21#Final-Acceptance-And-Host-Visual-Verification-—-2026-09-24]]. The maintainer then explicitly accepted all four temporal delivery Tasks. This closes Task acceptance, not the release or its deferred real-device and screen-reader checks.

[[design/calendar-view-validation-2026-09-21]] records the earlier Core and consumer coverage, WebApp behavior, static output and scale evidence. Current fixture/consumer coverage is recorded in [[tasks/cover-temporal-view-contract-in-committed-fixtures]]. The implementation adds no runtime dependency. Trusted VS Code source-host temporal HTML assertions passed at minimum 1.123.2 and stable 1.139.0; restricted-mode trust verification passed separately. The latest packaged-host status, artifact identity, and verification details are maintained in [[tasks/validate-lightweight-gantt-view]] and [[planning/temporal-view-release-plan]]. Real Safari, physical-device, and assistive-technology behavior remains unverified, with 0.1.37 deferral accepted; final user acceptance was confirmed on 2026-09-24. Historical progress below predates this reconciliation.

## Execution Progress — 2026-09-21

The user approved [[proposals/calendar-temporal-view-contract]] and authorized implementation. Core normalization, shared output, WebApp month/Agenda, static Agenda, and VS Code Agenda are implemented with zero new dependencies. The getting-started Calendar example uses a schema-declared date and an optional structured-template input; missing dates are not stored as empty strings.

See [[design/calendar-view-validation-2026-09-21]] for the earlier tests, production-browser checks, static navigation, scale measurements, and host/review limits. The WebApp uses native Grid, equal-height measured event previews, and a native dialog styled with existing DaisyUI controls as a full-day drawer. At the time of this 2026-09-21 progress entry, review roles were unassigned; current assignments are recorded in frontmatter. This dated entry does not claim release or final task acceptance.
