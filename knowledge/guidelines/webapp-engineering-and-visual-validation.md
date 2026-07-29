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
    description: Use when an Agent implements, debugs, or visually validates a WebApp page, interaction, responsive layout, theme, or UI-foundation change.
    triggers:
        - implement webapp
        - debug frontend layout
        - visual validation
        - responsive webapp
        - daisyui interaction
        - sidebar transition
        - spa navigation dismissal
        - frontend abstraction review
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
- decides whether repeated UI code is ready to be extracted.

Read the accepted product or design specification for the affected surface before changing implementation. This guideline does not override route-specific acceptance criteria.

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
