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

The direction is accepted and implemented in the WebApp. The items under [Deferred](#deferred) remain open.

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
- two tabs, `Files` and `Workspace`, and the tree of the selected tab;
- a fixed footer with Health.

Health shows a count only when findings require attention.

`Files` shows the source tree and `Workspace` the configuration-derived tree, as an editor's explorer and the editor extension's Forma tree do. The tabs are two views of the same workspace, not navigation strategies: the breadcrumb, adjacent documents, and routes never depend on the selected tab, and every document has exactly one place in the sidebar.

### Tabs

`Files` is selected by default. The selection persists in browser-local presentation state and is not business state. The selected tree uses the full height of the sidebar and scrolls on its own. Navigating never switches tabs, so browsing taxonomies in `Workspace` is not interrupted by opening a document; switching tabs reveals the current page in the newly shown tree when it has a row there.

**Files** derives a directory tree from each entry's source path, starting at the workspace root: the directory that contains `.forma.md`, against which every configured path resolves.

- The workspace entry document, `.forma.md`, is the root's own document and leads the tree, ahead of every folder, with a home icon. It takes no part in adjacent-document order. The workspace identity at the top of the sidebar also opens Home but is not marked as the current page, so Home has one current row like every other page.
- It lists indexed documents only. Files that no content selection includes never appear, so a directory row stands for the indexed documents below it, not for the directory's full contents.
- Directory nodes open their directory page. Document nodes show the entry title and expose the full source path as a tooltip; directory nodes show the directory name and expose the directory path.
- A document whose route equals a directory's route, such as `notes/index.md` or a `notes.md` beside `notes/`, stands for that directory: the directory row shows the document's title and is not followed by a separate row for the document, so the tree never marks two rows for one page. Directory pages and breadcrumbs use the same title. A directory whose document is all it holds is a plain link without disclosure.
- Directories sort before documents; siblings sort by displayed text using locale comparison, then by file or directory name. The read model carries no page-level order, and the WebApp does not invent one.
- A chain of directories that each hold no page and only one directory is compacted into one row, as editor explorers do. Each segment of the row remains a separate link to its own directory page and can be the current page, so every directory stays visible and reachable. A directory that a document stands for never joins a chain, so a row shows either path segments or a title.

**Workspace** lists configured taxonomies and their terms, followed by a `Views` group, matching the editor extension's tree.

- Taxonomies and terms keep the read model's order, which follows `display.order` and then title.
- A row uses its configured `display.icon` when the icon is supported and its `display.color` for that icon, adapted to the active theme. Without them a taxonomy uses a tags icon, a term uses a folder icon, and both use the theme's text color.
- A taxonomy row navigates to the taxonomy route; disclosure is a separate control on the same row. A term row navigates to the term route.
- Terms do not list their entries. The term page does, so a document's sidebar location stays unique.
- The `Views` group opens the Views index and lists the configured Views in the read model's order. Each View shows its renderer kind and opens its projection route. The group is omitted when no View is configured.

No tab hard-codes a taxonomy name, a directory name, or an example-domain concept.

### Shared Tree Behavior

- Navigation and disclosure are separate controls. Activating one never performs the other.
- Exactly one row in the sidebar is the current page, and it is marked without relying on color alone. The branches above it expand and it scrolls into view. A current row that is itself a branch, such as a directory, a taxonomy, or `Views`, keeps the reader's disclosure state: following its link never expands or collapses it. `Workspace` starts with every root expanded, so taxonomies show their terms and the `Views` group its Views. `Files` starts with its root folders collapsed, except that a root holding a single folder and nothing else but Home starts with that folder expanded, since it adds a level without a choice. Other branches start collapsed. Expansion state is component-local and does not persist; switching tabs starts the shown tree from these defaults again.
- On a document route, each taxonomy and term row in `Workspace` whose term includes the document carries a secondary "contains the current page" marker. The marker does not expand anything and is not the current page.
- Children render only while their branch is expanded.
- Titles may repeat. When siblings share a label, compared as sorting compares it, each shows a secondary description that tells them apart: the file name for a document, the directory name for a titled directory, and the configured id for a taxonomy, term, or View. Titles themselves are unchanged, and rows under different parents are told apart by position. Adjacent-document links show the same description.
- Trees list canonical-language entries only. Language variants are switched from the document header.

### Routes

Existing routes keep their meaning and precedence so that static export URLs and existing links remain stable: `/pages/<entry path>`, `/browse`, `/views`, `/views/<id>`, `/health`, `/:taxonomyId`, and `/:taxonomyId/:termId`.

Directory pages share the page namespace, because directories and documents come from the same source paths:

- `/pages` is the workspace root's directory page, titled `Files` like the tab that shows the same tree. It replaces the flat page index; every indexed page remains reachable from it, from the `Files` tree, and from Quick Open.
- `/pages/<directory path>` is a directory's page. A route resolves to a document first; when no document owns it, it resolves to the directory; otherwise it reaches the not-found page.
- When a document owns a directory's route, through Core's existing rule that `x/index.md` is served at `/pages/x` or through a `x.md` beside `x/`, the document page shows the document and then the directory's listing. The WebApp adds no filename convention of its own, and the listing stays reachable.
- A path that holds no indexed document is not a directory.
- Directory pages reserve no name outside `/pages`, so they cannot collide with a taxonomy.

`/browse` is titled `Collections` in the WebApp and in static export fallback pages. Static export does not yet generate directory pages, so a directory URL opened directly on a static host reaches the not-found page before enhancement; see [Deferred](#deferred).

## Page Layout Modes

| Route                                      | Layout                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Document and Home                          | Reading layout: document column plus page outline                                                |
| View                                       | Full-width projection; the View document's Markdown description uses reading typography above it |
| Taxonomy, term, directory, and Views index | Narrow row list                                                                                  |
| Health                                     | Narrow row list, unchanged                                                                       |

### Home

Home renders the workspace entry document, `.forma.md`, as an ordinary document in the reading layout. A short recently updated list follows the document body. Configured View entry rows are no longer a Home section; the `Workspace` tab owns them. Health still appears on Home only when a finding requires attention.

## Reader

A document route presents, top to bottom:

1. **Breadcrumb**, in the page header: `Files` and each containing directory, each opening its directory page. It does not repeat the document title. Taxonomy and term pages show `Collections` and the taxonomy.
2. **Document header**: the title as the only `h1`, the summary, and one line of metadata with the updated time, language variants, and a status label when the entry is not healthy. The source path moves into a secondary page action that copies it.
3. **Body**, typeset as described under [Typography](#typography).
4. **Related documents**, expanded by default: backlinks first, then outgoing references, as row lists. Unresolved references keep a non-color warning treatment. Diagnostics appear only when present and stay in a closed disclosure.
5. **Adjacent documents**: previous and next documents in the same directory of the `Files` tree. The control is omitted when there are no siblings.

### Page Outline

- The outline highlights the heading for the section currently in view.
- The outline footer shows the backlink count and jumps to the related-documents section.
- `Back to top` appears after the reader scrolls beyond one viewport.
- Outline order and heading identity continue to come from backend analysis.

### Reading Enhancements

- Code samples offer a copy control that is visible on hover and on keyboard focus. Diagram source blocks are left as rendered.
- Headings offer an anchor control that copies a link to that heading.
- A reading-progress indicator sits under the page header. It is a progressive enhancement and may be absent where the browser lacks the required capability.
- Focus mode hides the navigation sidebar and the page outline together and restores both. It toggles existing browser-owned state rather than adding a state layer.
- Every enhancement is keyboard reachable and respects reduced-motion preferences.

## Typography

The document body uses the Tailwind CSS Typography plugin.

- Body text is 16px with a line height near 1.75, in a column of roughly 75 characters.
- Headings follow the plugin's default scale, so the document title and section headings are clearly separated from body text.
- Colors map to DaisyUI semantic theme roles through the plugin's variables, so `choral-light` and `choral-dark` both apply without a separate inverted variant.
- Links stay in the primary color with a subdued underline. External and anchor link glyphs remain.
- Tables, code blocks, diagrams, and Graph may exceed the text measure up to the content column and own their horizontal overflow.
- CJK text uses the system font stack with strict line breaking and automatic CJK-Latin spacing where the browser supports it. No web font is added.

Component-like content keeps its existing presentation and is excluded from plugin styling: Mermaid diagrams, callouts, Markdown disclosures, and KaTeX output. Shiki code blocks and the sticky-header table wrapper keep their current geometry, with plugin defaults overridden where they conflict.

The existing `data-reader="markdown"` hook remains the single typography entry point. Static export fallback HTML is generated outside the WebApp and already carries that hook, so it receives the same typography without a CLI change. The fallback templates stack reader blocks in a flex column; the WebApp stylesheet restores block layout there so that block margins collapse as they do in the enhanced page.

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
- link hover previews and transclusion;
- a configurable directory landing document beyond Core's `index` route rule, such as a README file, which needs a configuration-model decision shared by every surface;
- static export generation for directory pages.

## Acceptance

The acceptance matrix in [[design/webapp-review-surface-design]] still applies to List, Table, Kanban, Graph, Health, Quick Open, and accessibility. The criteria below replace its Home and Reader acceptance and add navigation acceptance.

### Navigation Acceptance

- Every indexed document and every directory that holds one is reachable from the `Files` tab, and every configured taxonomy, term, and View from the `Workspace` tab.
- Exactly one sidebar row is marked as the current page, without relying on color alone, and it is revealed. Terms that include the current document carry a secondary marker.
- Taxonomies, terms, and Views follow configured display order; configured icons and colors apply where supported.
- Navigation and disclosure work independently by pointer and by keyboard.
- The selected tab and sidebar collapse state survive reload without a layout flash.
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
- Adjacent-document controls match the `Files` tree's sibling order.
- Long-form Markdown, headings, code, tables, links, Mermaid, callouts, disclosures, math, and both themes remain readable.
- Static export fallback pages render the same body typography before enhancement.

## Superseded Rules

This document replaces the following parts of [[design/webapp-review-surface-design]]:

- `Product Position`: the WebApp is a knowledge-base reader first; workspace review is one of its jobs rather than its identity.
- `Expanded Desktop Navigation`: the sidebar now persistently presents documents, taxonomies and terms, and Views in two tabs.
- `Collapsed Desktop Navigation`: the icon rail is replaced by full collapse.
- `Home` under `Page Layout Modes`, and `Home Acceptance`.
- `Reader` under `Page Layout Modes`, and `Reader Acceptance`: the outline and related documents are no longer closed by default, and a persistent outline region is allowed.

The `Projection` layout rules are not superseded.
