---
scope: project
title: VS Code Preview Links And Forma Navigation
summary: Design for semantic links in native Markdown Preview and a dynamic Forma tree inside VS Code Explorer.
owners:
    - "members/tiscs"
tags:
    - vscode
    - editor-extension
    - markdown-preview
    - navigation
sources:
    - "architecture/editor-extension-adapter-contract"
    - "decisions/editor-extension-primary-product-surface"
---

# VS Code Preview Links And Forma Navigation

## Objective

Make Forma feel like a structured Markdown enhancement inside VS Code rather than a separate application surface. Native Markdown Preview should preserve semantic document navigation, while a dedicated Forma container should expose configured workspace structure without replacing Explorer.

## Native Preview Semantic Links

Forma turns a body wikilink into a native Preview anchor only after Core resolves its target. Source Markdown keeps its stable target path, while Preview chooses a readable label in this order: an explicit wikilink alias, the resolved target document title, then the original target path. When a title-backed link includes a heading or block fragment and has no explicit alias, append the fragment as `Document Title › Fragment` so the destination context remains visible. Unresolved wikilinks remain visible as source text, and wikilinks inside code spans or code blocks are not interpreted. Ordinary Markdown links remain owned by VS Code's Markdown renderer and are not rewritten.

### Frontmatter References

Forma enhances frontmatter values only when Core reports a resolved semantic reference for the inspected document. A path-shaped string is not sufficient evidence by itself.

- Use `inspect.entry.refs` entries whose `source` is `frontmatter`.
- Match the reported field and resolved target path against the rendered frontmatter table.
- Render resolved values as workspace-root Markdown links so VS Code keeps ownership of Preview navigation.
- Support scalar and list values, including YAML such as `owners: [members/noah-kim]` and multiline list syntax.
- Leave unresolved, ambiguous, external, and ordinary string values unchanged.
- Keep source Markdown untouched; this is a Preview-only enhancement.

The extension may cache enhanced Preview data by document URI because Markdown-it rendering is synchronous and Forma operations are asynchronous. Core remains the owner of semantic reference resolution.

## Forma Explorer View

The extension contributes one `Forma` Tree View inside VS Code's built-in Explorer. It does not add a separate Activity Bar container or assume that a taxonomy named `spaces` exists.

### Taxonomies

- Show every configured Taxonomy in display order.
- Expand a Taxonomy to show its configured Terms.
- Show each Term's entry count and health state.
- Expand a Term to list its matched Entries.
- Open an entry's Markdown source when selected.

### Views

- Show one `Views` group alongside configured Taxonomies when Views exist.
- Show configured Views in display order.
- Show the View title and mode.
- Use selected Lucide SVGs for the Views group and for list, table, kanban, graph, and unknown View modes. Ship only the used assets in light and dark variants, keep their third-party notices in the extension package, and do not add the complete Lucide package as a runtime dependency.
- Keep Taxonomy, Term, and Entry icons on VS Code Codicons so those generic workspace nodes remain consistent with the native Explorer.
- Open the Forma-enhanced native Markdown Preview when a View is selected.
- Keep the Preview's native `Open Source File` action as the direct path to editable Markdown source.

The tree consumes the shared `workspace.dashboard` operation. The VS Code adapter maps Taxonomies, Terms, Entries, and Views into Tree Items and workspace URIs; it does not rediscover classification from filesystem conventions. A starter workspace may define a primary Taxonomy titled `Spaces`, but that title and its Terms remain project configuration rather than Forma built-ins.

## Lifecycle

- Populate the tree after the Forma runtime reaches a usable workspace state.
- Refresh after `Forma: Refresh Workspace`, workspace-folder changes, workspace trust changes, and Forma configuration changes.
- Show a concise empty or unavailable state when no Forma workspace is active.
- Use the runtime URI adapter for local and Remote workspaces.

## First-Release Boundaries

The first release is read-only. It does not add create, delete, drag-and-drop, metadata editing, arbitrary queries, or embedded View rendering inside the tree. These interactions require explicit Core write operations and separate product design.

The first internal validation cut for this combined Preview and navigation design is [[releases/forma-v0.1.0-alpha.15]].

## Acceptance Criteria

- Resolved frontmatter references are links in native Markdown Preview; ordinary values remain text.
- `owners: [members/noah-kim]` and multiline owners lists navigate to the resolved member document.
- Resolved body wikilinks, aliases, embeds, and heading fragments navigate from native Markdown Preview.
- Unresolved wikilinks and code examples remain unchanged; ordinary Markdown links keep native behavior.
- Only the native Markdown Preview entry remains visible.
- Explorer contains one `Forma` view and no separate Forma Activity Bar icon.
- Configured Taxonomies appear as collapsible roots, including projects that do not define `spaces`.
- Taxonomy Terms and Entries open or expand as expected; View nodes open native Preview directly.
- Light, dark, high-contrast, local, and Remote behavior rely on VS Code theme and URI APIs.
- Unit, manifest, Extension Host, Forma check, and workspace health validation pass.
