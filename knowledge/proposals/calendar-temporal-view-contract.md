---
schemaVersion: 1
kind: proposal
scope: project
type: proposal
status: accepted
title: Calendar Temporal View Contract
summary: Accepted dependency-light Calendar semantics, projection contract, surface behavior, and implementation gates.
owners: []
assignees: []
reviewers: []
tags:
    - proposal
    - views
    - calendar
sources:
    - product/product-direction
    - architecture/forma-view-query-model
    - guidelines/forma-product-model-and-configuration-fidelity
    - guidelines/dependency-governance
relatedTo:
    - tasks/define-temporal-view-contract
    - tasks/implement-read-only-calendar-view
    - tasks/validate-lightweight-gantt-view
---

# Calendar Temporal View Contract

## Summary

Add a read-only `calendar` View with a month grid and Agenda in WebApp and a complete semantic Agenda in static HTML and VS Code. Core owns field interpretation, date validity, timezone conversion, interval normalization, and diagnostics. Reuse existing dependencies; add no Calendar, Gantt, date, timezone, or virtualization library.

The user approved this concrete contract and its implementation on 2026-09-21, following the Calendar-first planning stage. This approval does not claim independent review, completed implementation acceptance, or publication. Existing Views retain their current meaning.

## Source Evidence

Baseline: `e9f4175`. The working tree was clean at the start of this stage. Effective workspace configuration specifies canonical language `en` and timezone `Asia/Shanghai`; workspace health passed without findings.

- [[product/product-direction]] places Calendar after the initial View modes, at P1.
- [[architecture/forma-view-query-model]] owns source/query/sort. Date comparisons and executable runtime View parameters are outside its current contract.
- `crates/forma-core/src/render.rs` owns the four existing projection variants. `render_view_from_loaded` already holds the effective workspace and resolved model; the temporal evaluator should use that snapshot.
- `crates/forma-core/src/schema.rs` currently checks the lexical shape of `date`, not whether the calendar date exists. Calendar must additionally use chrono calendar parsing. This feature must not silently change validation behavior for every unrelated schema consumer.
- `SemanticType` in `crates/forma-core/src/config.rs` currently supports enum and entryRef only. Named date aliases are not an existing capability and must not be invented by this implementation.
- `packages/webapp/src/data/rpc-workspace-client.ts` currently falls through to Table for remaining projection kinds. Extend explicit handling and verify unsupported-mode behavior instead of relying on that fallback.
- Core already depends on chrono/chrono-tz. WebApp already depends on date-fns. `packages/shared` currently has no runtime dependency.

## Accepted Contract

### Configuration

Use the existing `source`, optional `query`, and optional `sort` fields. Add only `mode: calendar` and its mode-specific block:

```yaml
kind: view
title: Exhibition Calendar
mode: calendar
source:
    type: pages
    taxonomy:
        collections:
            - exhibitions
calendar:
    start:
        field: fields.opensOn
    end:
        field: fields.closesOn
    firstDayOfWeek: monday
```

`calendar.start.field` is required. `calendar.end` is optional. Both bindings use existing `fields.<path>` syntax over scalar schema fields, including nested objects but excluding traversal through lists. `firstDayOfWeek` accepts `monday` or `sunday`, defaulting to `monday`. These keys are accepted product syntax; exhibitions, collections, opensOn, closesOn, and configuration locations are arbitrary configured examples.

Use the canonical entry title, with the existing path fallback, and the entry path for navigation and event identity. Do not introduce a separate title-field override in the first cut. One candidate entry produces at most one event. Existing source/query selection runs before temporal evaluation, and existing View sorting determines stable event order with path as the final tie-breaker. Without configured sort, use ascending first covered date, all-day events before timed events on that date, timed instant, then path.

### Schema Binding

Resolve each candidate against its applicable effective content-group schemas, using the Core model rather than a directory or field-name convention. A bound field must resolve to `date` or `datetime`. Enums, strings, references, lists, absent schema definitions, and current named semantic types are unsupported even if their values resemble dates.

When several applicable schemas declare the same bound field, require the declarations to agree; do not pick the first silently. Unrelated schemas that do not declare the field do not override a valid declaration. Resolve start/end to the same temporal type within each entry. Different entries may legitimately use different temporal types when their respective schemas differ; the projection carries that distinction per event.

Existing workspace schema-membership validation remains authoritative: ambiguous schema-bearing term membership is rejected before indexing and Calendar source selection. Such excluded pages retain `page.schemaMembership.ambiguous`; they are not counted as Calendar candidates or reinterpreted by the temporal evaluator.

Missing or null start values on a correctly typed field are unscheduled. Empty strings are invalid values. A supplied end without a start is invalid rather than a guessed start. Missing or null end uses the rules below. An empty source is valid and returns an empty projection; syntactic configuration errors must still be diagnosed without sample data.

### Dates, Instants, and Endpoints

| Input                        | Proposed meaning                                                       |
| ---------------------------- | ---------------------------------------------------------------------- |
| date start only              | One all-day event on that calendar date                                |
| date start and end           | Both authored dates are inclusive; normalize to `[start, dayAfterEnd)` |
| datetime start only          | Point event at that instant                                            |
| datetime start and equal end | Point event at that instant                                            |
| datetime start and later end | Half-open interval `[start, end)`                                      |
| end before start             | Invalid entry; exclude from events and report a diagnostic             |
| mixed start/end types        | Invalid entry; no implicit conversion                                  |

Dates require an exact four-digit `YYYY-MM-DD` string and a real Gregorian calendar date. Use calendar-day arithmetic, not fixed elapsed hours. Diagnose values whose normalization would overflow the supported four-digit representation; do not wrap dates or panic.

Datetimes require RFC3339 with `Z` or an explicit offset. Reject offset-free local datetimes rather than guessing an ambiguous DST interpretation. Preserve the instant and normalize serialized instants to UTC. Use the effective workspace IANA timezone to derive display dates. Invalid workspace timezone makes the Calendar projection unavailable; do not fall back to the browser or operating-system timezone.

Core also returns the civil-date span used for layout: `firstDate` inclusive and `afterLastDate` exclusive. For a timed interval ending exactly at local midnight, the ending date is excluded. Otherwise include the ending local date. A point occupies its local date. Compute timezone conversion before checking local midnight, and cover DST transitions with tests.

### Projection

Add a `calendar` member to the existing render union. Its proposed shape is:

```json
{
    "kind": "calendar",
    "timeZone": "Europe/Paris",
    "firstDayOfWeek": "monday",
    "counts": { "candidates": 2, "scheduled": 1, "unscheduled": 1, "invalid": 0 },
    "events": [
        {
            "path": "exhibitions/spring.md",
            "title": "Spring Exhibition",
            "temporal": { "kind": "date", "start": "2028-02-28", "endExclusive": "2028-03-02" },
            "firstDate": "2028-02-28",
            "afterLastDate": "2028-03-02"
        }
    ],
    "unscheduled": [{ "path": "exhibitions/autumn.md", "title": "Autumn Exhibition" }]
}
```

For datetime events, `temporal` is `{kind: "datetime", start: <UTC RFC3339>, endExclusive: <UTC RFC3339 or null>}`. Null denotes a point; equal authored endpoints normalize to a point. Do not return all frontmatter, repeated reference maps, per-day copies of events, or preformatted localized text.

Require `candidates = scheduled + unscheduled + invalid`, with scheduled equal to events length. Invalid entries remain discoverable through source-locatable diagnostics. Candidate counts apply after source/query filtering. No silent truncation or pagination in the first projection contract. View params remain unevaluated; the UI month is local presentation state, not an undeclared server query.

### Diagnostics

| Proposed code | Severity and behavior |
| --- | --- |
| `view.calendarBindingInvalid` | Error on View configuration; missing/invalid binding syntax or unsupported settings; no projection |
| `view.calendarTimezoneInvalid` | Error on View with workspace timezone context; no projection |
| `view.calendarFieldTypeInvalid` | Warning on candidate field; absent, conflicting, or unsupported schema type; count candidate as invalid |
| `view.calendarDateInvalid` | Warning on candidate field; malformed or nonexistent date/instant; count candidate as invalid |
| `view.calendarIntervalInvalid` | Warning on candidate field; reversed/mixed interval, orphan end, or normalization overflow; count candidate as invalid |

Retain existing schema diagnostics and operation status aggregation. Calendar warnings do not downgrade existing errors. Include candidate path and the existing frontmatter field location; reference the View binding in the message. Emit one primary Calendar reason per excluded entry in stable order, with start/type checks before end/interval checks. Missing optional dates are not errors.

### Rendering and Surface Capabilities

| Surface | Initial capability | Range and time behavior |
| --- | --- | --- |
| Core / CLI / RPC | Complete typed event and unscheduled projection with diagnostics | Deterministic for the same snapshot; no injected current timestamp |
| WebApp | Month grid, Agenda, previous/next month, Today, entry navigation | Initially current month in workspace timezone; full projection permits navigation without new RPC parameters |
| Static HTML | Date-grouped semantic Agenda and unscheduled links | All events, grouped by firstDate; each event once with its full range; no dependence on build date |
| VS Code | Date-grouped semantic Agenda and unscheduled links | Same complete Agenda; host navigation and theme adaptation |

The WebApp Agenda lists events overlapping the selected month once, including intervals that started in an earlier month. The grid clips civil spans to its visible cells, using `firstDate < rangeEnd && afterLastDate > rangeStart`. Month navigation uses civil year/month arithmetic, and grid generation uses calendar dates. Do not divide local elapsed milliseconds by 86400000 to obtain columns.

Use native HTML/CSS Grid and existing DaisyUI controls. Date headings and events retain semantic labels and ordinary links. Cap collapsed event previews per day only with a keyboard-accessible expansion control exposing the full list; collapsed content must not disappear from access. Show an explicit empty month and an unscheduled section. Agenda is the narrow-screen presentation; avoid page-level horizontal overflow. Preserve document scrolling and scoped layout ownership.

Use the host's established UI locale for human-facing labels, with workspace canonical language as the fallback. Locale never changes date placement, ordering, or firstDayOfWeek. Today is computed only in the interactive host using the supplied timezone; it is not cached in the Core projection. Use existing clock injection in tests, or introduce a feature-local clock parameter for deterministic tests.

Calendar implementations and shared types must ship together in a compatible release. Existing older clients are not promised to understand this additive union variant. Add explicit dispatch in current clients and an unsupported-projection message where runtime data can be newer than the consumer; never map Calendar into Table. Do not introduce general protocol negotiation as part of this feature.

## Target

Use a focused Core temporal module called by render.rs. Pass the effective model and config from the existing loaded workspace; do not load the workspace again or walk the filesystem separately. Reuse chrono and chrono-tz for parsing and calendar arithmetic. Keep stronger calendar validity checks local to temporal evaluation until any broader schema correction is separately assessed.

Extend `packages/shared/src/index.ts` with projection types. Keep WebApp month-grid helpers feature-local and independent of React where practical. Use Intl with explicit timezone for labels; existing date-fns is optional and must not introduce host-timezone arithmetic. Do not add runtime dependencies to shared. Static HTML and VS Code consume normalized dates and render their own host-appropriate semantic markup.

Update Core, RPC serialization/consumer tests, CLI static rendering, WebApp projection mapping and lazy dispatch, and VS Code preview handling. Correct the getting-started dueDate schema from string to date as part of the Calendar fixture update; do not change real repository task dates. Add a Calendar fixture at a nonstandard configured path and a neutral-domain schema. Update canonical View documentation and built-in help only once behavior exists.

## Verification Cases

| Case | Expected result |
| --- | --- |
| date `2028-02-29`, no end | firstDate `2028-02-29`, afterLastDate `2028-03-01` |
| date `2027-02-29` | Date-invalid diagnostic; excluded, not rolled into March |
| dates `2028-02-28` through `2028-03-01` | Three covered days; appears in February and March |
| date start=end `2028-03-01` | One all-day event |
| datetime `2026-03-08T00:00:00-05:00` to `2026-03-09T00:00:00-04:00`, America/New_York | 23 elapsed hours, one covered calendar date: March 8 |
| datetime `2026-11-01T00:00:00-04:00` to `2026-11-02T00:00:00-05:00`, America/New_York | 25 elapsed hours, one covered calendar date: November 1 |
| point `2026-09-20T16:30:00Z`, Asia/Shanghai | Occupies September 21 even when browser timezone is America/Los_Angeles |
| datetime end at local midnight | Excludes that midnight's date |
| offset-free datetime, reversed interval, mixed types, orphan end | Invalid with source-locatable reason |
| scalar string field containing `2028-02-29` | Unsupported field type; no date inference |
| typed missing start, no end | Unscheduled; linked once in the unscheduled list |
| multiple applicable declarations with date/string conflict | Invalid rather than selecting a schema arbitrarily |
| empty source, all-unscheduled source, all-invalid source | Correct counts and empty states; no fabricated events |
| very long multi-year interval | One event in output; only visible grid cells are rendered |
| unknown projection kind from a newer backend | Explicit unsupported-projection handling; no Table crash |

These are proposed test oracles, not completed implementation tests. Add year-boundary, four-digit overflow, nested-field, named enum/reference rejection, and sorting tie cases in the focused suite. Verify static output from two independent builds of the same input, including execution under different host timezones.

WebApp visual acceptance covers 1440/1024/768/390 widths, choral-light/dark, keyboard navigation, visible focus, event expansion, navigation, root overflow, and console errors. VS Code acceptance covers narrow/wide previews, host themes, and entry navigation. Check actual generated static HTML and readability with scripting disabled.

## Performance Plan

Use fixed fixtures of 30, 1000, and 5000 entries, with recorded mixes of all-day points, multi-day intervals, timed events, unscheduled entries, and invalid entries. Include dense single-day and long-span variants. Record seed, counts, machine, command, build, and commit provenance.

Measure one-shot CLI cold elapsed time and JSON bytes over repeated runs separately from persistent RPC cold/warm requests and requests after date/schema/timezone edits. Measure browser first usable render and month-switch latency in a production build through the real backend, along with DOM size and root overflow. Record median and p95 with a stated sample count; use at least 20 samples for latency comparisons. Do not count build time as render time.

Compare against the same pre-change fixture and a relevant existing View only to identify overhead, not to claim identical workload semantics. Set concrete acceptance budgets from baseline measurements before optimization. A failed scale gate requires a documented bounded-range or row-windowing design, not silent event truncation or a speculative new dependency. Existing passing tests are not performance evidence.

## Risk And Confidence

The highest correctness risks are date/datetime coercion, DST arithmetic, mixed-source schema interpretation, old-client dispatch, and inconsistent host ranges. Explicit typed Core output and the cases above address them without introducing a new engine. Rendering dense months is a measured UI risk; it is not grounds to preinstall a calendar library.

Gantt reuses the date/instant and interval normalization concepts after review, but its DSL, dependency relation types, connectors, milestones, and scheduling semantics remain outside this Calendar contract. Gantt research can start after the shared temporal decisions are accepted; Calendar does not need to ship first.

## Review Decision

Status: accepted by the user on 2026-09-21, with implementation authorized. No independent reviewer or task owner assignment is inferred from the current Git identity. Delivery verification remains separate from contract approval.

Recommended decisions for review are: inclusive authored all-day ends versus exclusive datetime ends; strict schema-typed bindings with no string inference; complete Core projection with interactive current-month state; and Agenda-only initial static/VS Code support. The new field syntax and projection shape above are part of the same review.

## Follow-Up

1. Record independent contract review and any revisions; resolve review responsibility without self-approving the public contract.
2. Implement and test the Core normalization and typed projection against the oracles above.
3. Add WebApp month/Agenda and static/VS Code Agenda adapters, examples, and documentation.
4. Complete focused tests, visual/host evidence, scale measurements, Forma checks, and the complete project gate; report remaining limits before delivery acceptance.

Implementation evidence: [[design/calendar-view-validation-2026-09-21]].
