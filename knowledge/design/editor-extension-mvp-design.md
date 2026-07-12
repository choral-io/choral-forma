---
scope: project
type: interaction-design
owners:
    - "members/tiscs"
reviewers: []
tags:
    - design
    - editor-extension
    - vscode
    - navigation
    - views
sources:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-view-query-model"
---

# Editor Extension MVP Design

## Product Promise

Forma should make a configured Markdown workspace understandable inside the editor without taking ownership of the files. The first extension succeeds when a user can open an existing repository, see whether Forma recognizes it, follow its knowledge relationships, and preview its saved views without leaving the editor or adopting a proprietary document format.

VS Code is the first implementation host. The interaction model should avoid assumptions that prevent a later Zed adapter from using the same Core contracts.

## Primary Journey

```text
open repository
-> extension discovers .forma.md
-> status reports workspace readiness
-> user opens or edits Markdown source
-> links and semantic references navigate to source files
-> user opens a view Markdown document
-> preview renders its projection with the editor theme
```

## Workspace Experience

The status bar should show one compact state for the active document's Forma workspace:

- `Forma: Ready`
- `Forma: Invalid configuration`
- `Forma: CLI not found`
- `Forma: Incompatible version`
- `Forma: No workspace`

The state opens a small command menu rather than a custom dashboard. Initial commands are:

- `Forma: Select Workspace`
- `Forma: Inspect Configuration`
- `Forma: Check Workspace`
- `Forma: Refresh Workspace`
- `Forma: Open Output`

Errors should lead to the relevant source file and location when available. Detailed process output belongs in a dedicated Forma output channel.

## Reference Navigation

The extension should provide definition navigation for:

- ordinary relative Markdown links;
- Markdown heading fragments;
- wikilinks with paths, aliases, and heading fragments;
- wikilink embeds;
- frontmatter values whose configured schema type is `entryRef` or a named semantic reference type.

The baseline interactions are `Cmd/Ctrl + Click`, Go to Definition, and an informative hover. Resolved references open the canonical Markdown source. Ambiguous references show a candidate picker. Unresolved references produce diagnostics and must not silently use case-insensitive or slug-normalized guesses.

Reference panels, backlinks, rename support, automatic reference repair, and live unsaved-buffer analysis are follow-up capabilities, not MVP blockers.

## View Source And Preview

View files open in the normal Markdown text editor. Forma does not register a custom editor as the default handler.

The extension adds:

- `Open View Preview`;
- `Open View Preview to the Side`;
- an `Open Preview` CodeLens near the content mount;
- `Open Source` in the preview toolbar;
- save-driven preview refresh;
- navigation from rendered items to their Markdown source.

The preview shows the complete view document: Markdown before the mount, the generated projection at the mount, and Markdown after it. Diagnostics link back to view frontmatter or mount locations.

V1 previews are read-only. Kanban drag-and-drop, graph relationship editing, inline field edits, and generated source rewrites are excluded.

## View Modes

### List And Table

- Use editor-native typography and compact spacing.
- Preserve configured labels and sort order.
- Make entry titles keyboard-focusable source links.
- Provide horizontal overflow only when columns cannot remain readable.
- Show an explicit empty state and view diagnostics.

### Kanban

- Preserve configured column order, labels, icons, card title, subtitle, and badges.
- Use a horizontal scroll region inside the preview rather than resizing the editor shell.
- Open the source entry from a card click or keyboard action.
- Do not imply that dragging is available.
- Distinguish empty columns from invalid or unmatched results.

### Graph

The current WebApp graph is evidence that the data contract works, not the target visual design.

Graph preview is deferred from the first installable extension releases. When a user opens a graph view before the focused Graph project lands, the preview should show a deliberate unsupported/deferred state, preserve diagnostics, and provide a direct path back to the editable view source. It must not silently fall back to the current fixed-circle WebApp renderer.

The later focused Graph project should prioritize knowledge exploration:

- a layout that reflects relationships rather than a fixed circle;
- stable node positions across refreshes;
- search and focus by title or path;
- filters for space, kind, and relationship type;
- persistent selection and highlighted one-hop neighbors;
- labels that adapt to zoom and density;
- edge labels on focus instead of always-on clutter;
- keyboard-accessible source navigation outside the canvas when necessary;
- theme, contrast, and reduced-motion compatibility.

That later implementation begins with a renderer spike comparing at least two approaches over the same small, medium, empty, and invalid fixtures. The selected library is an implementation outcome, not a product contract.

## Theme Behavior

The preview must feel embedded in the editor rather than like a framed WebApp.

- Background, foreground, border, focus, selection, error, warning, and chart colors come from editor theme tokens.
- Font family, size, and weight follow editor settings.
- Forma components consume semantic `--forma-*` tokens so shared renderers remain host-independent.
- Light, dark, high-contrast, and user-customized themes are supported.
- Fixed brand palettes may be used only as fallbacks when an editor provides no suitable semantic token.
- Theme changes update an open preview without requiring a source reload.

## Refresh And State

- Save changes to `.forma.md`, imported config, schemas, views, or indexed Markdown invalidate affected preview and navigation state.
- The first version may rebuild through short-lived operations rather than maintaining a persistent index.
- New refresh requests cancel or supersede stale work.
- Graph viewport, filters, and adjusted coordinates may live in extension workspace state; they are not repository facts.

## Accessibility

- Every preview action is keyboard reachable.
- Focus is visible with the active editor theme.
- Color is not the only carrier of status or graph relationship meaning.
- High-contrast themes receive explicit borders.
- Motion-sensitive users can disable layout animation.
- Canvas-based graph output has an accessible selection/details surface and commands for opening the active node.

## MVP Acceptance

- Opening a configured repository produces an accurate Forma workspace state.
- A user can navigate supported link and semantic reference forms to canonical source files.
- A user can open and edit a view's Markdown source using the normal editor.
- A user can open list, table, and kanban previews beside that source.
- Graph views produce a clear deferred state without hiding or replacing their source.
- View previews render the Markdown body around the content mount.
- Preview styling follows the active editor theme, including high contrast.
- Rendered entries and graph nodes can open their source Markdown.
- Invalid configuration, unresolved references, invalid views, and empty projections have clear states.
- No preview interaction silently mutates repository files.

## Deferred

- Graph renderer design and implementation;
- Zed implementation;
- extension marketplace publishing automation;
- full-text search and quick open;
- backlinks and relationship explorer panels;
- live analysis of unsaved buffers;
- writable kanban, graph, or metadata interactions;
- AI Chat;
- language server or persistent daemon;
- WebApp feature expansion unrelated to shared contracts or maintenance.
