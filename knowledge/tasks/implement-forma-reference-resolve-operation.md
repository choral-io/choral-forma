---
schemaVersion: 1
kind: task
scope: project
title: Implement Forma reference resolve operation
summary: Add the shared read-only operation that resolves editor link targets through canonical Forma path, schema, fragment, and ambiguity semantics.
type: task
priority: P1
value: H
module: core
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - references
    - rpc
    - cli
blockedBy: []
relatedTo:
    - "architecture/forma-p0-operation-api-spec"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/implement-vscode-extension-mvp"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Forma Core, RPC, CLI, and shared reference contracts
---

# Implement Forma Reference Resolve Operation

## Goal

Expose canonical target resolution for editor integrations without moving reference semantics into the extension.

## Sources

- [[architecture/editor-extension-adapter-contract]]
- [[architecture/forma-p0-operation-api-spec]]
- [[design/editor-extension-mvp-design]]

## In Scope

- Define a typed read-only `reference.resolve` request and result in Forma Core and RPC.
- Accept workspace-relative source path, raw target, intent, and optional fragment information.
- Resolve ordinary Markdown paths, wikilink-style paths, heading fragments, embeds, and schema-informed entry references through the existing index and path model.
- Return canonical target path, target title or kind when available, fragment location, ambiguity candidates, and diagnostics.
- Preserve case-sensitive and workspace-safe behavior; do not silently normalize ambiguous targets.
- Add a structured CLI command suitable for short-lived editor invocation.
- Add matching TypeScript result types to `packages/shared`.
- Document the operation in the canonical operation API spec.

## Out Of Scope

- Editing or rewriting references.
- Full-document unsaved-buffer analysis.
- Backlink panels or search.
- Editor-specific ranges and UI.

## Acceptance Criteria

- Core tests cover resolved, unresolved, ambiguous, fragment, embed, semantic-field, case, and path-escape cases.
- RPC and CLI tests prove stable JSON shapes and error boundaries.
- Shared TypeScript types match serialized Rust results.
- Public results expose only workspace-relative paths.
- Existing check, inspect, file-reference, and WebApp behavior does not regress.
