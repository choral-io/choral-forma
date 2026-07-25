---
scope: project
type: ui-spec
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - webapp
    - gui
    - dashboard
    - design-system
sources:
    - "decisions/webapp-primary-gui-client"
    - "planning/webapp-primary-gui-roadmap"
    - "planning/daisyui-webapp-foundation-rewrite-plan"
    - "tasks/implement-webapp-v2-dashboard-shell"
---

# WebApp V2 Dashboard Design

> This design has been superseded by [[design/webapp-review-surface-design]]. It remains as historical context for the earlier Notion-style dashboard direction and must not be used as the current rewrite acceptance specification.

## Purpose

Define the WebApp V2 product surface before replacing the current P0 validation shell. V2 should feel like a Notion-style knowledge dashboard for a local repository workspace, while keeping repository Markdown and shared Forma operations as the source of truth.

The implemented dashboard keeps a package-local data adapter boundary and reads real Forma RPC data. Visual and interaction changes must preserve that boundary instead of introducing a product-side content store or mock-only architecture.

The WebApp is a lightweight standalone knowledge interface for browsing and understanding repository-backed knowledge when editor integration is unavailable or not in use. It is not the primary editing surface and should not become an embedded Agent UI. Editor extensions and external Agent frameworks remain the preferred surfaces for editing and Agent-assisted workflows after those integrations exist.

## Design Direction

The WebApp should prioritize a calm, readable, document-centered dashboard rather than an IDE clone. It should make the workspace feel inspectable at a glance and let users move quickly between spaces, documents, views, diagnostics, references, and future lightweight guided actions.

The primary mental model is:

```text
workspace dashboard -> space or view -> document/resource detail
                     -> diagnostics/health
```

The WebApp remains read-oriented. UI interactions that imply repository changes may create proposed operations, dry-runs, or reviewable change previews, but they must not silently mutate repository files.

## Scope Layers

V2 should be planned in three layers. The product should complete the read-only layer first, while preserving the visible shape of lightweight interactions that will be implemented later.

### L0 Read-Only Core

The first complete product loop is a read-only knowledge browser:

- workspace dashboard overview;
- spaces index;
- space detail;
- documents index;
- document detail or preview;
- views index;
- saved view detail;
- workspace health and diagnostics;
- search results;
- source file references;
- route-aware breadcrumbs and metadata;
- empty, loading, and error states.

### L1 Lightweight Interaction Placeholders

Lightweight interaction affordances may appear during read-only implementation when they clarify the final product shape, but they should stay read-only-safe until backed by shared operations:

- quick open;
- search input and command entry;
- filter, sort, and view switch controls;
- expand and collapse sections;
- copy path and copy link;
- open source file or reveal in workspace;
- context panel actions.

These controls should either operate only on local UI state, open read-only inspection surfaces, or clearly communicate that the operation is not available yet.

Quick Open deliberately uses a smaller native-dialog contract: opening focuses the search field; text filters semantic links; Tab follows the normal focus order; Enter submits the first visible result; pointer activation opens a result; and Escape closes the dialog. It does not maintain a custom active index, arrow-key loop, `aria-activedescendant`, or result-specific Tab suppression.

### L2 Deferred Interactive Functions

The following work is deferred until the read-only browser is complete:

- proposal drafting;
- proposal review workflow;
- drag-and-drop board interactions;
- saved view customization;
- batch actions;
- AI-assisted explanation or drafting;
- any write-adjacent operation;
- editor or IDE integration handoff.

The current V2 shell should not include AI Chat. Chat can be reconsidered later as an optional shell-level surface after read-only browsing and lightweight interactions are stable.

Short-term scope also excludes ACP or similar Agent-client integrations. The WebApp should first stabilize knowledge organization, reading, searching, diagnostics, and lightweight local interactions. Future VS Code or Zed extensions can provide a more seamless bridge from knowledge context into the Agent capabilities already present in those editors.

## Primary Screens

### Workspace Home

The first screen should show the current workspace as a dashboard:

- workspace identity, status, and local service state;
- health summary and recent diagnostics;
- spaces with entry counts and representative metadata;
- pinned or recent documents;
- available views, including table, kanban, graph-ready, and future custom views;
- quick actions that lead to read-only inspection rather than direct writes.

This screen replaces the P0 validation overview as the user-facing entry point.

### Space Browser

Spaces should be shown as structured knowledge partitions, not raw folders. A space page should include:

- title, include pattern, entry count, and health state;
- table/list view of entries;
- filters and sorting only when backed by shared operation data;
- entry cards or rows with title, summary, key fields, and path;
- links to relevant generated views.

### Document Detail

Document detail should keep reading at the center:

- rendered Markdown as the default view;
- source preview as a deliberate secondary view;
- metadata summary, including the canonical page language and available language variants when the read model exposes them;
- backlinks and outgoing references;
- diagnostics attached to the document;
- resource preview for supported media files.

The document surface should not become a Markdown editor.

The right-side document panel should be route context, not a second body column. For document routes it uses a compact tabbed structure:

- `Context`: overview fields including supported languages, explicit references, backlinks, and diagnostics;
- `Outline`: the current document title plus heading navigation.

On smaller screens the context panel becomes an inline native disclosure below the route header. On larger screens it remains docked and scrolls independently from the document body. Context and Outline use radio-backed DaisyUI tabs whose selection is local browser form state; it is not mirrored into global React shell state.

The rendered Markdown body should be generated by a WebApp-local reader renderer from backend-provided Markdown source and analysis data. The backend should provide frontmatter splitting, heading outline, explicit references, backlinks, and diagnostics; the WebApp should own HTML generation, sanitization, Mermaid/code/math reader plugins, and theme-aware presentation.

The renderer should keep persisted content ordinary Markdown and should not introduce product-specific inline syntax from Choral Flows. It may borrow the Choral Flows implementation shape: a `marked` pipeline with explicit plugins and DOMPurify sanitization. The reader surface should be styled through a semantic container in WebApp CSS, similar to `tailwindcss-typography`, rather than route-local arbitrary selector chains.

For Mermaid, Forma owns the browser Worker adapter, syntax and resource budgets, timeout and cancellation, CSP boundary, and SVG sanitization. After the reusable adapter is complete and evidenced, open a Beautiful Mermaid design issue proposing an optional Worker-safe entry or stable renderer core without changing its default synchronous API, then pursue an upstream PR only if maintainers accept that boundary. Beautiful Mermaid is MIT licensed, so a fork is legally feasible when copyright and license notices are retained, but it is a last contingency if upstream declines or its API direction materially diverges because Forma would inherit the ongoing maintenance, security, and update burden. Product safeguards remain consumer-owned in every path.

Dependency upgrades should keep a normal semver-compatible manifest range and rely on the committed lockfile for reproducible installs. Every resolved Beautiful Mermaid upgrade must pass the fast real-browser Worker gate for module loading, an admitted canonical render, abort-and-recreate behavior, the SVG sanitization path, and continued main-thread scheduling; this gate supplements rather than replaces the full syntax, security, accessibility, and browser validation suite.

Reader diagrams use the framework-independent `SvgDiagramZoomController`: the default and Reset fit a complete overview to the reader container, while bounded zoom is 100–300% of that overview. It handles focused keyboard panning, drag panning, touch pinch, and browser touchpad-pinch (`Ctrl`-wheel); ordinary wheel and one-finger vertical reading scroll remain browser-owned. The React reader keeps an always-visible, clearly labeled `Expand diagram` control and a compact contextual zoom menu; the Mermaid-local app-owned dialog provides detailed inspection, focus restoration, Escape close, and the same source disclosure. This intentionally remains Mermaid-local rather than creating a generic overlay prematurely: a future Graph or other consumer can extract a small shell once a second natural call site establishes the shared API. No third-party pan/zoom dependency is used; the controller is independently tested and its public browser-oriented API is the reuse boundary.

Document relationship surfaces should first expose only relationships that come from explicit Markdown links:

- ordinary Markdown links, wikilinks, URLs, and path links produce outgoing links;
- backlinks are produced by reverse indexing explicit links from other documents.

The current WebApp V2 scope should present only link-derived route-context sections:

- `Outgoing Links`: explicit links from the selected document;
- `Backlinks`: explicit links from other documents to the selected document.

Outgoing links should distinguish the first useful link resolution states without requiring separate groups in the compact context panel:

- `Internal`: links that resolve to indexed workspace documents;
- `External`: absolute URL links that should remain normal links;
- `Unresolved`: workspace-relative paths or wikilinks that do not currently resolve to an indexed document.

Backlinks should remain reverse-indexed explicit links from other documents. When backlink volume grows, the UI may add sorting, truncation, or a full document-links footer, but the V2 context panel should stay compact.

Inline reference markers are intentionally deferred. Future support may allow workspace configuration to assign meaning to leading markers such as `@`, `#`, or `/` inside standard Markdown links. For example, a workspace could interpret `[@Alex Chen](members/alex-chen.md)` as a member inline reference or `[#WebApp](concepts/webapp.md)` as a topic inline reference. This future feature should keep persisted content valid in ordinary Markdown renderers and should not require custom link destinations such as `member:Alex Chen`.

Configured frontmatter relations are intentionally deferred. Future support may come from explicit relation definitions in workspace configuration, but the system should not hard-code business meanings for fields such as `depends_on`, `blockedBy`, or `implements`. Those fields should become relations only when configuration declares the relation id, label, source frontmatter field, target resolver, cardinality, inverse behavior, and view/context visibility. Future Views may use configured relations through templates or query configuration, but relation semantics must remain data/configuration-driven.

### Views

Configured views should render as first-class pages. Product-level view definitions use `view.mode`, while the WebApp read model may expose the same renderer choice as `View.kind`. The stable renderer set should align with the view query model:

- `list`: a lightweight ordered document or entry list;
- `table`: a structured field table;
- `kanban`: grouped cards over configured column queries;
- `graph`: a configured graph renderer over an explicit source/query scope.

`graph` is a normal configured view renderer, not a fixed Obsidian-style global graph page. Diagnostics and health dashboards, search result pages, and future proposal review surfaces should be modeled as separate product surfaces unless they are explicitly backed by a configured view definition.

View rendering must come from shared Forma operations. The WebApp must not re-implement Markdown scanning or query semantics in the browser.

The Graph renderer consumes a read-only projection over backend-provided nodes and explicit configured references. WebApp and editor extensions must use the same implementation from `packages/graph-view` for layout, selection, one-hop emphasis, arrows, node sizing, label policy, and other observable behavior. The WebApp keeps only a thin React adapter for routing, lifecycle, active-Page state, and mapping WebApp theme tokens into shared semantic Graph roles. Labels and focus presentation should remain bounded and theme-aware rather than relying on library defaults that can clash with dark mode.

### Diagnostics And Health

Diagnostics should move from raw lists toward an actionable health dashboard:

- workspace-level health summary;
- grouped findings by severity, path, and category;
- affected document navigation;
- explanation and future proposal actions.

Health data should still be read-only until reviewable operation proposals are designed and implemented.

### Quick Open And Lightweight Search

V2 should keep one primary in-app discovery entry point:

- Quick Open is the default WebApp entry for jumping to known routes, spaces, views, and documents by title or path;
- lightweight search can be folded into Quick Open when it helps navigation;
- deeper full-text search should stay optional and does not need to compete with editor-native search or future editor extensions;
- command palette actions can be added later, after read-only navigation and reading flows are stable.

The route header should not expose a separate Search action unless it has a clearer product role than Quick Open. Initial fake-data UI should avoid implying that production-grade full-text indexing is already part of the WebApp scope.

### Deferred Proposal Surfaces

Proposal review is deferred and should not appear as a primary WebApp V2 route or default context-panel section. Future proposal surfaces may include:

- proposal drawer or page for dry-run output and review;
- explicit transition from a lightweight action to a reviewable operation proposal.

These future surfaces should communicate that changes require review and approval.

## Layout

Use a Notion-like dashboard layout:

- a compact workspace sidebar for spaces, documents, views, diagnostics, and user/workspace identity;
- a route header for breadcrumb or scope label, page title, and route-local controls;
- a main content column optimized for document and dashboard reading;
- optional right-side context panel for metadata, references, diagnostics, or route-specific signals;
- a permanent desktop navigation sidebar;
- native dialogs for mobile navigation, Quick Open, and other focused lightweight workflows.

Avoid dense IDE-style chrome as the default. Advanced panels should appear when they help the current task rather than permanently competing with reading.

## Component Boundaries

The accepted foundation uses semantic HTML, DaisyUI classes, and Tailwind utilities directly in the route or feature that owns the markup. It does not maintain a generic `components/ui` layer, Base UI wrappers, CVA recipes, or shared class recipes. Limited duplication is preferable while the maintenance-mode WebApp remains small.

Existing route and domain components remain appropriate when they express product structure, data loading, focus behavior, Markdown reading, Graph integration, or diagnostics. New reusable presentational components should be considered only after the complete surface passes automated and browser validation, and only when multiple stable call sites share the same semantics.

Expected WebApp V2 product component areas:

- `shell`: app frame, desktop sidebar, mobile navigation dialog, topbar, and command trigger;
- `dashboard`: workspace home, summary cards, activity and health blocks;
- `workspace`: space and view navigation;
- `document`: rendered/source/resource detail and document metadata;
- `references`: backlinks and outgoing reference surfaces;
- `diagnostics`: workspace and document health surfaces;

## Interaction States

Each major surface should define:

- loading state;
- empty state;
- warning and failed diagnostic states;
- disconnected RPC state;
- unavailable operation state;
- keyboard-visible focus state;
- read-only state for write-adjacent actions that are not yet in scope.

These states should be driven through the real workspace-client boundary. Test fixtures may isolate data mapping, but production UI should not depend on a mock-only client.

## Responsive Behavior

Desktop is the primary target for internal testing. The layout should still be usable on smaller screens:

- desktop navigation becomes a native modal dialog on smaller screens;
- right context content becomes an inline details disclosure;
- table-heavy views can degrade to stacked rows;
- command/search remains reachable from the top area.

## Accessibility Notes

Use native browser behavior where it already provides the required semantics: `<dialog>` for modal focus containment and Escape dismissal, `<details>` for disclosure, `<select>` for reading width, radio inputs for tabs, and links for navigation. Feature-local code may coordinate SPA dismissal and destination focus without mirroring open state in React.

Mobile navigation uses a native `dialog.modal-start`, not the DaisyUI checkbox Drawer, because browser validation found the checkbox pattern insufficient for Escape dismissal and modal focus containment. Navigation links close the dialog directly, route changes provide a fallback close path, cancel returns focus to the trigger, and successful navigation focuses the destination heading.

Quick Open handles Escape on its search input explicitly because browsers may otherwise consume the first Escape to clear a non-empty `type="search"` field instead of closing the dialog. Link activation uses the native link keyboard contract: Enter activates links, while Space remains reserved for button-like controls.

## Related Tasks

- [[tasks/implement-webapp-v2-dashboard-shell]]
- [[tasks/expose-read-only-knowledge-health-in-webapp]]
- [[tasks/implement-interactive-graph-view-render]]
- [[tasks/implement-quick-switcher-search]]
- [[tasks/design-reviewable-operation-proposal-flow]]
- [[tasks/design-ai-chat-interaction-model]]
