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

## Proposed Projection Scroll-Contract Follow-up

Design a focused follow-up before resuming Table implementation. It should decide how a projection can own horizontal overflow while its sticky descendants use the responsive page-owned vertical scroll surface.

The follow-up must:

1. define the vertical owner, horizontal owner, sticky containing block, route Header offset, and projection start/end boundaries as one explicit layout contract at 1440, 1024, 768, and 390 px;
2. prototype a semantic Table with representative long and wide data through the real backend before changing Kanban or VS Code;
3. preserve projection-local horizontal scrolling, root overflow, column alignment, focus visibility, Light and Dark theme roles, and content before and after the projection;
4. reject JavaScript scroll synchronization, duplicated visual headers, hidden nested vertical scrolling, fixed projection heights, global overflow clipping, and premature generic abstractions; and
5. return either a browser-native contract that passes geometry validation or an explicit product limitation. Only the passing native contract may unblock this task's Table gate and later slices.

## Acceptance Criteria

- A long Table keeps its column headers visible during vertical scrolling without losing horizontal scrolling or column alignment.
- A tall Kanban keeps every visible column header at the same usable top position while all configured columns remain in one horizontally scrollable row.
- Headers do not overlap the WebApp route Header at any supported responsive breakpoint and do not remain pinned after the projection ends.
- The page root gains no horizontal overflow and the change introduces no unnecessary nested vertical scrolling or keyboard scroll trap.
- Light and Dark themes preserve clear separation between pinned headers and scrolling content.
- The WebApp passes visual and geometry validation at 1440, 1024, 768, and 390 px using a representative workspace with long Table rows, long column labels, and uneven Kanban columns.
- The VS Code preview is either updated and verified in narrow and wide editor groups, or a host-specific limitation and follow-up are recorded with evidence.
- Focused automated checks and the applicable WebApp, VS Code, and repository gates pass.
