---
scope: project
type: ui-spec
title: WebApp Knowledge Reader Design
summary: Reader-first product position, navigation, layout, typography, and acceptance requirements that replace the review-surface navigation and Reader rules for the Forma WebApp.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - webapp
    - reader
    - navigation
    - typography
    - acceptance
sources:
    - "design/webapp-review-surface-design"
    - "decisions/use-settings-driven-taxonomy-and-navigation-model"
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/webapp-v2-package-architecture"
    - "guidelines/webapp-engineering-and-visual-validation"
    - "guidelines/dependency-governance"
---

# WebApp Knowledge Reader Design

## Purpose

Define the accepted reader-first direction for the Forma WebApp: what the reader sees, how they move between documents, and how a document is typeset.

This document supersedes the sections of [[design/webapp-review-surface-design]] listed under [Superseded Rules](#superseded-rules). Every other section of that specification remains in force, including configuration and data fidelity, interaction and state ownership, code organization rules, the browser and responsive matrix, accessibility acceptance, automated gates, and stop conditions.

The direction is accepted. Implementation has not started, and the typography integration described under [Typography](#typography) has not yet been verified in a build.

## Product Position

The WebApp is a knowledge-base reader. Its primary jobs, in order:

1. Read rendered Markdown documents comfortably.
2. Move between documents through persistent navigation, related documents, and adjacent documents.
3. Open configured Views as projections over the same content.
4. Jump to known resources through Quick Open.
5. Explain actionable workspace health findings.

The WebApp stays read-only. Markdown authoring remains in editors, and repository Markdown plus explicit Forma configuration remain the source of truth. The exclusions in the review-surface specification still apply: no Markdown editing, AI Chat, write operations, saved-view customization, or hidden frontend knowledge store.

The technical approach does not change. The WebApp keeps React, React Router, Tailwind CSS, DaisyUI, and the package-local workspace client, and this design introduces no new Core, RPC, schema, or workspace contract.

## Shell Layout

The shell has three regions: a navigation sidebar, the content column, and a page outline.

| Viewport        | Navigation sidebar               | Page outline                 |
| --------------- | -------------------------------- | ---------------------------- |
| 80rem and wider | Persistent, manually collapsible | Persistent on reading routes |
| 64rem to 80rem  | Persistent, manually collapsible | Opened on demand             |
| Below 64rem     | Native modal dialog              | Opened on demand             |

- The sidebar is 18rem wide. Collapsing hides it completely; there is no icon rail, because a tree has no meaningful icon-only state.
- The collapse state remains browser-owned presentation state. Initial rendering must not flash from expanded to collapsed.
- The page header is one compact row that stays visible at every width. It carries the breadcrumb, the outline trigger where the outline is not persistent, the theme control, and page actions. While the sidebar is not shown, it also carries the control that opens it and Quick Open. It does not repeat the document title.
- The mobile floating action button is removed. The sticky header carries its actions.
- Mobile navigation keeps the native dialog contract from the review-surface specification.

## Navigation Sidebar

The sidebar contains, top to bottom:

- workspace identity, which links to Home;
- Quick Open;
- a two-option strategy switch;
- the navigation tree for the selected strategy;
- a fixed footer with Health.

Health shows a count only when findings require attention.

### Navigation Strategies

The reader chooses between two strategies. The default is `Files`. The choice persists in browser-local presentation state and is not business state.

**Files** derives a directory tree from each entry's source path.

- Directory nodes group their children and are not navigable. The WebApp does not treat any filename, such as an index or README file, as a directory landing page.
- Document nodes show the entry title and expose the full source path as a tooltip. Directory nodes show the directory name.
- Directories sort before documents; siblings sort by displayed text using locale comparison. The read model carries no file-level order, and the WebApp does not invent one.
- A chain of directories that each contain only one directory collapses into a single row.

**Collections** follows configuration, using the same node model as the editor extension's workspace tree.

- Roots are the configured taxonomies in display order. Each taxonomy contains its terms, and each term contains its entries.
- A final `Views` group lists the configured Views. Each View shows its renderer kind and opens its projection route.
- A term row navigates to the term route. Disclosure is a separate control on the same row.

Neither strategy hard-codes a taxonomy name, a directory name, or an example-domain concept.

### Shared Tree Behavior

- Navigation and disclosure are separate controls. Activating one never performs the other.
- The branch containing the current route expands and scrolls into view. Other branches start collapsed. Expansion state is component-local and does not persist.
- Children render only while their branch is expanded.
- An entry that belongs to several terms appears under each. Every occurrence of the current entry is marked as current; only the first is expanded automatically.
- The tree lists canonical-language entries only. Language variants are switched from the document header.
- Switching strategy keeps the current route and reveals it in the newly selected tree.

### Routes

Routes do not change. `/pages`, `/browse`, `/views`, `/health`, `/:taxonomyId`, and `/:taxonomyId/:termId` keep their meaning and precedence so that static export URLs and existing links remain stable. `/pages`, `/browse`, and `/views` are no longer first-level navigation destinations; the tree and the breadcrumb reach them.

## Page Layout Modes

| Route                                  | Layout                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Document and Home                      | Reading layout: document column plus page outline                                                |
| View                                   | Full-width projection; the View document's Markdown description uses reading typography above it |
| Taxonomy, term, Pages, and Views index | Narrow row list                                                                                  |
| Health                                 | Narrow row list, unchanged                                                                       |

### Home

Home renders the workspace entry document as an ordinary document in the reading layout. A short recently updated list follows the document body. Configured View entry rows are no longer a Home section; the Collections tree owns them. Health still appears on Home only when a finding requires attention.

## Reader

A document route presents, top to bottom:

1. **Breadcrumb**, in the page header. It follows the selected strategy: path segments under Files, taxonomy and term under Collections. It does not repeat the document title.
2. **Document header**: the title as the only `h1`, the summary, and one line of metadata with the updated time, language variants, and a status label when the entry is not healthy. The source path moves into a secondary page action that copies it.
3. **Body**, typeset as described under [Typography](#typography).
4. **Related documents**, expanded by default: backlinks first, then outgoing references, as row lists. Unresolved references keep a non-color warning treatment. Diagnostics appear only when present and stay in a closed disclosure.
5. **Adjacent documents**: previous and next siblings in the selected strategy, meaning the same directory under Files and the same term under Collections. The control is omitted when there are no siblings.

### Page Outline

- The outline highlights the heading for the section currently in view.
- The outline footer shows the backlink count and jumps to the related-documents section.
- `Back to top` appears after the reader scrolls beyond one viewport.
- Outline order and heading identity continue to come from backend analysis.

### Reading Enhancements

- Code blocks offer a copy control that is visible on hover and on keyboard focus.
- Headings offer an anchor control that copies a link to that heading.
- A reading-progress indicator sits under the page header. It is a progressive enhancement and may be absent where the browser lacks the required capability.
- Focus mode hides the navigation sidebar and the page outline together and restores both. It toggles existing browser-owned state rather than adding a state layer.
- Every enhancement is keyboard reachable and respects reduced-motion preferences.

## Typography

The document body uses the Tailwind CSS Typography plugin.

- Body text is 16px with a line height near 1.75, in a column of roughly 72 characters.
- Headings follow the plugin's default scale, so the document title and section headings are clearly separated from body text.
- Colors map to DaisyUI semantic theme roles through the plugin's variables, so `choral-light` and `choral-dark` both apply without a separate inverted variant.
- Links stay in the primary color with a subdued underline. External and anchor link glyphs remain.
- Tables, code blocks, diagrams, and Graph may exceed the text measure up to the content column and own their horizontal overflow.
- CJK text uses the system font stack with strict line breaking and automatic CJK-Latin spacing where the browser supports it. No web font is added.

Component-like content keeps its existing presentation and is excluded from plugin styling: Mermaid diagrams, callouts, Markdown disclosures, and KaTeX output. Shiki code blocks and the sticky-header table wrapper keep their current geometry, with plugin defaults overridden where they conflict.

The existing `data-reader="markdown"` hook remains the single typography entry point. Static export fallback HTML is generated outside the WebApp and already carries that hook, so it receives the same typography without a CLI change. If the plugin cannot be applied through that hook, the fallback is to add the plugin class in both the WebApp and the static HTML templates, which is a CLI change with its own crate verification.

### Dependency

`@tailwindcss/typography` is added to `packages/webapp` as a development dependency.

- **Capability**: long-form reading typography for rendered Markdown.
- **Boundary**: the WebApp package only. It is a build-time Tailwind plugin and adds no runtime code.
- **Why not hand-written rules**: the current reader rules are tuned for interface-size text. The plugin provides a maintained, proportionally consistent scale that the related Choral project already uses with the same themes.
- **Removal path**: the plugin is applied at one hook. Removing it restores hand-written rules at that hook without touching the Markdown pipeline.

## Deferred

These are outside this design and need their own decision before implementation:

- reading preferences such as font size, measure, or typeface;
- full-text search in the WebApp;
- a Core-provided navigation projection shared by the WebApp, static export, and editor integrations;
- link hover previews and transclusion.

## Acceptance

The acceptance matrix in [[design/webapp-review-surface-design]] still applies to List, Table, Kanban, Graph, Health, Quick Open, and accessibility. The criteria below replace its Home and Reader acceptance and add navigation acceptance.

### Navigation Acceptance

- Every indexed document is reachable from the Files tree, and every configured taxonomy, term, entry, and View is reachable from the Collections tree.
- The current route is revealed and marked as current in the selected strategy without relying on color alone.
- Navigation and disclosure work independently by pointer and by keyboard.
- The selected strategy and sidebar collapse state survive reload without a layout flash.
- No taxonomy title, directory name, or filename is treated as a built-in assumption.
- Long titles, deep directory chains, and large terms remain usable at every target width.

### Home Acceptance

- Home renders the workspace entry document in the reading layout.
- Recently updated content is short and scannable.
- Health appears only when a finding requires attention.

### Reader Acceptance

- The title appears once, as the only `h1`, and receives focus after route navigation.
- The Markdown body is the primary visual surface at a comfortable measure.
- Metadata is one compact line; the source path is reachable but not in the reading flow.
- Backlinks and outgoing references are visible without opening a disclosure.
- The outline is persistent at 80rem and wider, reachable by keyboard at every width, and highlights the current section.
- Adjacent-document controls match the selected strategy's sibling order.
- Long-form Markdown, headings, code, tables, links, Mermaid, callouts, disclosures, math, and both themes remain readable.
- Static export fallback pages render the same body typography before enhancement.

## Superseded Rules

This document replaces the following parts of [[design/webapp-review-surface-design]]:

- `Product Position`: the WebApp is a knowledge-base reader first; workspace review is one of its jobs rather than its identity.
- `Expanded Desktop Navigation`: the sidebar now persistently presents documents, taxonomy terms, and Views through the navigation tree.
- `Collapsed Desktop Navigation`: the icon rail is replaced by full collapse.
- `Home` under `Page Layout Modes`, and `Home Acceptance`.
- `Reader` under `Page Layout Modes`, and `Reader Acceptance`: the outline and related documents are no longer closed by default, and a persistent outline region is allowed.

The `Projection` layout rules are not superseded. Their breadcrumb now follows the selected navigation strategy.
