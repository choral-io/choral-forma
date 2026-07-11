---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - editor-extension
    - vscode
    - zed

effort: M
status: done
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/editor-extension-adapter-contract"
    - "design/editor-extension-mvp-design"
    - "planning/editor-extension-mvp-roadmap"
    - "tasks/implement-vscode-extension-mvp"
    - "tasks/implement-zed-extension-mvp"

reportedBy:
affectedArea: Editor extension adapter contract
---

# Design Editor Extension Adapter Contract

## Goal

Define the shared adapter contract that VS Code and later editor extensions use to connect editor context to Forma Core operations.

## Sources

- [[decisions/editor-extension-primary-product-surface]]
- [[architecture/editor-extension-adapter-contract]]
- [[design/editor-extension-mvp-design]]
- [[planning/editor-extension-mvp-roadmap]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

Editor extensions are the primary surface for the next product phase. The contract must preserve editor independence by keeping configuration, Markdown analysis, reference resolution, diagnostics, and view evaluation in shared Forma operations.

## In Scope

- Define editor extension responsibilities and non-responsibilities.
- Define workspace discovery, binary invocation, lifecycle, cancellation, and version boundaries.
- Define the shared operation needs for saved-reference navigation and Markdown-backed view preview.
- Define status, diagnostics, source navigation, theme bridging, and WebView responsibilities.
- Identify shared TypeScript contract and renderer boundaries without coupling shared code to one editor API.
- Split VS Code and Zed implementation follow-ups.

## Out Of Scope

- Implementing either extension.
- Selecting the final Graph renderer without an evidence-backed spike.
- Direct file rewrites from editor extension commands.
- Marketplace packaging or publishing policy.

## Acceptance Criteria

- The adapter contract states what belongs in Forma Core versus editor adapters.
- VS Code and Zed MVP tasks can share the same behavior model.
- Required RPC/CLI capabilities are listed.
- Workspace discovery, security, transport, theme, source-preview, and lifecycle boundaries are explicit.

## Relationship Notes

Delivered by [[architecture/editor-extension-adapter-contract]], with the product interaction boundary in [[design/editor-extension-mvp-design]] and sequencing in [[planning/editor-extension-mvp-roadmap]]. It unblocks the VS Code MVP.

## Validation Notes

- Kept Core as the owner of configuration, references, diagnostics, and view evaluation.
- Selected short-lived structured CLI calls as the initial transport baseline without making it a permanent constraint.
- Identified `reference.resolve` and view body/mount source mapping as the main shared contract gaps.
- Defined source-first view preview, editor theme tokens, Graph renderer spike criteria, security, compatibility, and test boundaries.
