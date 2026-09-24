---
scope: project
type: technical-assessment
title: Calendar View Validation — 2026-09-21
summary: Calendar implementation evidence, cross-surface checks, scale measurements, and remaining acceptance limits.
owners: []
reviewers: []
tags:
    - calendar
    - views
    - validation
sources:
    - proposals/calendar-temporal-view-contract
    - tasks/implement-read-only-calendar-view
---

# Calendar View Validation — 2026-09-21

## Final Acceptance And Host Visual Verification — 2026-09-24

The maintainer accepted Calendar delivery on 2026-09-24. A source Extension Development Host running VS Code 1.123.2 on macOS arm64 verified the healthy validation corpus in built-in Light Modern and Dark Modern themes at 580 × 900 and 1440 × 900 workbench viewports. Actual preview widths were 532 and 1392 CSS pixels, with scroll width equal to client width in all four cases. Screenshots confirmed readable titles, classification, timezone, date ranges and the unscheduled entry. The first source link had a visible solid 1px focus outline; Enter navigated to its source entry preview. This is real host visual evidence, distinct from the previously recorded packaged-VSIX semantic checks. The isolated test host was stopped.

Calendar now uses container-based responsive density: below 40rem Agenda, 40–56rem compact 10.5rem cells, and 56rem upward 13.5rem cells. Actual item height controls the bounded preview rather than a fixed event-count cap. The compact layout passed three-browser light/dark checks, drawer completeness and focus restoration, plus the full repository gate.

The sections below are historical snapshots. Statements about missing Gantt implementation, host validation, assignment or acceptance are superseded by this section and [[planning/temporal-view-release-plan]]. Earlier timings are not measurements of subsequent UI changes.

## Candidate

Local implementation based on `e9f4175`, following the user's contract and execution approval. No commits, publication, new runtime dependencies, or lockfile changes are required by Calendar. The current working tree also contains separate dependency updates; keep their review and commit boundary separate. Gantt remains unimplemented.

Core owns schema binding, strict civil dates, offset instants, workspace timezone/DST, inclusive authored all-day ends, exclusive datetime ends, point events, diagnostics, and candidate counts. WebApp consumes the projection through RPC or generated static data. Shared contains only the typed contract and the event label formatter reused by WebApp and VS Code; civil layout remains feature-local.

WebApp uses a lazy Calendar chunk, native CSS Grid, a native dialog styled as a right-side day drawer, and existing DaisyUI controls. Narrow screens use Agenda. Static HTML and VS Code have complete date-grouped Agendas, not interactive month grids. The getting-started Tasks schema now declares `dueDate: date`, and its structured template omits an absent optional date instead of writing an invalid empty string.

## Behavior And Browser Evidence

- Core fixtures cover leap days, 23/25-hour DST days, timezone conversion, inclusive/exclusive endpoints, points, reversed/orphan/invalid dates, range overflow, missing bindings, nested bindings, rejected list traversal, mismatched end types, source/query selection, configured sorting, and JSON round trips. Neutral exhibition fields use `config/*.md`, not conventional Task paths. Existing ambiguous schema membership is rejected before Calendar candidate selection.
- Shared formatter, RPC mapper, static mapper, and VS Code renderer tests cover typed event semantics, navigation, and escaping. Static HTML tests cover inclusive range labels, unscheduled entries, escaping, and deterministic output.
- Production WebApp served by the real Forma backend, separate headless Chromium session, synthetic exhibition workspace with 1000 entries and deliberately long titles. Inspected 1440/1024/768/390 widths in choral-light and choral-dark; all eight states had root scroll width equal to viewport width. Browser timezone was Asia/Kuala_Lumpur; workspace timezone was America/New_York.
- Keyboard Enter changed months and displayed the empty October state. Focus remained on the control with a visible solid outline. Native details opened by keyboard, exposed all 37 additional links on the tested date, and retained a visible focus outline. Tab/Enter opened the selected source page. Browser error collection was empty.
- Actual getting-started static build succeeded with zero diagnostics. In a separate browser with page scripting disabled, Calendar displayed six scheduled entries and one unscheduled entry, no month controls, no root overflow at 390 px, and a working source-page link.
- Persistent backend invalidation was tested against generated temporary files: a changed event date, workspace timezone, and bound schema type were reflected by subsequent RPC calls (approximately 50/246/251 ms observed, one sample each). Each temporary source was restored.

## Scale Measurements

### Approved Calendar Polish Follow-Up

Month cells now have equal 216 px heights, including empty days. Titles use at most two lines; actual measured height determines fully visible items, rather than a fixed three-event limit. A bounded preview includes additional content under a bottom fade. Partially or fully clipped items are inert and hidden from assistive navigation; the date-header count opens the complete day list. There is no `more events` control. The native dialog provides modal focus handling, Escape/backdrop/close-button dismissal, and source links. No dependency was added.

The live IAB preview verified three full long-title items plus a fourth-item fade, and five full short-title items plus a sixth-item fade. The temporary 1000-entry fixture includes six shortened titles on September 4 for this comparison. All inspected month cells measured 216 px. Both tested date drawers exposed all 40 events. Enter opened the drawer with focus on Close; Escape returned focus to the count. Source navigation closed the drawer and opened the correct page. Clipped preview items had both `inert` and `aria-hidden`. Responsive light/dark checks covered 1440/1024/768/390 widths without root horizontal overflow; the drawer fit 390 px and narrow screens retained Agenda. These are functional/layout checks, not a rerun of the timing benchmark below.

The full `mise run check` passed after the preview/layout changes; a subsequent close-animation content-retention fix was checked with WebApp lint and build. The user-requested loopback preview service and IAB tab remain open. The earlier browser/server cleanup statement below describes the pre-polish validation stage only.

### Dynamic Weeks And Classification Colors

The subsequent approved iteration uses four to six complete weeks instead of a fixed six-row grid. Tests cover Monday/Sunday starts, four/five/six-week months, leap dates, and year boundaries. Live IAB checks confirmed September 2026 has five rows, August 2026 six, and February 2027 four, retaining 216 px cells.

The approved classification-color iteration adds optional `calendar.presentation.events.colorBy.taxonomy` or `.field`. Core reuses Graph classification and scalar palette logic; tests verify palette parity, explicit hex colors, neutral unsupported values, taxonomy fallback, multiple matches, absent configuration, and invalid configuration diagnostics. RPC/static mapper tests preserve the projection and VS Code tests check label escaping. WebApp uses outlined decorative color stripes, retaining neutral theme text/backgrounds, with classification labels in Agenda and the drawer. Static HTML and VS Code retain text labels. No dependency was added.

Production IAB validation covered 1440/1024/768/390 widths in light and dark themes without root overflow or browser warnings/errors. White and black classification samples retained the same text/background styling as other categories. A 40-item drawer retained all items and displayed classification labels; Escape dismissal was exercised. The full repository check passed, followed by the additional taxonomy fallback/multiple-match test (10 Calendar integration tests passed) and zero-diagnostic workspace check/health. The updated backend preview runs on loopback port 43188; the older user-requested service on 43187 was preserved because stopping it was denied. Both remain running; no commit or publication was performed.

### Pre-Polish Benchmark

Local macOS measurements, debug Rust backend and production WebApp; not release-build or cross-device performance guarantees. Each latency row uses 20 samples. Browser initial usability is navigation start to the Calendar mounting plus two animation frames, with a warm browser/backend. RPC includes JSON transfer/parsing. Month switching is click to two animation frames. Values are median / p95, in milliseconds.

| Candidates | CLI elapsed     | JSON bytes | Initial usable  | Warm RPC     | Month switch  |
| ---------- | --------------- | ---------- | --------------- | ------------ | ------------- |
| 30         | 20.7 / 21.7     | 8,129      | 647.5 / 657.3   | 0.9 / 1.4    | 33.5 / 34.2   |
| 1000       | 284.2 / 518.2   | 255,342    | 771.6 / 777.6   | 13.5 / 26.2  | 33.3 / 49.8   |
| 5000       | 1543.1 / 2655.6 | 1,283,343  | 1149.4 / 1230.4 | 64.5 / 131.3 | 149.3 / 175.2 |

CLI timings are separate one-shot processes, including workspace loading; OS filesystem caches were not purged. Browser DOM counts were approximately 622/5547/25547, with no root overflow or browser errors. The synthetic distribution places almost every event in September, including one cross-month event, one invalid date, and one unscheduled entry.

These results do not justify adding virtualization or a Calendar library. Provisional same-machine regression budgets are p95 under 1500 ms for warm first usability and under 200 ms for month switching at 5000 entries. If representative larger or slower-device workloads exceed these bounds, first reduce duplicate hidden Agenda/detail DOM, then assess explicit range loading as a separately reviewed operation contract. Do not silently truncate events or introduce a generic timeline framework.

### Native Month Jump And Code Governance

The heading opens a native popover with a month input and explicit Jump/Enter submission. Feature detection falls back to a date input when `month` is unsupported. Draft edits do not navigate; canceling discards them. Playwright CLI checks passed on Chromium 154, Firefox 156, and WebKit reporting Safari 26.6: Chromium used `month`, while Firefox and WebKit used `date`. Tests covered cross-year navigation, empty input rejection, Escape/outside dismissal, focus restoration, and 1440/1024/768/390 px layouts. WebKit required explicit Escape focus restoration. These are engine-level tests, not installed Safari or real iPhone native-picker acceptance.

Code governance reproduced an open-popover resize defect: after changing from 1440 to 390 px, the panel remained at x=276 with width 288 and overflowed. Positioning now uses measured dimensions and follows resize/scroll events, with local scrolling in short viewports; it does not require CSS anchor positioning. Feature-local unit tests cover exact month/date input, leap-day rejection, years 0001–9999, and position clamping. Calendar projection types, including classification, are exported for typed Rust consumers. No new library or generic UI layer was introduced.

The final border implementation supersedes the earlier decorative-stripe prototype: all entries retain the same left-border width and layout, overriding only `border-left-color` for valid configured colors and retaining the default theme border otherwise.

After governance, the resize regression passed at 390 × 300 px (panel x=16, y=118, width=288, height=166). The complete month-jump flow passed again in Chromium, Firefox, and WebKit without page errors. The final `mise run check`, example-workspace checks, repository check/health, and whitespace checks passed. A separate pre-existing Wrangler upgrade had left the deployment test pinned to the old version; its exact-version expectation was synchronized with the current manifest without weakening the assertion. Dependency manifests, lockfiles, and that deployment test should form a separate commit from Calendar. Local commits are technically ready for authorization; publication, independent review, and final host acceptance remain separate.

## Initial Implementation Verification And Remaining Limits

The final `mise run check` passed: 426 JavaScript tests, all Rust workspace suites (including seven Calendar integration tests), package type/lint/build checks, Rust formatting/checks, and the Zed target check. `pnpm check:examples` passed for all five example workspaces. Repository `forma check --json` and `forma workspace health --json` passed with zero diagnostics/findings. Two static builds compared byte-for-byte equal. Final production and no-script static screenshots were rechecked after source changes; the task-owned browsers and four loopback servers were closed. This candidate has not been published or accepted as Done.

Installed VS Code extension-host rendering, narrow/wide host themes, and host navigation remain unverified; renderer tests are not a substitute. Independent contract review and owner/reviewer assignment remain explicit follow-up. Performance measurements do not establish cold persistent-RPC startup, release-build, or low-end-device guarantees. Temporary samples and browser evidence stay outside version control.
