---
scope: project
type: task
priority: P1
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - vscode
    - editor-extension

effort: L
status: done
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/editor-extension-adapter-contract"
    - "design/editor-extension-mvp-design"
    - "planning/editor-extension-mvp-roadmap"
    - "planning/editor-extension-alpha-13-execution-plan"
    - "tasks/design-editor-extension-adapter-contract"
    - "tasks/implement-zed-extension-mvp"
    - "tasks/scaffold-vscode-extension-package"
    - "tasks/design-editor-graph-view-renderer"

reportedBy:
affectedArea: VS Code extension
---

# Implement VS Code Extension MVP

## Goal

Implement the VS Code-first Forma extension MVP for workspace discovery, reference navigation, and source-first view preview.

## Sources

- [[decisions/editor-extension-primary-product-surface]]
- [[architecture/editor-extension-adapter-contract]]
- [[design/editor-extension-mvp-design]]
- [[planning/editor-extension-mvp-roadmap]]
- [[tasks/design-editor-extension-adapter-contract]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

VS Code is the first editor extension target and the primary product surface for the next phase. The extension should make Forma capabilities available where users edit Markdown while preserving Core-owned semantics and ordinary source files.

## In Scope

- Add a VS Code extension package with focused build, type-check, unit, and extension-host validation.
- Discover `.forma.md`, select the applicable root in multi-root sessions, locate a compatible Forma binary, and expose workspace status and commands.
- Use structured Core operations for config inspection, health, diagnostics, reference resolution, and view rendering.
- Implement saved-file navigation for ordinary Markdown links, wikilinks, embeds, and schema-declared semantic references.
- Keep view files editable in the normal Markdown editor and provide Preview and Preview to the Side commands.
- Render Markdown around the view mount plus read-only list, table, and kanban projections.
- Map VS Code theme and font variables into host-neutral Forma renderer tokens, including high contrast and reduced motion.
- Show an intentional deferred state for graph views instead of porting the current fixed-circle WebApp component.
- Preserve source navigation from rendered items and Graph nodes.

## Out Of Scope

- Porting the WebApp dashboard shell into VS Code.
- Full Markdown editing features.
- Direct file mutation commands.
- Writable kanban or graph interactions.
- Live semantic analysis of unsaved buffers.
- A persistent daemon or language server without measured need.
- Zed extension implementation.
- Marketplace publishing.

## Acceptance Criteria

- Workspace discovery and invalid, missing-binary, incompatible-version, and ready states are accurate.
- Supported saved links and semantic references navigate through Core-owned resolution.
- View source remains ordinary editable Markdown and can open a theme-correct preview beside it.
- List, table, and kanban previews render useful output or clear empty/error states.
- Graph views show a clear deferred state and keep source accessible.
- Preview entries can open their source Markdown.
- No extension preview action silently mutates repository files.
- Core, contract, extension, and packaging checks defined by the roadmap pass.

## Relationship Notes

This is the umbrella for the first installable release. The child task chain in [[planning/editor-extension-alpha-13-execution-plan]] completed with the published and verified [[releases/forma-v0.1.0-alpha.13]].

## Development Entry Point

Start with [[tasks/scaffold-vscode-extension-package]]. Do not select a Graph renderer in this Goal; that work is tracked by [[tasks/design-editor-graph-view-renderer]].
