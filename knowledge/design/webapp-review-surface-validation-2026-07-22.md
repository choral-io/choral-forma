---
scope: project
type: technical-assessment
title: WebApp Review Surface Validation — 2026-07-22
summary: Records implementation, browser, theme, configuration-fidelity, and automated-gate evidence for the lightweight WebApp review-surface redesign.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - webapp
    - validation
    - daisyui
    - reader
    - responsive
sources:
    - "design/webapp-review-surface-design"
    - "planning/daisyui-webapp-foundation-rewrite-plan"
---

# WebApp Review Surface Validation — 2026-07-22

## Outcome

The lightweight WebApp review-surface redesign is implemented on `codex/daisyui-webapp-rewrite`. The accepted specification is commit `e3f318d0e757732605e3f0d45617cfda277cde70`; the implementation candidate is commit `4f0520d5c67638bc5a89667d56652dfca347f844`.

The candidate replaces the dashboard-heavy shell with a small read-only review surface: a manually collapsible desktop sidebar, native-dialog mobile navigation, configured Views first on Home, generic taxonomy browsing, document-centered reading, projection-first View pages, an independent Health route, and a native-dialog Quick Open. It preserves the existing Forma RPC and shared Graph boundaries and does not add a frontend content store, Headless dependency, or generic UI abstraction layer.

## Validation Workspace And Browser Surfaces

- Backend workspace: `examples/software-product-rd-workspace/`.
- Preview URL: `http://127.0.0.1:4137/` served through the real Forma backend and the production WebApp build.
- Primary visual and interaction review: IAB.
- Deterministic system color-scheme supplement: `agent-browser` with separate Light and Dark Chromium sessions, explicitly approved for this validation.
- Computer Use was not used.

The example workspace configuration passes with zero errors and warnings. Its workspace health operation passes with zero findings. The repository workspace bootstrap also passes configuration inspection; its workspace health operation reports eight existing `workspaceHealth.noBacklinks` warnings, unrelated to this WebApp candidate.

## Visual And Responsive Review

The selected `Review Desk` reference and implementation were compared together during the IAB review. The implementation retains the reference hierarchy, spacing-led grouping, low visual density, and desktop navigation model while using the accepted collapsed-rail behavior for the compact state.

IAB review covered the shell at 1440, 1024, 768, and 390 px and representative page content at desktop and mobile widths. The reviewed surfaces included Home, Browse, taxonomy, term, Reader, Views index, List, Table, Kanban, Graph, Health, Quick Open, expanded sidebar, collapsed rail, and mobile navigation. No reviewed route produced root-level horizontal overflow.

Observed layout behavior:

- Home leads with configured Views, then a short recent-content list; it does not render generic totals or a permanent health panel.
- Browse renders configured taxonomies, terms, and matching entries as direct row groups without treating `Spaces` as a product built-in.
- Reader gives the rendered Markdown body the primary width and keeps references, outline, diagnostics, and source context in a closed native disclosure.
- Table displays the projection-provided columns and owns its local horizontal overflow on narrow viewports.
- Kanban keeps all six example-configured columns on one horizontal row; the board, not the page root, owns scrolling. The implementation does not assume a six-column contract.
- Graph renders the shared 21-node projection at desktop and mobile sizes without a blank or clipped canvas.
- Quick Open uses a portal-backed DaisyUI Modal and native dialog geometry rather than inheriting sidebar menu styles.

## Theme Validation

`agent-browser` independently confirmed the browser media preference and computed document color scheme:

| Session | `prefers-color-scheme: dark` | Computed `color-scheme` | Root overflow |
| ------- | ---------------------------: | ----------------------- | ------------: |
| Light   |                      `false` | `light`                 |          0 px |
| Dark    |                       `true` | `dark`                  |          0 px |

Visual review covered desktop Home in both themes, mobile Home in Light, desktop Reader in Dark, mobile Kanban in Dark, and mobile Quick Open in Dark. Foreground, background, dividers, active navigation, controls, projection cards, metadata, disclosure, and modal states remained readable and consistent with the `choral-light` and `choral-dark` semantic theme roles. Both browser sessions reported empty page-error and console streams.

## Interaction Evidence

### Desktop Sidebar

- Manual collapse changes the 256 px navigation into the accepted narrow rail.
- The browser-local preference survives route transitions and reload.
- The initial document script applies the stored presentation preference before React renders, avoiding an expanded-to-collapsed flash.
- Icon-only controls retain accessible names, visible tooltips, focus indicators, and a non-color active-route treatment.

### Mobile Navigation

- The native dialog receives focus when opened.
- Escape and backdrop activation close it.
- Current-route and different-route navigation links close it.
- Navigation moves focus to the destination heading; dismissal without navigation returns focus to the trigger.

### Quick Open

- `Cmd/Ctrl+K` and the visible trigger open one native dialog and focus `Search workspace`.
- Query text filters routes, configured Views, taxonomies, terms, and content from the active read model.
- Arrow-key selection and Enter open one result, perform one SPA navigation, and close the dialog.
- Escape closes the dialog and returns focus to `Quick open`.
- The dialog remains correctly sized and readable on the 390 px Dark viewport.

### Native Disclosure

- Reader context is closed by default.
- The native `<details>` element opens and closes without mirrored React state.
- The document heading remains the only exposed H1; the duplicated Markdown source heading is visually suppressed in the rendered body.

## Configuration Fidelity

- Taxonomy routes use `/:taxonomyId` and `/:taxonomyId/:termId` with static product routes retaining precedence.
- `Spaces` appears only because the example workspace configures that taxonomy title.
- Table labels and order match the rendered `Release`, `Status`, `Version`, `Date`, `Tasks`, and `Validation` projection columns.
- Kanban column count, order, card membership, and fields come from the rendered projection.
- View pages expose the source View document path and do not add fixed example columns or business concepts.
- Graph data and classification identity remain owned by the shared Graph renderer and backend projection.

## Automated Gates

The following checks passed against the candidate:

- focused WebApp Vitest: 6 files and 20 tests;
- complete pnpm test gate: 37 files and 209 Vitest tests plus 23 Node tests;
- WebApp and workspace TypeScript checks;
- ESLint and Prettier checks;
- production pnpm builds;
- Rust workspace formatting, checks, and tests;
- Zed WebAssembly check;
- `mise run check`;
- `git diff --check`.

The production build still reports its existing warning for some syntax-highlighting and application chunks larger than 500 kB. The redesign does not introduce a new bundle-size contract or attempt an unrelated code-splitting migration.

## Abstraction Review

No new generic Button, Card, Modal, Drawer, Dropdown, Tabs, CVA recipe, class recipe, stylesheet component layer, or Headless dependency was extracted. Page and domain call sites directly use Tailwind CSS, DaisyUI, and browser primitives.

The implementation retains only already-justified stable capability boundaries: the workspace client, Markdown reader, shared Graph projection, route frame, workspace navigation, and Quick Open feature. The large page-first dashboard module remains intentionally explicit until additional post-validation reuse evidence justifies decomposition. Limited duplication is accepted for this candidate.

## Residual Evidence Boundary

- IAB and `agent-browser` are Chromium-based. A read-only attempt to enumerate an available `agent-browser` iOS/WebKit device did not return a usable device list and was stopped; native dialog and disclosure behavior is therefore not claimed as non-Chromium-smoke-tested in this environment.
- The accepted 1440, 1024, 768, and 390 px shell matrix passed. Representative page types were reviewed at desktop and mobile widths, but this record does not claim that every route was independently screenshotted at every matrix width.
- Loading, disconnected-RPC, and every possible empty/error permutation were not re-created during this visual pass. Existing automated data-state coverage remains the evidence for those paths.

These boundaries do not change the implemented product behavior, but they must remain explicit if a later release cutline requires a literal completion claim for every item in [[design/webapp-review-surface-design]].
