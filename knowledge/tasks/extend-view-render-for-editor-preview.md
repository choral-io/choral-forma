---
schemaVersion: 1
kind: task
scope: project
title: Extend view render for editor preview
summary: Add Markdown body and mount source mapping to shared view-render results so editor previews can preserve the complete source-backed document.
type: task
priority: P1
value: H
module: core
effort: M
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - views
    - rendering
    - rpc
blockedBy: []
relatedTo:
    - "architecture/forma-view-query-model"
    - "architecture/forma-p0-operation-api-spec"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/implement-vscode-extension-mvp"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: View render document and source mapping contracts
---

# Extend View Render For Editor Preview

## Goal

Make `view.render` sufficient for a client to render the complete Markdown view document around a backend-recognized content mount.

## Sources

- [[architecture/editor-extension-adapter-contract]]
- [[architecture/forma-view-query-model]]
- [[design/editor-extension-mvp-design]]

## In Scope

- Extend `ViewRenderResult` with a document payload containing Markdown body source and structured content-mount source locations.
- Keep mount recognition and validation in Forma Core.
- Preserve current list, table, kanban, and graph projection outputs.
- Return diagnostics for missing or multiple mounts with actionable locations.
- Align the implementation with the accepted behavior for content before and after the mount.
- Update RPC serialization, CLI JSON, shared TypeScript types, operation API documentation, and fixtures.
- Preserve compatibility for existing WebApp callers that ignore the new optional payload.

## Out Of Scope

- HTML styling or editor theme behavior.
- Unsaved transient view rendering.
- Graph renderer changes.
- Writable view actions.

## Acceptance Criteria

- Tests cover Markdown before, at, and after one mount plus missing and multiple mount cases.
- The serialized body and source locations are stable and workspace safe.
- Existing View query and projection tests continue to pass.
- WebApp shared-client type checks pass without requiring it to adopt the new payload.
- Canonical product and architecture wording no longer conflicts about missing-mount behavior.
