---
scope: project
type: ui-spec
title: WebApp Review Surface Design And Acceptance
summary: Product, interaction, implementation, and acceptance requirements for rebuilding the maintenance-mode WebApp as a lightweight workspace review and knowledge-reading surface.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - webapp
    - review-surface
    - reader
    - daisyui
    - acceptance
sources:
    - "product/product-direction"
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/webapp-v2-package-architecture"
    - "planning/daisyui-webapp-foundation-rewrite-plan"
    - "design/webapp-v2-dashboard-design"
---

# WebApp Review Surface Design And Acceptance

## Purpose

Define the accepted product direction, implementation constraints, validation protocol, and completion criteria for rebuilding the Forma WebApp as a lightweight read-only workspace review and knowledge-reading surface.

This document supersedes [[design/webapp-v2-dashboard-design]] as the current WebApp product and interaction specification. The earlier document remains historical evidence for the V2 dashboard direction. [[planning/daisyui-webapp-foundation-rewrite-plan]] remains the implementation record for the completed Tailwind CSS, DaisyUI, and native-browser foundation migration.

## Product Position

The WebApp is a `Workspace Review Surface` and knowledge reader. Its primary jobs are:

1. Orient the reader from a small Home surface.
2. Open configured Views and recent content.
3. Read rendered Markdown documents.
4. Review List, Table, Kanban, and Graph projections.
5. Browse user-configured taxonomies, terms, and entries.
6. Explain actionable workspace health findings.
7. Jump to known resources through Quick Open.

The WebApp is not the primary authoring surface. Markdown authoring remains in editors, and repository Markdown plus explicit Forma configuration remain the source of truth.

The current rewrite does not include:

- Markdown editing;
- AI Chat;
- create, update, drag-and-drop, or batch operations;
- saved-view customization;
- a hidden frontend knowledge store;
- replacement of VS Code or Zed authoring workflows;
- new Core, RPC, schema, or workspace semantics introduced only to support visual polish.

## Approved Design Direction

The accepted direction combines the content hierarchy of the selected `Review Desk` wireframe with the narrow navigation rail of the selected `Projection Workspace` wireframe.

### Expanded Desktop Navigation

The expanded desktop sidebar contains only:

- workspace identity;
- Quick Open;
- Home;
- Views;
- Browse;
- Health;
- a manual `Collapse sidebar` control.

It must not permanently enumerate every taxonomy term, every page, user account details, or example-domain objects.

### Collapsed Desktop Navigation

The user can manually collapse the sidebar into a narrow icon rail.

- The rail preserves Home, Views, Browse, Health, and Quick Open.
- Every icon-only control has an accessible name and a visible tooltip.
- The active route remains identifiable without relying on color alone.
- The main content area expands into the released width.
- The preference may persist in browser-local presentation state, but it must not become business state or a global application store.
- Initial rendering must avoid a visible expanded-to-collapsed layout flash.

This requirement intentionally supersedes the earlier foundation plan's decision not to restore sidebar collapse. It is now an accepted product behavior, not a compatibility feature retained for parity.

### Mobile Navigation

Mobile does not use the collapsible desktop rail. It uses a native modal dialog styled with DaisyUI.

- Opening moves focus into the dialog.
- Escape and backdrop activation close it.
- Closing without navigation returns focus to the trigger.
- Activating either a current-route or different-route navigation link closes it.
- Enter follows the native link activation contract; Space remains reserved for button-like controls.
- Programmatic navigation and browser history traversal cannot leave the dialog open over the destination.

## Page Layout Modes

The WebApp must not force every route through one permanent three-column shell. Each user task gets an explicit layout mode.

### Home

Home uses the expanded or collapsed navigation plus one content surface. Its hierarchy is:

1. workspace title and concise read-only description;
2. configured View entry rows;
3. a short recently updated list;
4. an actionable health block only when findings require attention.

Home does not show generic page, View, taxonomy, or finding totals merely to fill space. It does not repeat the same destinations through a sidebar tree, entry-point cards, and a full content list.

### Browse

Browse is the long-tail navigation surface for configured taxonomies, terms, and entries.

- The first level lists configured taxonomies.
- A taxonomy route lists its configured terms.
- A term route lists matching entries.
- The surface does not assume that the primary taxonomy is named `Spaces`.
- Lists and tables use row grouping and dividers before Card layouts.

### Reader

Reader gives the Markdown document the primary visual role.

- The page title and summary appear once.
- Metadata is compact and subordinate to the document.
- The body uses a comfortable reading width and line length.
- Outline and Context are closed by default and open on demand.
- References, backlinks, diagnostics, and source metadata do not permanently compete with the body for horizontal space.
- `View source` or an equivalent source-path action is discoverable but visually secondary.

### Projection

Projection routes give the configured View the largest possible content area.

- A compact header contains breadcrumb context, View title, renderer kind, item count when useful, `View source`, and `View details`.
- There is no duplicate title Card or `Projection preview` heading.
- Context is an on-demand Drawer or disclosure, not a permanent right sidebar.
- Table, Kanban, and Graph own their local overflow and resize behavior.

### Health

Health is an independent diagnostic route.

- Findings are grouped by severity and actionable category.
- Every finding includes a text label, explanation, and affected source when available.
- Healthy state is compact and does not occupy a permanent panel on other routes.
- The surface remains read-only until reviewable change operations are separately designed.

## Visual Rules

- Use spacing, alignment, typography, and lightweight dividers before tinted surfaces, borders, or elevation.
- Prefer rows for navigation and content lists.
- Do not nest Cards.
- Do not repeat the same title, summary, status, or count in a header, summary Card, and content section.
- Do not add statistics, badges, toolbar actions, empty panels, or placeholder functions to make a page appear complete.
- Use DaisyUI semantic theme roles and the existing `choral-light` and `choral-dark` themes.
- Use no more than one dominant action on a page; a read-only page may have none.
- Keep Graph classification colors data-driven. Do not replace configured category identity with generic success, warning, or error colors.
- Keep source paths and technical metadata available without making them the primary reading hierarchy.

## Configuration And Data Fidelity

The WebApp consumes shared Forma operations through its package-local workspace client. It must not rescan Markdown or reproduce Core semantics in React.

### Taxonomies And Routes

- Do not hard-code `Spaces`, `Tasks`, `Members`, `Projects`, `Status`, `Priority`, or other example-domain concepts as WebApp structure.
- A configured taxonomy may happen to be titled `Spaces`; that does not make it a reserved product concept in the navigation layer.
- Configured classification routes use `/:taxonomyId` and `/:taxonomyId/:termId`.
- Product routes such as `/pages`, `/views`, `/health`, and `/taxonomies` retain static-route precedence and remain reserved roots.

### Table

- Columns, labels, order, and values come from the rendered View projection.
- The WebApp does not add fixed example columns.
- Missing values use one consistent empty-value presentation.
- A wide Table scrolls inside its own container without widening the page root.
- Responsive degradation must not silently remove configured columns.

### Kanban

- Column count and order are arbitrary and configuration-driven.
- All columns remain on one horizontal row.
- The board owns horizontal overflow regardless of configured column count.
- Card membership, fields, icons, and order come from the rendered projection.
- Cards show only configured or renderer-required information and do not infer business fields.

### Graph

- The WebApp uses the shared Graph renderer and backend-provided projection.
- Graph layout, selection, focus, label policy, and category identity remain aligned with the shared implementation.
- Sidebar collapse, route resize, and theme changes trigger correct canvas resize without duplicate initialization.
- The renderer must not show a blank or clipped canvas after navigation.

### View Source

A View remains an ordinary Markdown document. Every View projection provides a clear path back to its source without making the preview the source of truth.

## Interaction And State Ownership

Choose state ownership in this order:

1. native element state;
2. feature-local imperative DOM coordination;
3. feature-local React state;
4. cross-feature React state only for genuine shared product data or coordination.

Use native `<dialog>`, `<details>`, `<select>`, links, buttons, radios, and checkboxes when their browser behavior meets the requirement.

Do not introduce a generic controlled-state layer for Drawer, Modal, disclosure, sidebar, tabs, or selection behavior. A Headless dependency requires a documented browser-validated interaction or accessibility gap that native HTML, DaisyUI, and small feature-local code cannot safely address.

### Quick Open

Quick Open uses a DaisyUI Modal backed by a native dialog.

- The dialog owns open and closed state.
- Feature-local React state may own query, ranked results, and active keyboard selection.
- `Ctrl/Cmd+K` opens exactly one dialog and focuses the search input.
- Filtering, empty state, Arrow keys, Home/End, Enter, pointer activation, Escape, backdrop dismissal, and repeat opening work consistently.
- Selecting a result causes exactly one SPA navigation and closes the dialog immediately.
- Results come from the active workspace read model and do not hard-code example classifications.
- Portal placement prevents enclosing navigation or menu styles from affecting Modal geometry.

## Code Organization

The WebApp stays page-first and low-ceremony.

- Route entry files use page names and remain thin.
- Use `.lazy.tsx` only as the lazy-loading marker.
- Keep tightly related helpers together when splitting them would create more navigation cost than clarity.
- Keep stable capability boundaries such as Markdown rendering, Graph projection, RPC access, and domain data mapping.
- Prefer direct Tailwind CSS and DaisyUI classes at page or domain call sites.
- Limited duplication is acceptable during the complete implementation.
- Do not add generic `Button`, `Card`, `Modal`, `Drawer`, `Dropdown`, or `Tabs` wrappers.
- Do not recreate `components/ui`, CVA recipes, generic class recipes, or a stylesheet component layer.
- Do not use global `overflow-x-hidden` to conceal a layout defect.

Reusable extraction happens only after every target page passes automated and browser validation. Extraction remains optional and requires multiple stable call sites with the same semantics or behavior.

## Delivery And Validation Protocol

Use the approved isolated worktree. Deliver one observable vertical slice at a time:

1. Record the existing route state and relevant regression risk.
2. Implement one complete page or interaction slice.
3. Run the focused type-check, lint, and tests for that slice.
4. Serve `examples/software-product-rd-workspace/` through the real backend.
5. Use IAB for visual and interaction review.
6. Check the relevant DOM state, console output, and viewport geometry.
7. Fix visible and behavioral problems, then repeat the review.
8. Commit or proceed only after the slice passes its acceptance criteria.

IAB is the required first browser surface for this rewrite. If IAB is unavailable, use `agent-browser` or `playwright-cli`. Do not use Computer Use. Screenshots are presentation evidence only; claims about behavior, data, tests, or build state also require DOM, logs, Forma output, automated checks, or another direct signal.

`agent-browser` may supplement IAB when the acceptance check requires an explicit browser media preference, such as deterministic `prefers-color-scheme: light` and `prefers-color-scheme: dark` validation that IAB cannot currently emulate. This exception does not replace the IAB-first visual review of the page and interaction slices.

## Browser And Responsive Matrix

Validate representative Home, Browse, Reader, List, Table, Kanban, Graph, Health, Quick Open, and navigation states at:

- 1440 px;
- 1024 px;
- 768 px;
- 390 px.

Required cross-cutting checks:

- `choral-light` and `choral-dark` under matching system preferences;
- visible focus indicators and logical Tab order;
- sidebar expanded, collapsed, persisted, and route-transition states;
- mobile Drawer open, close, overlay, Escape, focus containment, focus return, and SPA dismissal;
- Quick Open open, filter, empty, select, close, repeat-open, and SPA dismissal states;
- long titles, long paths, wide tables, code blocks, Markdown, Kanban, and Graph geometry;
- loading, empty, warning, failure, disconnected RPC, and healthy states relevant to the route;
- reduced-motion behavior;
- non-color status and diagnostic meaning;
- no new browser console errors or warnings.

The page root must satisfy `scrollWidth === clientWidth`. A Table, Kanban, code block, or Graph viewport may scroll locally when its content requires it, but local overflow must not propagate to the page root.

When a slice changes native dialog or disclosure behavior, include a focused non-Chromium smoke check before declaring the primitive sufficient.

## Page Acceptance Matrix

### Home Acceptance

- The expanded sidebar contains only the approved navigation set.
- Configured Views are the first content section.
- Recently updated content is short and scannable.
- Health appears only when a finding requires attention.
- Generic totals and repeated destination groups are absent.
- Empty configured Views or recent content produce a concise truthful state.

### Browse Acceptance

- Taxonomies and terms come from current configuration.
- No taxonomy title is treated as a built-in domain assumption.
- Direct taxonomy and term routes resolve without redirect-only indirection.
- Long taxonomy titles and large term sets remain usable at every target width.
- Selecting a result reaches the correct entry or View exactly once.

### Reader Acceptance

- Title and summary appear once.
- The Markdown body is the primary visual surface.
- Metadata remains compact.
- Outline and Context are closed by default and reachable by keyboard.
- References, backlinks, diagnostics, and source path are available without a permanent right panel.
- Long-form Markdown, headings, code, tables, links, Mermaid, and theme styles remain readable.

### List Acceptance

- Item order and labels match the projection.
- Every navigable item is a semantic link.
- Empty state and diagnostics are explicit.
- The renderer does not invent grouping or metadata.

### Table Acceptance

- Visible columns exactly match configured projection columns and order.
- Empty cells are consistent.
- Wide content scrolls only inside the Table container.
- No configured column disappears merely because the viewport is narrow.

### Kanban Acceptance

- Arbitrary configured columns remain on one row and in configured order.
- Cards remain within their configured columns.
- The board, not the page, owns horizontal scrolling.
- Card fields and icons match the projection.
- Sidebar collapse expands board space without changing board membership or column geometry incorrectly.

### Graph Acceptance

- Shared projection nodes and edges render successfully.
- Selection and focus behavior remain usable in both themes.
- Sidebar collapse and route resize update the canvas dimensions.
- No blank canvas, clipped labels, duplicate renderer, or new console warning appears.

### Health Acceptance

- Severity and category have text labels.
- Findings link to affected content when a route exists.
- Healthy state is brief.
- The route never implies that a repair was applied.

### Quick Open Acceptance

- One shortcut opens one dialog.
- The search input receives focus.
- Filtering, keyboard selection, pointer selection, empty state, and repeat opening work.
- Selecting a result performs one navigation and closes the dialog.
- Current configuration drives route, taxonomy, term, page, and View results.

## Accessibility Acceptance

- Every interactive element uses an appropriate native semantic element.
- Icon-only controls have accessible names.
- Focus indicators remain visible in both themes.
- Tab order follows the visual and task order.
- Modal focus containment, Escape dismissal, and focus return work.
- State, severity, priority, and selection do not rely on color alone.
- Text and controls remain readable at zoom and narrow widths.
- Reduced motion does not remove essential state feedback.

Screenshots alone cannot prove full accessibility. Keyboard interaction, focus behavior, semantic DOM, accessible names, and supported assistive-technology behavior require direct browser checks.

## Automated Gates

Run at least these checks for each implementation slice:

```sh
pnpm --dir packages/webapp run check
pnpm --dir packages/webapp run lint
pnpm exec vitest run packages/webapp/src
```

After a complete page group:

```sh
pnpm --dir packages/webapp run build
mise run check:pnpm
```

Before final completion:

```sh
mise run check
git diff --check
```

Tests should cover data mapping, route resolution, filtering, state transitions, and confirmed regressions. Do not test DaisyUI class strings or replace behavior assertions with broad snapshot tests. When browser review discovers a reproducible defect, add a focused regression test when the behavior can be exercised below the visual layer.

## Stop Conditions

Stop and reassess the affected slice when:

- implementation requires a new Core, RPC, schema, or workspace contract;
- UI code begins inferring a domain concept not present in configuration;
- root overflow is being hidden instead of corrected;
- a native interaction fails keyboard, focus, dismissal, or supported-browser expectations;
- React is being added only to mirror browser-owned open state;
- a generic component or styling abstraction is proposed before complete validation;
- unrelated dirty work cannot be isolated;
- the implementation diverges materially from this accepted design without recording a new decision.

## Definition Of Done

The rewrite is complete only when:

- the WebApp remains a read-only review and knowledge-reading surface;
- the implemented hierarchy matches the approved design direction;
- sidebar expanded, collapsed, mobile, persisted, and navigation states pass;
- Home, Browse, Reader, Health, Quick Open, List, Table, Kanban, and Graph pass their acceptance criteria;
- taxonomy, Table, Kanban, and Graph behavior remains configuration-driven;
- light and dark themes pass the viewport matrix;
- the page root has no unintended horizontal overflow;
- browser console output is clean;
- required automated checks pass;
- no new generic UI abstraction or Headless dependency was introduced without an approved evidence-backed exception;
- the final abstraction review records what was extracted or why no extraction was justified;
- product, design, architecture, code, and validation evidence agree;
- commits remain reviewable by page or capability boundary.
