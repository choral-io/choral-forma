---
schemaVersion: 1
kind: task
scope: project
title: Implement VS Code source-first View preview
summary: Render editable Markdown views beside their source with VS Code themes and read-only list, table, and kanban projections.
type: task
priority: P1
value: H
module: app
effort: L
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - views
    - webview
blockedBy: []
relatedTo:
    - "tasks/implement-vscode-extension-mvp"
    - "tasks/design-editor-graph-view-renderer"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code View source and themed preview experience
---

# Implement VS Code Source-First View Preview

## Goal

Provide a useful editor-native preview for Markdown-backed list, table, and kanban views without hiding or mutating source.

## Sources

- [[design/editor-extension-mvp-design]]
- [[architecture/editor-extension-adapter-contract]]
- [[tasks/extend-view-render-for-editor-preview]]

## In Scope

- Keep `.forma/views/*.md` and other configured view files in the normal Markdown text editor by default.
- Add Open View Preview, Open View Preview to the Side, source-opening toolbar behavior, and a focused CodeLens near the content mount.
- Compose Markdown before the mount, the structured projection, and Markdown after the mount.
- Add save-driven refresh with cancellation and stale-result suppression.
- Map VS Code WebView color, contrast, focus, selection, chart, and editor font variables into host-neutral `--forma-*` tokens.
- Render accessible, keyboard-navigable list, table, and kanban modes with source links, configured labels, columns, cards, badges, empty states, and diagnostics.
- Use a strict Content Security Policy and narrow local resource roots.
- Show an intentional deferred state for graph views with source access and diagnostics; do not port or redesign Graph.

## Out Of Scope

- Custom editor as the default source handler.
- Writable kanban, inline metadata editing, or graph interaction.
- Unsaved transient View rendering.
- Graph renderer selection or implementation.

## Acceptance Criteria

- Source remains directly editable and Preview to the Side works from configured view files.
- Markdown content before and after the mount is preserved in preview.
- List, table, and kanban fixtures render useful output and open entry source files.
- Light, dark, high-contrast, custom theme-token, editor-font, and reduced-motion behavior is verified.
- Narrow editor groups handle table and kanban overflow without breaking the workbench.
- Invalid and empty views have distinct, actionable states.
- Graph views clearly state the deferral and keep source accessible.
- WebView tests and Extension Host integration tests cover refresh, navigation, and theme messages.
