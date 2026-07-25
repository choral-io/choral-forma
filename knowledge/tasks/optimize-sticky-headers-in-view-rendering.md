---
schemaVersion: 1
kind: task
scope: "project"
title: "Optimize sticky headers in View rendering"
summary: "Keep configured Table headers and Kanban column headers visible within the View-owned scroll surface."
type: "task"
priority: "P2"
value: "M"
module: "app"
effort: "M"
status: "backlog"
readiness: "ready"
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - views
    - webapp
    - vscode
    - table
    - kanban
    - responsive
blockedBy: []
relatedTo:
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "tasks/implement-vscode-view-preview"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: "WebApp and VS Code View projection layout and scrolling"
---

# Optimize sticky headers in View rendering

## Goal

Keep the structural context of long configured Views visible while users scroll, starting with Table column headers and Kanban column headers.

## Sources

- [[guidelines/webapp-engineering-and-visual-validation]]
- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[tasks/implement-vscode-view-preview]]

## Context

The WebApp currently renders Table projections inside a horizontal overflow wrapper while the route owns vertical scrolling. Kanban owns horizontal scrolling but its column headers scroll away with the cards. The VS Code preview has equivalent Table and Kanban surfaces with host-native styling.

Adding `sticky` independently to each header would be fragile: horizontal overflow wrappers can become the sticky containing block, the WebApp uses different vertical scroll owners across responsive breakpoints, and a pinned header must stop at the projection boundary when Markdown appears before or after it.

## In Scope

- Define one explicit vertical scroll owner and sticky top-offset contract for View projections at each responsive layout.
- Keep configured Table headers visible while preserving semantic `<thead>` and `<th scope="col">`, local horizontal scrolling, and header/body column alignment.
- Prefer DaisyUI `table-pin-rows` in the WebApp when it works with the selected scroll container; otherwise use the smallest native `position: sticky` Tailwind implementation.
- Keep each configured Kanban column header visible while preserving a single configurable row of columns, board-owned horizontal scrolling, and natural column height.
- Scope sticky behavior to the projection so headers stop before content rendered after the View.
- Use theme-semantic surfaces, borders, and text colors with enough contrast in Light and Dark modes.
- Apply equivalent behavior to the VS Code preview only where its preview scroll container supports it naturally; preserve VS Code-native rendering and styling rather than forcing WebApp markup parity.
- Add focused layout checks for scroll ownership, sticky position, horizontal overflow, and projection boundaries.

## Out of Scope

- Changing the View projection data contract, configured columns, sorting, filtering, or card fields.
- Making List, Graph, page metadata, or the complete application Header sticky.
- Adding independently scrolling Kanban columns or fixed projection heights.
- Forcing Zed parity before Zed exposes an equivalent View preview surface.
- Introducing a generic sticky-header component before both target projections are implemented and validated.

## Approved Execution Plan

This original slice order is retained as decision history. The later **Kanban Priority Adjustment — 2026-07-25** supersedes its Table-first sequencing after the native scroll-contract proof failed and the user explicitly prioritized persistent Kanban column context.

Deliver this task in three gated slices. Do not begin a later slice until the current slice has established and passed its own scroll and sticky contract.

### 1. Prove the WebApp Table contract

- Start with the WebApp Table projection and a representative long table.
- Measure the actual page and projection geometry at 1440, 1024, 768, and 390 px before changing styles, including vertical scroll ownership, local horizontal overflow, the effective sticky top offset, root overflow, and the projection's start and end boundaries.
- Preserve semantic `<table>`, `<thead>`, and `<th scope="col">` markup.
- Prefer DaisyUI `table-pin-rows` when it satisfies the measured contract. Otherwise keep the smallest native `position: sticky` implementation local to the Table projection.
- Verify that the header remains aligned while the Table scrolls horizontally, stays below the route Header, stops at the projection boundary, and does not obscure focused content.

**Gate:** Continue only when Table pinning works with page-owned vertical scrolling and projection-owned horizontal overflow at every representative breakpoint without adding a nested vertical scroller, fixed projection height, or JavaScript scroll synchronization.

### 2. Apply the proven contract to WebApp Kanban

- Begin only after the Table gate passes.
- Apply the same proven scroll-owner, sticky-offset, and projection-boundary contract directly to the existing Kanban column-header markup.
- Preserve one configurable horizontally scrollable row, natural and uneven column heights, semantic heading structure, and theme behavior.
- Do not introduce a generic sticky-header abstraction, independently scrolling columns, fixed column or projection heights, or controlled scroll state.

**Gate:** Continue only when all visible Kanban column headers share the usable sticky position, remain aligned during board-owned horizontal scrolling, stop at the projection boundary, and preserve natural document scrolling.

### 3. Evaluate VS Code native Markdown preview separately

- Begin only after the WebApp projection contract is proven for Table and Kanban.
- Measure the native Markdown preview in narrow and wide editor groups rather than assuming the WebApp container contract applies.
- Implement only scoped native preview CSS when sticky behavior works naturally with the host-owned scroll surface.
- If the host cannot support the contract naturally, record the VS Code limitation and evidence instead of forcing pixel parity with the WebApp.

**Gate:** Complete the host slice only when the preview preserves VS Code-native rendering, scrolling, focus, and theme behavior. A documented host limitation is an acceptable outcome when native sticky cannot satisfy those constraints.

## Scroll-Contract Decision Gate

If local horizontal overflow prevents native sticky positioning from working reliably with page-owned vertical scrolling, stop this task's scope escalation. Record the measured container and boundary evidence, then create or design a focused projection scroll-contract follow-up. Do not work around the conflict with JavaScript scroll synchronization, hidden nested vertical scrolling, fixed projection heights, or global overflow clipping.

## AI-Assisted Delivery Gates

Scope and progress are governed by observable validation outcomes rather than staff-hour estimates:

1. **Table feasibility:** real scroll ownership and boundary geometry are measured; the Table gate either passes with a minimal semantic implementation or stops with evidence for the scroll-contract follow-up.
2. **Kanban transfer:** the proven Table contract is applied without abstraction or a new scrolling model and passes focused geometry checks.
3. **VS Code host fit:** native preview behavior is independently verified, with scoped CSS delivered only when the host supports it naturally.
4. **Completion:** focused automated checks, visual geometry evidence, Light and Dark themes, accessibility and focus behavior, responsive widths, and applicable repository gates all pass.

The main uncertainty is browser and host sticky behavior when horizontal overflow and vertical scrolling have different owners. Each slice resolves that uncertainty before broadening implementation scope.

## WebApp Table Feasibility Result — 2026-07-25

The first execution slice stopped at the approved scroll-contract decision gate. No product code, Kanban behavior, VS Code preview behavior, task metadata, or release artifact was changed.

Validation used the production WebApp build through the real Forma backend and a temporary copy of this repository workspace. The temporary workspace added one Table View over the Tasks space with 80 rows, seven configured columns, long labels, local horizontal overflow, and Markdown before and after the projection. The temporary fixture was not added to the repository.

### Measured scroll ownership

| Width | Active vertical owner | Vertical viewport top | Table horizontal owner | Horizontal owner computed overflow |
| --: | --- | --: | --- | --- |
| 1440 px | View route `<main>` | 112 px | Table wrapper | `auto / auto` |
| 1024 px | Route frame | 0 px | Table wrapper | `auto / auto` |
| 768 px | Route frame | 0 px | Table wrapper | `auto / auto` |
| 390 px | Route frame | 0 px | Table wrapper | `auto / auto` |

The Table wrapper's `overflow-x: auto` computes to `overflow-y: auto`. Its projection-boundary parent also uses `overflow: hidden`. Both create overflow ancestors between the header row and the page-owned vertical scroll container. The page root retained zero horizontal overflow at every measured width.

### Native sticky probe

A temporary browser-only probe applied `position: sticky` to the existing semantic header row, scrolled the active vertical owner by 600 px, and scrolled the Table wrapper horizontally by 200 px. The source markup remained `<table>`, `<thead>`, and configured column headers.

|   Width | Required pinned top | Measured header-row top | Result |
| ------: | ------------------: | ----------------------: | ------ |
| 1440 px |              112 px |                 -303 px | failed |
| 1024 px |              112 px |                 -191 px | failed |
|  768 px |                0 px |                 -310 px | failed |
|  390 px |                0 px |                 -282 px | failed |

The header row followed the local overflow ancestors out of view instead of pinning to the active page-owned vertical scroll surface. DaisyUI `table-pin-rows` uses the same native sticky positioning on the header row, so its modifier does not change this containing-block result.

As a causality check, the probe temporarily changed both projection overflow ancestors to `overflow: visible`. The header then pinned at the required 112 px desktop and 0 px mobile positions, but horizontal overflow moved to the page-owned vertical container: its `scrollWidth` grew from 1184 to 1481 px at 1440 px and from 390 to 1465 px at 390 px. That trades projection-owned horizontal scrolling for page-level two-axis scrolling and therefore fails the accepted contract.

Theme styling, focus geometry, and final projection-boundary behavior were not claimed as validated because the feasibility gate failed before a deliverable sticky state existed. Existing semantic markup, theme roles, accessible column headers, responsive widths, and overflow behavior remain unchanged.

## Projection Scroll-Contract Design Result — 2026-07-25

The follow-up design did not find a browser-native CSS and semantic-markup contract that satisfies all approved constraints simultaneously:

- the page owns vertical scrolling;
- the projection owns horizontal scrolling;
- the sticky header follows the page scroll and stops at the projection boundary;
- the page root does not gain horizontal overflow;
- the projection does not gain a bounded or independent vertical scroller; and
- no JavaScript scroll synchronization or duplicated visual header is introduced.

This is a platform containing-block conflict rather than a missing Tailwind or DaisyUI modifier. CSS sticky positioning follows the nearest ancestor that establishes a scrolling mechanism on either axis. An ancestor that provides `overflow-x: auto` therefore captures vertical sticky positioning even when it has no usable vertical scroll range.

### Focused browser proof

An isolated browser proof reproduced the relevant Table and Kanban markup with content before and after each projection. It exercised a 1200 px semantic Table at 1024 and 390 px browser widths and measured the same geometry in both responsive states.

| Option | Sticky follows page | Projection-local horizontal scroll | Page horizontal overflow | Natural page vertical scroll | Result |
| --- | --- | --- | --- | --- | --- |
| Current `overflow-x: auto` wrapper | no | yes | no | yes | rejected |
| Wrapper with explicit `overflow-y: clip` | no | yes | no | yes | rejected |
| Remove projection overflow ancestors | yes | no | yes | yes | rejected |
| Projection owns both axes | yes | yes | no | no | rejected |
| Split sticky header from scrollable body | yes | yes | no | yes | rejected without synchronization |
| Current natural-height Kanban board | no | yes | no | yes | rejected |

The explicit clip option computed to `overflow: auto / hidden` and still captured sticky positioning. Removing the overflow ancestors let sticky pass, but a 1200 px Table increased the page scroll owner's width from 718 to 1217 px in the desktop proof and from 322 to 1217 px in the mobile proof.

The bounded two-axis option passed sticky and local horizontal scrolling only by making the projection a vertical scroller with a fixed maximum height. The split-header option passed sticky and local horizontal ownership, but after the body scrolled 240 px horizontally the header and body were misaligned by 240 px. Closing that gap requires scroll synchronization. It also requires either two tables, which breaks native header associations, or an `aria-hidden` visual clone alongside the original semantic header.

The Kanban proof reproduced the same containing-block failure with natural-height columns. Moving its headers outside the board scroller would likewise separate each heading from its column geometry and require horizontal synchronization or duplicated headings.

Experimental scroll-driven animation, fixed-position, and view-timeline approaches are not a smaller native contract. They would reconstruct sticky lifecycle and projection boundaries through animation, have weaker cross-browser and Electron host support, and still need explicit horizontal alignment behavior.

### Recommendation and decision boundary

Do not implement sticky Table, Kanban, or VS Code headers under the current constraints. Preserve the current semantic, theme-safe, projection-local horizontal scrolling behavior and treat sticky headers on horizontally overflowing projections as an explicit product limitation.

If sticky headers remain mandatory, a maintainer decision must explicitly relax one constraint before implementation:

1. authorize a feature-local synchronized visual header while retaining the original semantic header;
2. authorize a bounded two-axis projection scroller and its keyboard/scroll-region contract; or
3. authorize page-level horizontal scrolling.

The first option is the least disruptive to natural page vertical scrolling, but it is materially broader than the approved native-CSS task. It introduces synchronization, duplicated presentation, accessibility review, responsive offset coordination, and separate Table and Kanban geometry work. It must not be started without explicit approval.

### Accessibility, theme, and responsive implications

- Preserve one semantic `<table>`, `<thead>`, and `<th scope="col">` relationship unless a separately approved visual clone is hidden from the accessibility tree and the original header remains authoritative.
- Preserve each Kanban heading inside its configured column unless a separately approved visual clone keeps the original section-heading relationship intact.
- Do not introduce a focusable nested scroll region merely to make sticky positioning work. It would add keyboard scroll ownership, focus indication, accessible naming, and scroll-trap risks.
- Geometry is theme-independent, but any approved pinned or cloned surface must continue to use semantic base surfaces, borders, and text roles in Light, Dark, forced-colors, and increased-contrast environments.
- The responsive vertical owner remains `<main>` at 1440 px and the route frame below `xl`. The usable pinned top is 112 px at 1440 and 1024 px, then 0 px after the non-sticky route Header scrolls away at 768 and 390 px.
- Any broader solution must treat long configured labels, dynamic column counts, text zoom, and narrow viewports as input geometry rather than relying on repeated Header heights or fixed projection dimensions.

### Acceptance gates for any approved contract change

1. Use the real backend with a representative Table and uneven natural-height Kanban columns, including Markdown before and after each projection.
2. At 1440, 1024, 768, and 390 px, verify the active vertical owner, sticky top offset, projection start/end boundary, and `document.scrollWidth === document.clientWidth`.
3. At horizontal positions 0, midpoint, and maximum, verify exact header/body or header/column alignment without obscuring focused content.
4. Preserve projection-local horizontal scrolling with no independent vertical scrolling, fixed projection height, global clipping, or page-level horizontal scrolling unless that exact constraint was explicitly relaxed.
5. Verify one authoritative accessible Table header relationship and one authoritative heading relationship per Kanban column, with no duplicate accessibility-tree announcements.
6. Verify keyboard scrolling, focus visibility, zoom, Light and Dark themes, forced colors, and console output.
7. Complete Table independently before re-evaluating Kanban, then evaluate VS Code native preview as a separate host contract.

## Kanban Priority Adjustment — 2026-07-25

The user explicitly deferred Table sticky headers and authorized a Kanban-only implementation slice because losing column context makes long boards difficult to use. This approval relaxes the previous prohibition on a duplicated presentation layer only for Kanban and only within the following bounded contract:

- keep each real `<h3>` heading inside its configured `<section>` as the only authoritative accessible column heading;
- add a feature-local, `aria-hidden` visual header rail only while the real headings have scrolled away;
- share the existing controlled Kanban column width and gap classes between the real columns and visual rail;
- synchronize only the board's horizontal scroll position;
- let the page keep vertical scroll ownership and let the sticky rail stop at the projection boundary;
- do not add independently scrolling columns, a nested vertical board scroller, fixed board or column heights, page-root horizontal overflow, JavaScript vertical-scroll synchronization, a generic sticky abstraction, Table changes, or VS Code changes.

The implementation may begin only after a focused browser proof demonstrates that an overlapping sticky rail outside the horizontal board scroller can remain projection-bounded without changing natural document height. The proof must also show exact rail-to-column alignment at horizontal start, midpoint, and maximum positions on desktop and mobile.

### Third-party component evaluation

No dependency is approved for this slice.

- **TanStack Table:** the current stable React package is `@tanstack/react-table` 8.21.3. Its official documentation describes a headless state and layout engine: the application still supplies all DOM, CSS, and scroll containers. Its column-sizing, ordering, visibility, filtering, sorting, grouping, and pinning APIs could be a useful future foundation if Forma's Table projection gains interactive table-state requirements. Virtualization is not built into TanStack Table; its official guide composes Table with TanStack Virtual or another virtualization library.
- **Scroll-contract fit:** TanStack Table does not solve the proven overflow-ancestor constraint. Its official sticky-column example still applies CSS `position: sticky`, and its column-pinning guide either uses sticky CSS in one table or splits pinned columns into separate tables. Neither changes vertical sticky containment for a semantic header inside Forma's projection-local horizontal scroller. It improves Table column/layout/state ergonomics, not Kanban header persistence.
- **Kanban fit:** a board component would be materially broader than the accepted presentation-only requirement and would still have to choose between the same horizontal overflow ancestor, a split visual header, or a different scrolling model. The existing Kanban already owns the required semantic headings, cards, responsive widths, and theme behavior, so replacing it would add state and interaction surface without resolving the browser constraint. The bounded feature-local rail remains the smallest candidate.

Official references:

- [TanStack Table overview](https://tanstack.com/table/latest/docs/overview)
- [TanStack Table column sizing guide](https://tanstack.com/table/latest/docs/guide/column-sizing)
- [TanStack Table column pinning guide](https://tanstack.com/table/latest/docs/guide/column-pinning)
- [TanStack Table virtualization guide](https://tanstack.com/table/latest/docs/guide/virtualization)
- [TanStack Table sticky column pinning example](https://tanstack.com/table/latest/docs/framework/react/examples/column-pinning-sticky)
- [`@tanstack/react-table` on npm](https://www.npmjs.com/package/@tanstack/react-table)

### Kanban proof and delivery gates

1. **Architecture proof:** an overlapping page-sticky rail remains outside the board's overflow ancestor, adds no document height, and stops at the projection boundary with Markdown before and after the board.
2. **Geometry:** at 1440, 1024, 768, and 390 px, every rail item matches its real column's left edge and width within one CSS pixel at horizontal start, midpoint, and maximum positions.
3. **Scroll ownership:** vertical scrolling remains page-owned; horizontal scrolling remains board-owned; the rail mirrors only `scrollLeft`; the page root gains no horizontal overflow.
4. **Accessibility and interaction:** the real column headings remain present once each in the accessibility tree; the visual rail is `aria-hidden`, has no focusable descendants, and does not intercept pointer or keyboard input.
5. **Resilience:** alignment and visibility remain correct after viewport resize, browser zoom, theme changes, configured label/count/content changes, and uneven natural column heights.
6. **Completion:** ordinary Kanban card links, keyboard board scrolling, focus visibility, Light and Dark themes, forced-colors behavior, console output, focused automated checks, and project-native validation pass. Table and VS Code remain deferred.

## Table Visual Prototype Adjustment — 2026-07-25

Before any Kanban product code changed, the user changed the immediate proof order again: use Table first to validate the framework-agnostic visual sticky-header mechanism. This section supersedes only the implementation order in the preceding Kanban adjustment. It does not withdraw the accepted Kanban rail contract or broaden the task beyond a bounded Table prototype.

The Table prototype is authorized only under this contract:

- preserve the existing semantic `<table>`, `<thead>`, `<th scope="col">`, and configured header relationships inside the horizontal scroller;
- render one presentation-only visual header with the Table projection and keep it `aria-hidden`;
- place the visual header outside the Table's horizontal overflow ancestor so page-owned vertical sticky positioning remains possible;
- share the real Table's measured column geometry rather than maintaining an independent fixed-width model;
- synchronize only the Table scroller's horizontal position in one direction;
- show the visual header only after the real semantic header crosses the responsive sticky offset;
- let native sticky positioning stop the visual header at the projection boundary;
- never make the visual header focusable or pointer-interactive;
- keep the reusable seam below projection rendering: one narrow projection-boundary lifecycle controller may own reveal, hide, native boundary stopping, observer/listener scheduling, and cleanup;
- keep Table-specific header measurement and horizontal synchronization in a Table adapter; document that a later Kanban adapter can provide controlled column-rail geometry without sharing Table markup;
- do not add a generic cloned-header component, projection renderer, third-party dependency, nested vertical scroller, fixed projection height, page-root horizontal overflow, Kanban source change, or VS Code change.

### Table prototype gates

1. **Architecture:** an overlapping sticky visual header remains outside the horizontal overflow ancestor, adds no document height, and stops before Markdown rendered after the projection.
2. **Semantic authority:** the real `<thead>` remains in the accessibility tree and the visual clone is absent from it, has no focusable descendants, and cannot intercept pointer input.
3. **Geometry:** at 1440, 1024, 768, and 390 px, every visual header cell matches its real column's left edge and width within one CSS pixel at horizontal start, midpoint, and maximum positions.
4. **Scroll ownership:** vertical scrolling remains page-owned; horizontal scrolling remains Table-owned; the page root continues to satisfy `scrollWidth === clientWidth`.
5. **Lifecycle and reuse seam:** visibility and alignment remain correct after viewport resize, browser zoom, theme changes, configured label/content changes, projection rerender, and component unmount, with observers and listeners cleaned up. The proof must keep boundary lifecycle inputs projection-neutral while Table geometry remains Table-specific.
6. **Completion:** Light and Dark themes, keyboard Table scrolling, focus visibility, content before and after the projection, console output, focused automated checks, production build, and project-native validation pass. If any gate is unreliable, stop without starting Kanban or forcing a partial solution.

## Acceptance Criteria

- A long Table keeps its column headers visible during vertical scrolling without losing horizontal scrolling or column alignment.
- A tall Kanban keeps every visible column header at the same usable top position while all configured columns remain in one horizontally scrollable row.
- Headers do not overlap the WebApp route Header at any supported responsive breakpoint and do not remain pinned after the projection ends.
- The page root gains no horizontal overflow and the change introduces no unnecessary nested vertical scrolling or keyboard scroll trap.
- Light and Dark themes preserve clear separation between pinned headers and scrolling content.
- The WebApp passes visual and geometry validation at 1440, 1024, 768, and 390 px using a representative workspace with long Table rows, long column labels, and uneven Kanban columns.
- The VS Code preview is either updated and verified in narrow and wide editor groups, or a host-specific limitation and follow-up are recorded with evidence.
- Focused automated checks and the applicable WebApp, VS Code, and repository gates pass.
