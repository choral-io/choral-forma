---
scope: project
type: execution-plan
title: DaisyUI WebApp Foundation Rewrite Plan
summary: Replace the maintenance-mode WebApp's shadcn and Base UI foundation with DaisyUI 5 and native browser primitives, reuse the choral-light and choral-dark themes, and deliberately simplify non-core interactions.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - planning
    - webapp
    - ui
    - daisyui
    - tailwindcss
    - maintenance
    - refactor
sources:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/webapp-v2-package-architecture"
    - "design/webapp-v2-dashboard-design"
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "guidelines/dependency-governance"
---

# DaisyUI WebApp Foundation Rewrite Plan

## Objective

Replace the maintenance-mode WebApp's shadcn-style component layer and Base UI primitives with a smaller foundation built on Tailwind CSS 4, DaisyUI 5, semantic HTML, browser-owned interaction state, and lightweight React coordination. The rewrite should preserve the useful workspace-reading flows while choosing simpler interactions where full behavioral parity would add disproportionate cost.

This is not a visual or behavioral replica of the current Dashboard. It is a controlled simplification intended to make theme work, routine UI changes, and future maintenance cheaper while the editor extensions remain Forma's primary product surface.

Expected implementation cost is two to three focused person-days for one engineer, excluding unrelated product changes and any later accessibility-driven Headless component adoption.

## Confirmed Decisions

- Tailwind CSS 4 and DaisyUI 5 become the default WebApp styling and component foundation.
- The first theme baseline copies `choral-light` and `choral-dark` from `choral-flows` without redesigning their color tokens.
- `choral-light` is the default light theme. `choral-dark` uses `prefersdark: true` so the first cut follows the operating-system preference without a custom theme controller.
- Native HTML elements and browser APIs are preferred for interaction: `<dialog>`, `<details>`, `<summary>`, `<select>`, radio inputs, buttons, links, and normal form submission.
- Transient UI state should remain owned by browser and DOM primitives wherever practical. React state is reserved for business data, rendered results, persistence, or genuine cross-component coordination.
- Small, feature-local React code may coordinate focus, filtering, routing, and imperative dismissal after SPA navigation, but it should not mirror native open or closed state by default. A new generic component abstraction is not required merely to hide DaisyUI class names.
- The migration is implementation-first and abstraction-late. Initial route and feature slices should use semantic HTML, browser primitives, DaisyUI classes, and Tailwind utilities directly at their call sites, even when this creates limited temporary duplication.
- Do not introduce reusable presentational components, shared class recipes, or new stylesheet abstractions during the initial migration merely to shorten markup or centralize DaisyUI class names. Consider extraction only after the complete migrated WebApp passes automated and browser validation.
- SPA menu activation must explicitly dismiss its containing transient surface. Native light dismissal is responsible for outside click and Escape; it does not replace closing after an internal route action.
- CSS focus and `:focus-within` may style focus but must not be the source of truth for open or closed state.
- Base UI is removed from the initial target stack. It may be reconsidered in a separate change only when browser validation demonstrates a concrete accessibility or interaction gap that native HTML plus DaisyUI cannot meet safely.
- Non-core behavior may be simplified or removed instead of being recreated for parity.
- Graph classification colors remain data-driven presentation metadata. They are not remapped to DaisyUI theme roles.
- The migration does not broaden WebApp product scope or reverse [[decisions/editor-extension-primary-product-surface]].

## Current Baseline

- `packages/webapp` currently depends on `@base-ui/react`, `class-variance-authority`, `shadcn`, `tailwind-merge`, `tw-animate-css`, and Tailwind CSS 4.
- Direct Base UI imports are concentrated under `packages/webapp/src/components/ui`. Dashboard, workspace, diagnostics, theme, and Quick Open features consume that wrapper layer.
- `App.tsx` currently composes `ThemeProvider`, `TooltipProvider`, and the shadcn-style `SidebarProvider` around the application.
- The current sidebar implementation includes desktop collapse, a rail, mobile Sheet behavior, keyboard state, and persistence that are not required for the maintenance-mode WebApp.
- Quick Open currently carries a custom active-index and keyboard-navigation model beyond the minimum search-and-open flow.
- Reading width and theme selection use dropdown abstractions even though simpler native controls can express the first-cut behavior.
- The existing architecture and design records still describe Tailwind CSS, shadcn, and Base UI. Implementation must update those records when the new foundation is accepted; this plan alone does not silently supersede them.

## Theme Baseline

Use the definitions in `choral-flows/packages/webapp/src/index.css` at Git commit `e3a3ff5ae30c480252ad0c6054e578c05d9e93cf` as the initial source baseline.

The first implementation slice must:

- add the DaisyUI 5 Tailwind plugin with built-in themes disabled;
- add complete custom `choral-light` and `choral-dark` theme definitions;
- preserve their current OKLCH base, primary, secondary, accent, neutral, info, success, warning, and error tokens;
- preserve their selector, field, and box radii, sizing, one-pixel border, zero depth, and zero noise settings;
- keep `choral-light` as `default: true` and `choral-dark` as `prefersdark: true`;
- render the application from `base-100`, `base-200`, `base-300`, and `base-content` instead of maintaining a parallel set of application surface colors;
- exclude DaisyUI's `properties` output initially, matching the source workaround, then verify that the exclusion is still needed against the installed DaisyUI version before treating it as permanent.

The theme copy is a starting point, not an irrevocable design contract. Subsequent tuning should happen in Forma only after route-level light and dark screenshots expose a concrete contrast, hierarchy, or brand problem.

## Target UI Foundation

| Surface | First-cut implementation | Behavior deliberately omitted or simplified |
| --- | --- | --- |
| Application shell | Responsive grid with a directly rendered desktop sidebar and a native mobile `<dialog className="modal modal-start">` | No desktop icon-collapse mode, rail, `Cmd+B`, persisted sidebar state, or mirrored React `open` state |
| Workspace navigation | DaisyUI `menu`; native `<details>` and `<summary>` for nested groups | No generic Collapsible wrapper |
| Mobile navigation | Native modal dialog; menu activation calls `close("navigate")`; route changes provide a fallback close path | DaisyUI checkbox Drawer was rejected after browser validation; no Base UI Sheet implementation |
| Transient action menus | DaisyUI Dropdown using the Popover API; route actions call `hidePopover()` | No CSS-focus Dropdown or manual `.blur()` dismissal |
| Quick Open | DaisyUI `modal` on native `<dialog>` with an input and semantic result buttons/links; the dialog owns its open state | No custom active index, `aria-activedescendant`, arrow-key loop, IME-specific navigation helper, or mirrored React `open` state in the first cut |
| Reading width | Native `<select>` styled with DaisyUI `select` | No dropdown menu abstraction |
| Context and Outline | DaisyUI tabs backed by radio inputs on wide layouts | No Headless tabs dependency |
| Mobile Context | Inline DaisyUI `collapse` or native `<details>` | No right-side Sheet |
| Dashboard summaries | DaisyUI `card`, `stats`, `list`, and responsive `table` patterns | No wrapper component for each presentational primitive |
| Diagnostics | DaisyUI `alert`, `badge`, and `status` | No bespoke status palette |
| Loading | DaisyUI `loading` | No custom skeleton system unless measured loading behavior requires it |
| Tooltips | Omit non-essential tooltips; retain accessible names | No application-wide Tooltip provider |

Quick Open retains opening from the application control, initial focus, text filtering, Tab navigation, Enter or form submission, pointer activation, Escape dismissal, an accessible title, and a clear empty state. Browser validation must confirm focus return and modal dismissal before the old dialog layer is deleted.

## Interaction State Ownership

Use the narrowest state owner that already expresses the interaction:

| Interaction | State owner | Open and close mechanism | SPA activation behavior |
| --- | --- | --- | --- |
| Mobile navigation | Native modal `<dialog>` | A button calls `showModal()`; Escape, method-dialog backdrop, or local code calls `close()` | Every navigation item calls `close("navigate")`; a location-change effect is the fallback for programmatic navigation and history traversal |
| Dropdown | Native Popover API with `popover="auto"` | `popovertarget`, browser light dismissal, and `hidePopover()` | Every navigation or action item calls `hidePopover()`; do not rely on focus moving away |
| Inline disclosure | Native `<details>` and `<summary>` | Browser-owned `open` state | Keep the disclosure open by default; set `details.open = false` only when the product behavior explicitly requires it |
| Modal and Quick Open | Native `<dialog>` | `showModal()`, `close()`, method-dialog controls, and Escape | Close through the dialog API; route-level focus handling owns focus placement after successful navigation |
| Tabs and simple selectors | Native radio, checkbox, or select state | Browser form-control behavior | Preserve state only when it remains meaningful on the destination route |

State ownership priority is native element state, native form-control state, imperative DOM dismissal through a local ref, then React controlled state. Do not mirror `open`, `checked`, or `details.open` in React merely to add an `onClick` close path.

Controlled React state is justified only when the interaction affects business data or rendered content, must be coordinated across distant components, must be persisted, requires asynchronous confirmation before closing, or cannot meet verified accessibility requirements with a native primitive. Quick Open may keep its query and filtered results in React while the dialog itself owns whether it is open.

Closing a surface and managing navigation focus are separate responsibilities. Escape, overlay, or an explicit cancel action should restore focus to the trigger when it remains relevant. After successful SPA navigation, the route shell should move focus to the destination heading or main content rather than reopening focus on a closed navigation control.

## Implementation Shape And Abstraction Gate

The first implementation should be deliberately flat:

- write semantic HTML and native interaction attributes directly in the route or feature that owns the behavior;
- apply DaisyUI component classes directly to that markup;
- add responsive layout and necessary customization with Tailwind utilities at the same call site;
- tolerate small amounts of repeated markup and class lists while behavior, responsive layout, and theme treatment are still changing;
- keep route and domain components that already express product structure, but do not split out a component solely because a block of JSX or class names appears more than once during migration;
- do not add generic components such as local `Button`, `Card`, `Drawer`, `Dropdown`, `Modal`, or `Tabs` wrappers merely to rename DaisyUI primitives;
- do not add CVA recipes, shared class constants, a replacement `components/ui` directory, or `@layer components` rules merely to make the first-cut markup look cleaner;
- keep custom CSS limited to the documented Markdown Reader, syntax rendering, Graph-host, and otherwise unsupported layout exceptions.

Abstraction review happens only after the complete migrated WebApp passes automated checks and the browser validation matrix. Extraction remains optional and should be proposed as a separate cleanup only when multiple stable call sites share the same semantics or behavior, the abstraction makes the code materially easier to change, and it does not hide native state ownership or recreate a local design system. Validation must pass before extraction, and the same validation must pass again after any accepted extraction.

## Color And Styling Rules

- Use `base-*` colors for most surfaces and typography.
- Prefer DaisyUI's default component treatment before adding a color modifier.
- Use `primary` for at most one dominant action on a page; a page may have no primary-colored action.
- Use `info`, `success`, `warning`, and `error` only for their semantic meanings.
- Do not add `dark:` variants for DaisyUI semantic colors; the active custom theme owns light and dark values.
- Keep fixed taxonomy and Graph classification colors when they encode workspace data, but derive surrounding surfaces, labels, borders, and focus indicators from the active theme.
- Restrict custom CSS to Markdown Reader typography, syntax rendering, Graph-host integration, and layout behavior with no appropriate DaisyUI component.
- Avoid recreating a local design-token system on top of DaisyUI variables.

## Delivery Sequence

### Phase 0: Isolate The Migration And Freeze Evidence

- Start from a clean, dedicated branch or worktree so the migration does not absorb unrelated editor-extension work.
- Record current WebApp dependency, build, type-check, lint, test, and representative route baselines.
- Capture light and dark screenshots at desktop, tablet, and mobile widths for comparison, without making pixel parity an acceptance criterion.
- Inventory every import from `components/ui` and classify it as a DaisyUI replacement, native element, local feature interaction, or deletion.
- Inventory every controlled `open` or `checked` state and classify it as business state, rendered-content state, cross-component coordination, persistence, or removable DOM-state mirroring.
- Record existing route and domain component boundaries that should remain, while rejecting any proposed generic replacement wrapper or shared style recipe until the post-validation abstraction review.
- Confirm that no shared package or editor extension imports the WebApp-only UI layer.

Exit criteria:

- The migration diff is isolated from unrelated work.
- Every current UI wrapper has an explicit exit path.
- Existing failures, if any, are recorded before implementation begins.

### Phase 1: Install DaisyUI And Establish Themes

- Add DaisyUI 5 as a project dependency appropriate to the Tailwind plugin build path.
- Copy the verified `choral-light` and `choral-dark` definitions into the WebApp stylesheet.
- Change the root application surface and common text, border, hover, and focus colors to DaisyUI semantic tokens.
- Remove the manual theme menu and custom Theme context from the first-cut application shell.
- Preserve System theme behavior through the custom theme definitions and verify it in both system modes.

Exit criteria:

- A minimal route renders in both copied themes without the current Theme provider.
- Theme changes do not require React state or reload the route.
- Text, focus indicators, controls, and semantic statuses remain readable in both themes.

### Phase 2: Replace The Application Shell And Navigation

- Render desktop navigation as a permanently visible sidebar in the responsive application grid.
- Start by evaluating DaisyUI's uncontrolled Drawer, then use the documented native dialog fallback if keyboard or modal behavior fails browser validation.
- Convert workspace navigation to `menu` markup and nested native disclosure elements.
- Close mobile navigation directly from every SPA navigation and action item through the owning native state primitive.
- Add location-change dismissal only as a fallback for programmatic navigation and browser history traversal; do not make router location a second source of open state.
- Retain route selection, workspace identity, diagnostics entry points, and accessible navigation labels.
- Remove desktop sidebar collapse state, keyboard shortcut, persistence, resize rail, and Tooltip provider.

Exit criteria:

- Current routes remain reachable by keyboard and pointer.
- Mobile navigation opens and closes without React mirroring dialog state.
- Activating a navigation item closes it even when the item targets the current route; programmatic navigation and browser history traversal do not leave it open.
- Canceling mobile navigation restores focus when appropriate, and successful navigation follows route-level focus placement without trapping page scrolling.
- Desktop and tablet layouts do not overflow horizontally.

### Phase 3: Replace Feature Interactions

- Rebuild Quick Open with native `<dialog className="modal">` behavior and feature-local React filtering. Keep search and results in React only when needed; use the dialog as the source of open state.
- Replace any retained transient action menu with the Popover API and explicit `hidePopover()` calls from its SPA navigation and action items.
- Replace reading-width dropdown items with a labeled native select.
- Replace Context and Outline tabs with DaisyUI radio tabs or an equally small semantic implementation.
- Replace the mobile context Sheet with inline collapse or details markup.
- Remove decorative tooltip dependencies; give icon-only controls explicit accessible names.

Exit criteria:

- Quick Open passes the retained interaction contract and focus checks.
- Context, Outline, and reading-width settings work without Base UI.
- Mobile navigation, Popover, details, and dialog interactions use their native or DOM state without default React-controlled `open` mirrors.
- No Dropdown uses CSS focus or manual `.blur()` as its dismissal mechanism.
- No new global provider or generic Headless wrapper is introduced.

Fallback:

- If DaisyUI drawer behavior cannot satisfy mobile background, focus, or dismissal requirements during browser validation, replace only the mobile shell with a native `<dialog className="modal modal-start">` implementation.
- If a native primitive still has a documented accessibility gap after that experiment, stop that slice and record the exact failing scenario before proposing Base UI, Headless UI, or another Headless dependency.

### Phase 4: Convert Presentational Components

- Convert dashboard cards, stats, lists, tables, buttons, badges, alerts, inputs, separators, breadcrumbs, avatars, loading indicators, and empty states directly to DaisyUI classes and semantic HTML.
- Keep those classes and the associated semantic markup directly in their owning route or feature for the initial implementation; limited duplication is acceptable until full validation is complete.
- Apply the color and styling rules consistently across workspace overview, content routes, diagnostics, Markdown Reader, and Graph host surfaces.
- Keep route and domain components named after product concepts; do not replace the old generic UI directory with a new one-to-one DaisyUI wrapper directory.
- Retain existing small React components when they already encode Forma behavior, accessibility behavior, or domain composition. Defer new reuse-oriented extraction until the post-validation abstraction review.

Exit criteria:

- Business components no longer import the old shadcn-style UI layer.
- Both themes produce a coherent hierarchy without page-specific token overrides.
- Markdown and Graph exceptions are documented beside their CSS.

### Phase 5: Delete The Old Foundation

- Delete unused files under `packages/webapp/src/components/ui` after their consumers reach zero.
- Remove `@base-ui/react`, `class-variance-authority`, `shadcn`, and `tw-animate-css` when repository-wide searches confirm they have no remaining consumer.
- Remove `components.json`, obsolete animation imports, Theme provider/context files, and UI utility code only when their references reach zero.
- Re-evaluate `clsx` and `tailwind-merge` independently; retain either only when remaining feature code has a demonstrated use.
- Regenerate the lockfile through pnpm and verify there are no accidental unrelated dependency changes.

Exit criteria:

- Repository-wide searches find no Base UI or shadcn runtime/configuration references in the WebApp implementation.
- The WebApp dependency graph contains DaisyUI but not the removed foundation packages.
- No deleted abstraction is retained as a compatibility shell.

### Phase 6: Validate, Document, And Close

- Run automated checks and the browser validation matrix below.
- Update [[architecture/webapp-v2-package-architecture]] and [[design/webapp-v2-dashboard-design]] to describe the accepted foundation and intentional simplifications.
- Update dependency-governance evidence with the retained and removed packages, including the reason for any Headless exception.
- Record before-and-after dependency count, relevant source deletion, WebApp bundle output, and screenshots as completion evidence.
- After all validation passes, audit repeated markup, behavior, and class lists and record whether any extraction is justified. Treat "no extraction needed" as a valid result; do not block completion on creating reusable UI abstractions.
- Create follow-up work only for evidenced defects or intentionally deferred product behavior; do not restore parity by default.

Exit criteria:

- Accepted architecture, implementation, dependency manifests, and validation evidence agree.
- Any remaining Headless dependency has a concrete, documented consumer and browser-validation rationale.
- The initial implementation remains direct and readable, and any proposed reusable extraction is separated from the validated migration baseline.

## Validation Matrix

### Automated Checks

Run the repository's current commands rather than copying stale tool versions into implementation notes:

```sh
pnpm --dir packages/webapp run check
pnpm --dir packages/webapp run lint
pnpm --dir packages/webapp run build
pnpm exec vitest run packages/webapp/src
mise run check:pnpm
```

If the package does not yet have matching unit tests, add focused tests only for retained stateful behavior such as Quick Open filtering and route selection. Do not create snapshot tests for DaisyUI class strings.

### Browser Validation

Validate representative dashboard, content, diagnostics, Markdown Reader, and Graph routes at approximately 1440 px, 1024 px, and 390 px widths.

For each relevant route, verify:

- `choral-light` and `choral-dark` under matching system preferences;
- visible focus indicators and logical Tab order;
- desktop navigation visibility and mobile drawer open, close, overlay, Escape, and focus return;
- mobile navigation and Dropdown dismissal after pointer or Enter activation of current-route and different-route SPA links; Space applies only to button-like controls, not native links;
- dismissal of persistent-shell surfaces after programmatic navigation and browser history traversal;
- Popover outside-click and Escape dismissal without `.blur()` helpers;
- Quick Open focus, filtering, Tab, Enter, pointer selection, Escape, empty state, and repeat opening;
- Context and Outline switching plus mobile disclosure behavior;
- reading-width selection and persistence behavior that remains intentionally supported;
- long titles, long paths, tables, code blocks, Markdown, and Graph canvases without unintended page overflow;
- diagnostic and loading states without color-only meaning;
- reduced-motion and high-contrast behavior where supported by the target browser.

Test current Chromium and one non-Chromium engine before declaring native dialog and disclosure behavior sufficient.

## Implementation Result

The rewrite was implemented and validated on 2026-07-22 in the isolated `codex/daisyui-webapp-rewrite` worktree branch.

### Accepted Foundation

- DaisyUI `5.6.18` is the WebApp-local Tailwind plugin.
- `choral-light` is the default theme and `choral-dark` follows `prefers-color-scheme`; the obsolete startup script that wrote `data-theme="system"` was removed because it prevented DaisyUI's `prefersdark` selector from activating.
- Desktop navigation is an ordinary responsive sidebar. The initial checkbox Drawer experiment closed SPA items correctly but failed Escape dismissal and modal focus containment, so the documented native `dialog.modal-start` fallback was adopted for mobile navigation.
- Quick Open uses a native dialog and React state only for its filter query and rendered result set. A local Escape handler closes the dialog from a non-empty search input because the browser otherwise consumes the first Escape to clear `type="search"`.
- Nested navigation uses details/summary, reading width uses a native select, Context/Outline uses radio-backed DaisyUI tabs, and mobile context uses an inline details disclosure.
- No Dropdown or Popover interaction remained necessary in the accepted first cut.
- No Headless component dependency remains.

### Dependency And Source Evidence

- Direct WebApp dependencies decreased from 30 to 27: `@base-ui/react`, `class-variance-authority`, `shadcn`, and `tw-animate-css` were removed; DaisyUI was added as a development dependency.
- `packages/webapp/src/components/ui`, `components.json`, Theme provider/context, the theme menu, responsive sidebar hooks, controlled context-panel state, and the old Quick Open keyboard model were deleted instead of retained as compatibility shells.
- `clsx` and `tailwind-merge` remain because `cn` still has feature-level consumers.
- DaisyUI's excluded `properties` output was inspected in the installed version. It contains only `@property` declarations for unused `radialprogress` and `aura` components, so exclusion remains a small output-minimization choice rather than a required browser workaround and should not be treated as permanent policy.
- Browser validation exposed that the RPC contract can omit an empty `ViewRenderDocument.mounts` array. The shared TypeScript type and WebApp mapper now accept the serialized form, with a focused regression test.

### Bundle Evidence

| Output          |                     Before |                      After |                          Change |
| --------------- | -------------------------: | -------------------------: | ------------------------------: |
| Main CSS        |   98.87 kB / 15.35 kB gzip |   95.69 kB / 15.93 kB gzip |    -3.18 kB raw / +0.58 kB gzip |
| Main JavaScript | 779.77 kB / 242.68 kB gzip | 573.44 kB / 174.87 kB gzip | -206.33 kB raw / -67.81 kB gzip |

The existing Vite warning for chunks above 500 kB remains outside this foundation rewrite; the main JavaScript bundle still decreased materially.

### Validation Evidence

- Package type-check, ESLint, six Vitest files with 16 tests, and production build passed after the final changes.
- Edge validated 1440 px, 1024 px, and 390 px layouts, system light/dark theme switching, reduced motion, Markdown reading width, Context/Outline tabs, mobile disclosure, navigation dismissal and focus, Quick Open filtering and activation, and Graph rendering without horizontal overflow.
- WebKit validated mobile navigation Escape/focus behavior, Quick Open Enter navigation, Graph rendering, and absence of console warnings or errors.
- Edge and WebKit both rendered the native dialogs and Graph route successfully. The final Edge Graph run produced eight Sigma canvas layers and no console warning or error.
- High-contrast mode was not separately automated; semantic controls, accessible names, non-color diagnostic labels, and browser focus behavior remain the baseline mitigation.

### Abstraction Review

No post-validation extraction is justified in this change. The remaining route and feature components express product structure, data mapping, Markdown/Graph integration, or focus behavior. Repeated DaisyUI markup and class lists remain direct at their call sites, and no replacement generic UI directory, CVA recipe, shared class recipe, or stylesheet component abstraction was introduced.

## Scope Guardrails

The migration does not include:

- a new design system package;
- a generic DaisyUI wrapper library;
- reusable presentational components, shared class recipes, or stylesheet component layers introduced before the complete migration passes validation;
- a generic controlled-state layer for native Drawer, Popover, details, dialog, radio, checkbox, or select behavior;
- visual parity with the shadcn implementation;
- new WebApp product workflows;
- restoration of removed sidebar behaviors;
- a bespoke theme editor or persisted manual theme choice in the first cut;
- Graph renderer or Markdown parsing changes unrelated to theme integration;
- changes to editor-extension product priority;
- release or deployment work.

## Stop Conditions

Stop and reassess the affected slice when:

- a native or DaisyUI interaction fails keyboard, focus, dismissal, or screen-reader expectations in the supported browser matrix;
- an implementation needs React to mirror native open state without meeting one of the documented controlled-state exception criteria;
- replacing a component requires a general-purpose interaction framework rather than small feature-local code;
- a new reusable component or style abstraction is being introduced before complete validation without being required for correctness, accessibility, or an existing domain boundary;
- theme integration would require duplicating semantic tokens outside DaisyUI;
- the migration begins changing Core, RPC, workspace schema, or editor-extension contracts;
- unrelated dirty work cannot be isolated safely;
- accepted architecture cannot be updated to match the implemented result.

These conditions do not invalidate the overall migration. They require narrowing the failing slice, documenting evidence, and making a separate dependency decision.

## Suggested Commit Boundaries

1. `refactor: establish daisyui themes for webapp`
2. `refactor: replace webapp shell and navigation`
3. `refactor: simplify webapp interactions`
4. `refactor: convert webapp presentation to daisyui`
5. `refactor: remove shadcn and base ui foundation`
6. `docs: align webapp architecture with daisyui foundation`

Each implementation commit should pass the relevant WebApp checks. The final foundation-removal commit must also pass the repository pnpm check and browser validation matrix.

## Completion Evidence

The migration is complete only when the implementation change records:

- the exact DaisyUI version and copied theme source revision;
- a zero-consumer search for the removed UI wrappers and dependencies;
- passing type-check, lint, build, focused tests, and repository pnpm checks;
- light and dark screenshots across the selected viewport matrix;
- recorded Quick Open, drawer, tabs, select, Markdown Reader, and Graph browser results;
- evidence that current-route links, different-route links, programmatic navigation, and history traversal dismiss persistent Drawer and Dropdown surfaces correctly;
- dependency and bundle comparisons with explanations for material regressions;
- updated architecture and design records;
- evidence that the first validated implementation used direct DaisyUI, Tailwind, and browser primitives without prematurely recreating a generic UI or shared style layer;
- a post-validation abstraction audit result, including a rationale for each accepted extraction or an explicit decision that none is needed;
- a short list of intentionally removed or deferred behaviors so future work does not mistake them for regressions.
