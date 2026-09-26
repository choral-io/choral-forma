---
scope: project
type: engineering-guideline
title: WebApp Engineering And Visual Validation
summary: Practical implementation, debugging, and browser-validation guidance for building Forma WebApp slices with native browser behavior, DaisyUI, direct feature code, and evidence-backed visual review.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - engineering
    - webapp
    - frontend
    - daisyui
    - visual-validation
    - agent-workflow
    - guidelines
    - agents
skill:
    id: webapp-engineering-and-visual-validation
    title: WebApp Engineering And Visual Validation
    description: Build, debug, and visually validate Forma WebApp pages, interactions, responsive layouts, themes, and UI foundations.
    projection: section
    order: 45
sources:
    - "design/webapp-review-surface-design"
    - "design/webapp-review-surface-validation-2026-07-22"
    - "planning/daisyui-webapp-foundation-rewrite-plan"
    - "guidelines/forma-product-model-and-configuration-fidelity"
---

# WebApp Engineering And Visual Validation

## Purpose

Capture reusable engineering practices learned from the WebApp review-surface rewrite. The goal is not to prescribe one component tree. It is to make future implementation slices simpler, easier to inspect, and harder to declare complete without direct evidence.

## Agent Skill

### When To Use

Use this skill when an Agent:

- implements or revises a WebApp page, shell, component, interaction, or responsive layout;
- migrates frontend foundations or evaluates a new UI or Headless dependency;
- diagnoses clipping, overflow, alignment, wrapping, stacking, animation, focus, or dismissal defects;
- validates Light/Dark themes, responsive behavior, SPA navigation, or native browser primitives;
- decides whether repeated UI code is ready to be extracted;
- audits Tailwind classes, CSS ownership, cascade layers, or responsive breakpoint rules, or configures WebApp style tooling.

Read the accepted product or design specification for the affected surface before changing implementation. This guideline does not override route-specific acceptance criteria.

### Execution Sequence

1. Read the affected product, design, route, and configured-data contract.
2. Reproduce the exact behavior and define an observable red condition before editing.
3. Choose the narrowest correct state owner and implementation surface.
4. Implement one complete vertical slice with direct feature code before extracting abstractions.
5. Run focused type, lint, and behavior checks.
6. Build and serve the production WebApp through the real backend, then validate representative data, themes, widths, keyboard behavior, navigation, geometry, and console output.
7. Repeat the same measurement after the final material adjustment and run the required repository gate.
8. Remove temporary instrumentation and report checks, residual risks, and any unverified browser state.

### Reference Routing

Load `forma skills get webapp-engineering-and-visual-validation --full` when the task needs branch-specific detail:

- state, focus, dismissal, or SPA navigation: `State Ownership`;
- DaisyUI structure, dependency choice, or abstraction: `Component And Dependency Selection` and `Implement Before Abstracting`;
- Tailwind classes, CSS definitions, theme tokens, or style-tool configuration: `Tailwind And CSS Ownership` and `Style Tooling And Audit`;
- viewport/container queries, breakpoint state, or responsive sizing: `Responsive Layout Contract`;
- wrapping, clipping, overflow, or stacking: `Layout And Flexbox Heuristics` and `Overflow, Clipping, And Stacking`;
- animation or transient visual defects: `Transition And Animation Heuristics`;
- bug diagnosis or browser evidence: `Debugging Workflow` and `Browser Validation Loop`;
- automated versus browser coverage: `Test Boundaries`;
- suspicious fixes: `Common Failure Patterns` and `Stop And Reassess When`.

### Guardrails

- Consume configured behavior through shared Core projections; do not recreate product semantics in React.
- Prefer native browser state, direct DaisyUI structure, and feature-local code until a tested gap justifies more machinery.
- Do not hide layout defects with fixed dimensions, global clipping, arbitrary stacking values, or screenshot-only validation.
- Validate against representative non-trivial workspace data rather than the repository's shortest fixtures.
- Keep fixed appearance in classes and runtime geometry or validated configuration values in inline styles or CSS variables. Give repeated declarations one clear owner.
- Choose viewport or container responsiveness according to the element's actual available space; verify usable content area as well as absence of overflow.
- A style audit authorizes findings only; guideline edits and implementation cleanup each need their own authorization.

### Completion Criteria

A slice is complete only when the accepted contract is preserved; relevant responsive, theme, keyboard, navigation, transition, overflow, and console states pass; focused and repository gates pass; temporary instrumentation is removed; and remaining limitations are reported.

## Reference

### Core Principles

1. Start from the user task and configured data contract, not component parity with an older implementation.
2. Prefer browser-native semantics and state before adding React-controlled state.
3. Prefer direct Tailwind CSS and DaisyUI markup at the feature call site before creating reusable UI abstractions.
4. Validate the actual page through the real backend and representative workspace data.
5. Treat screenshots as visual evidence, not proof of behavior, data correctness, accessibility, or build health.
6. Fix the layout or interaction cause instead of hiding the symptom with fixed dimensions, global clipping, or arbitrary stacking values.

### State Ownership

Choose state ownership in this order:

1. native element state;
2. feature-local imperative DOM coordination;
3. feature-local React state;
4. cross-feature React state only for genuinely shared product data or coordination.

Use native links, buttons, checkboxes, radios, `<details>`, `<dialog>`, and `<select>` when their behavior satisfies the accepted browser and accessibility contract.

Do not mirror native open or closed state in React by default. React state remains appropriate for application data such as a query, filtered results, active keyboard selection, or data loading.

For persistent-shell interactions in an SPA, validate all dismissal paths:

- current-route activation;
- different-route activation;
- pointer and keyboard activation;
- programmatic navigation;
- browser history traversal;
- Escape, backdrop, outside activation, and explicit close where applicable.

### Component And Dependency Selection

- Use DaisyUI components as structural contracts, including their required parent, child, state, and overflow relationships.
- Prefer the default DaisyUI size and semantic theme roles unless the accepted design requires another variant.
- Add Tailwind utilities for local layout adjustments that DaisyUI does not express.
- Do not recreate a generic `Button`, `Card`, `Modal`, `Drawer`, `Dropdown`, or `Tabs` layer merely to rename DaisyUI classes.
- Introduce a Headless dependency only after a focused browser test demonstrates a concrete interaction or accessibility gap that native HTML, DaisyUI, and small feature-local code cannot safely close.

### Implement Before Abstracting

Build the complete page or interaction slice directly first. Limited duplication is acceptable while requirements and geometry are still changing.

Consider extraction only after every intended call site:

- is implemented;
- has the same semantics and behavior;
- has passed automated and browser validation;
- changes for the same reasons;
- becomes clearer, rather than merely shorter, after extraction.

Treat "no extraction needed" as a valid result. Do not replace an old abstraction layer with a one-to-one wrapper layer around a new library.

### Tailwind And CSS Ownership

Choose the narrowest styling mechanism: DaisyUI structure and semantic roles, then local Tailwind utilities, then feature-owned composition CSS, and finally a documented compatibility override. A class's length alone is not a reason to introduce a component or stylesheet abstraction.

- Use complete, statically detectable class names in conditional branches. Runtime class fragments such as `bg-${color}` are not a supported styling strategy; use validated styles or CSS variables for data-driven values.
- Keep fixed appearance in classes. Inline styles are appropriate for measured positions, virtualized geometry, progress, CSS anchors, and validated workspace colors or lengths. A fixed gradient expression can live in CSS while its changing parameters remain variables. Do not replace useful inline styles with machinery solely to eliminate `style` attributes.
- Give each property's default one clear owner. Keep shared composition defaults in their composition class and local differences at the call site. Centralize feature-local class groups that must remain synchronized, such as two overlaid labels, without creating generic wrappers. Use `cn()` for intentional conditional composition or supported overrides, not to conceal contradictory defaults.
- Put ordinary element defaults in `@layer base` and feature composition styles in `@layer components`; use `@utility` when the rule is intended to participate as a utility with variants. In this WebApp, daisyUI 5 components are emitted inside Tailwind's utilities layer, so a `@layer components` rule cannot override their properties. Override a daisyUI component property with a call-site utility, or with a documented unlayered or important exception. Unlayered rules and important declarations require a narrow selector and a reason explaining the cascade or compatibility constraint. Verify computed styles before moving existing rules between layers: normal unlayered declarations outrank normal layered declarations.
- Use semantic theme colors for ordinary UI and pair foreground/background roles deliberately. Brand art, configured classifications, and graph adapters may retain validated custom colors. Check contrast against the actual composited background, including opacity, hover, selection, and progress fills; token names alone do not establish readability.
- Prefer theme radius and size roles for containers and controls. Fixed geometry, small chart labels, and one-off arbitrary values remain valid when required by the accepted design. Name repeated design values when they represent one stable concept; do not promote every measurement into a global token.
- Keep global CSS focused on theme/base definitions, rendered-content styling, shared compositions, and scoped compatibility rules. Split feature sections when ownership becomes unclear, preserving import and layer order. Markdown, third-party SVG, and imperative DOM output are legitimate CSS consumers.

Record an exception beside its implementation with its scope, reason, and relevant validation or removal condition. Preserve evidence-backed FAB overrides, scrollbar fallbacks, and chart geometry until a replacement passes the same behavior checks; syntactic uniformity is not sufficient reason to remove them.

### Style Tooling And Audit

Formatting and linting cover different contracts:

- Configure the Tailwind formatter with the actual CSS entry point for v4 (`tailwindStylesheet`) and the class-composition functions the project uses (`tailwindFunctions`, such as `cn` and `clsx`). Scope configuration to the relevant frontend surface in a multi-surface repository.
- Let the formatter own class ordering. Let lint rules check canonical, unknown, deprecated, duplicate, and conflicting classes at supported syntax locations, with selectors matching the project's class-constant names, such as `*ClassName`. Avoid competing automatic ordering rules.
- Inventory each class carrier separately: JSX attributes, class constants, composition calls, imperative `.className` assignments and `classList` calls, generated HTML strings, and CSS `@apply`. Prove coverage using a valid example and a deliberate violation for each supported carrier; parsing failures do not count as successful rule coverage. Classify a carrier as unsupported only when no formatter or lint configuration can cover it; report unsupported carriers explicitly and review or test them through an appropriate separate path.
- Keep custom-class allowlists narrow and traceable to a stylesheet or behavior hook. A passing lint run is not evidence about cascade layers, layout, contrast, or dynamic output.

For an audit, report source locations, impact, recommendation, and classification: confirmed defect, maintenance risk, or justified exception. Preview formatter changes before applying them broadly. Once implementation is authorized, separate tooling/formatting, behavior-preserving cleanup, and visual or responsive changes into reviewable batches. Acceptance requires the affected checks and real-browser evidence for changed rendering, following `Test Boundaries`.

### Responsive Layout Contract

Choose the responsive reference deliberately:

- Viewport queries govern application-shell modes and viewport-bound overlays. Embedded Views, cards, and toolbars should use available container space when sidebars, panels, or host embedding can change their width independently of the viewport. Use intrinsic wrapping and sizing first, and add responsive prefixes only where an explicit mode switch is needed.
- A desktop breakpoint alone does not justify expanding a fixed-width panel. Account for navigation, gaps, padding, panel width, and the primary content's minimum usable area. Collapse or defer secondary content when that budget is not met.
- For columns and cards, use the owning container rather than `vw` when the intended proportion is local; Table and Kanban still own horizontal scrolling per `Overflow, Clipping, And Stacking`. Chart minimum sizes and fixed timeline columns require a documented usability tradeoff, not a blanket prohibition on fixed dimensions.
- Keep CSS and JavaScript breakpoints aligned. Prefer CSS for presentation-only changes; use JS when state coordination or measured geometry requires it. Share threshold definitions where practical, otherwise verify equivalence. Name repeated component thresholds within their owner rather than creating a global breakpoint for every feature.
- When a dimension participates in both CSS and JavaScript geometry, change its source and all consumers together. For example, a timeline title-column width may affect clipping, virtualization, scroll compensation, and keyboard location; a CSS-only override is insufficient.
- Preserve state, focus, and access to actions when switching layouts or hiding controls. If the scroll owner changes across a breakpoint, validate scroll position, sticky headers, anchor navigation, and focus visibility in both directions.
- Use logical spacing/alignment for reading-direction-aware layout. Keep physical axes where chart time or measured pixel coordinates require them.

Validate just below, at, and above each affected threshold, plus sidebar/panel open and closed states, long labels and counts, short viewport heights, and enlarged text/browser zoom. Reuse the theme and keyboard matrix in `Browser Validation Loop`. Measure remaining content area and actionable controls as well as `scrollWidth`: no page overflow does not prove that a timeline or reading pane is usable. Record untested combinations rather than inferring them from a few device-width screenshots.

### Layout And Flexbox Heuristics

Intrinsic sizing is part of component behavior. Before adding explicit width or height, inspect the content and computed layout.

For horizontal Flex rows, decide intentionally which children may shrink:

- use `min-w-0` on a child that must be allowed to become narrower than its content;
- use `shrink-0` for icons, shortcuts, badges, and controls that must preserve their geometry;
- use `truncate` when overflow should stay single-line and end in an ellipsis;
- use `whitespace-nowrap` when wrapping would change component height or interaction geometry;
- do not assume `items-center` prevents text wrapping or intrinsic-height changes.

Long content must be tested rather than inferred from short fixtures. Include long titles, paths, labels, code, Table columns, and Kanban column names.

### Transition And Animation Heuristics

A correct start state and end state do not prove a correct transition.

State variants may apply display, font, padding, or content changes immediately while only width or transform is animated. This can create a transient layout defect that disappears before a static screenshot is taken.

For any transition that changes available space:

1. identify which properties actually animate;
2. identify which descendants appear, disappear, wrap, shrink, or change intrinsic size immediately;
3. measure geometry before activation, immediately after activation, during the transition, and after completion;
4. inspect `width`, `height`, `scrollWidth`, `scrollHeight`, `white-space`, `overflow`, line height, and computed transition properties where relevant;
5. verify both directions because expand and collapse may fail differently;
6. check `prefers-reduced-motion` behavior.

Prefer stable content geometry throughout the transition. Do not use a fixed height to mask wrapping when the correct fix is explicit shrink and no-wrap behavior.

### Overflow, Clipping, And Stacking

Assign overflow to the component that owns the oversized content:

- Table and Kanban own horizontal scrolling;
- code blocks own code overflow;
- Graph owns its viewport and resize behavior;
- the page root should normally satisfy `scrollWidth === clientWidth`.

Do not add global `overflow-x-hidden` to conceal a child layout defect.

When a Tooltip, Drawer, Modal, or Popover is clipped or obscured, inspect these before adding `z-index`:

- the library's documented DOM structure;
- ancestor overflow;
- containing blocks and stacking contexts;
- portal placement;
- component-owned state and placement classes.

Use a manual stacking value only when the required layering relationship remains unresolved after those checks and can be explained as a stable application rule.

### Configuration And Product Fidelity

- Follow [[guidelines/forma-product-model-and-configuration-fidelity]] for the cross-surface distinction between product contracts, configured concepts, repository conventions, and implementation details.
- Consume Forma data through shared operations and package boundaries; do not reproduce Core semantics in React.
- Do not infer built-in product concepts from one example workspace.
- Treat taxonomy names, Table columns, Kanban columns, card fields, and classification colors as configuration-driven unless the contract explicitly says otherwise.
- Use a representative non-trivial workspace for validation so hard-coded assumptions become visible.
- Preserve static product-route precedence when configurable route segments share the same URL level.

### Debugging Workflow

Before editing a reported defect, establish a tight pass/fail loop that reproduces the user's exact symptom.

1. Capture the relevant initial DOM state and computed geometry.
2. Drive the actual interaction, including its timing-sensitive path.
3. State a concrete red condition, such as a height change, root overflow, open dialog after navigation, missing focus, or console error.
4. Generate several ranked, falsifiable hypotheses.
5. Change one variable at a time.
6. Re-run the same measurement after each change.
7. Remove temporary instrumentation before completion.

Prefer direct evidence over visual guesses. A browser screenshot may suggest wrapping; computed `white-space`, element height, and scroll geometry can confirm it.

### Browser Validation Loop

Deliver one observable vertical slice at a time:

1. record the current route and regression risks;
2. implement the smallest complete behavior;
3. run focused type-check, lint, and tests;
4. build and serve the production WebApp through the real backend;
5. open the affected route with the repository-approved browser surface;
6. inspect visual hierarchy, DOM state, viewport geometry, and console output;
7. exercise the interaction and SPA navigation paths;
8. repeat visual review after every material adjustment;
9. run the broader repository gate before declaring the slice complete.

Use representative widths and themes required by the accepted design. For the current review surface, include 1440, 1024, 768, and 390 px plus `choral-light` and `choral-dark`.

For each relevant state, check:

- initial load and persisted presentation state;
- loading, empty, healthy, warning, and failure states;
- keyboard focus order and visible focus indicators;
- open, close, dismissal, and focus return;
- long content and local overflow;
- page-root overflow;
- route change and history behavior;
- console errors and warnings;
- reduced motion where the interaction animates.

### Test Boundaries

Use automated tests for stable behavior below the visual layer:

- data mapping and configuration fidelity;
- route construction and resolution;
- filtering and ranking;
- state transitions and navigation decisions;
- regressions that can be reproduced without relying on browser layout.

Use browser validation for:

- computed geometry and wrapping;
- responsive layout;
- focus, dismissal, and native dialog behavior;
- theme rendering;
- canvas resize and local overflow;
- animation and transition states.

Do not add tests that merely snapshot DaisyUI class strings. If a visual defect has no honest automated seam, preserve a deterministic browser measurement and record the limitation instead of adding a misleading unit test.

### Common Failure Patterns

| Symptom | Likely cause | Preferred response |
| --- | --- | --- |
| A control changes height only during expansion | Text appears before enough width exists and wraps | Inspect intermediate frames; set explicit shrink and no-wrap behavior on the correct children |
| Expanded and collapsed controls have different height | State-specific size classes or different text and icon line boxes | Use one size contract and align intrinsic line height before considering fixed height |
| Tooltip is hidden behind content | Incorrect Drawer structure, clipping ancestor, or stacking context | Restore documented structure and overflow behavior before adding `z-index` |
| Page has horizontal overflow | A wide child delegated overflow to the page | Give Table, Kanban, code, or Graph a local overflow owner |
| Menu stays open after navigation | Open state is independent of SPA route changes | Close on all navigation paths or use a primitive whose lifecycle matches the requirement |
| UI assumes `Spaces`, fixed Table columns, or a fixed Kanban board | Example data leaked into product structure | Drive labels, columns, and routes from the current configuration and projection |
| A fix requires editing many wrapper components | Abstraction was created before behavior stabilized | Return to direct feature markup, validate, and reconsider extraction afterward |
| Static screenshot passes but the user still sees a jump | Only resting states were reviewed | Capture or measure the transition lifecycle in both directions |

### Stop And Reassess When

- a visual fix requires changing a Core, RPC, schema, or workspace contract;
- the implementation begins inventing domain semantics not present in configuration;
- a controlled-state layer is being added only to mirror browser-owned state;
- a fixed dimension, global clipping rule, or arbitrary stacking value is proposed before measuring the cause;
- a generic UI abstraction is proposed before the complete slice passes validation;
- the available browser surface cannot reproduce or verify the reported behavior;
- the implementation diverges materially from the accepted product or design specification.

### Definition Of Done

A WebApp slice is complete only when:

- product behavior and configuration fidelity match the accepted contract;
- the relevant responsive, theme, keyboard, navigation, and transition states pass;
- visual review has been repeated after the final material change;
- page-root and component-local overflow are correct;
- browser console output is clean;
- focused tests and required repository gates pass;
- temporary instrumentation is removed;
- no premature abstraction or unsupported dependency was introduced;
- the commit remains reviewable around one page or capability boundary.

## Related Content

- [[design/webapp-review-surface-design]]
- [[design/webapp-review-surface-validation-2026-07-22]]
- [[planning/daisyui-webapp-foundation-rewrite-plan]]
- [[guidelines/dependency-governance]]
