---
schemaVersion: 1
kind: task
scope: project
title: Scaffold VS Code extension package
summary: Add the buildable, testable Node workspace-extension package that anchors the Alpha 13 Goal task chain.
type: task
priority: P1
value: H
module: app
effort: M
status: ready
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - editor-extension
    - alpha-13
blockedBy: []
relatedTo:
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code extension package and development tooling
---

# Scaffold VS Code Extension Package

## Goal

Create the VS Code extension package and development baseline without implementing Forma product behavior.

## Sources

- [[architecture/editor-extension-adapter-contract]]
- [[design/editor-extension-mvp-design]]
- [[planning/editor-extension-alpha-13-execution-plan]]

## In Scope

- Create `packages/vscode-extension` as the pnpm workspace package `@choral-forma/vscode-extension`.
- Use extension id `choral-io.choral-forma` and display name `Choral Forma`.
- Configure a Node `main` entrypoint and `extensionKind: ["workspace"]`; do not add a browser entrypoint.
- Inventory the VS Code APIs needed by Alpha 13, choose the lowest `engines.vscode` version containing those features, and record the rationale.
- Declare limited untrusted-workspace behavior and no virtual-workspace support where the manifest requires it.
- Add TypeScript type checking, esbuild development/production bundles, Vitest unit tests, and Extension Host test scaffolding.
- Add package scripts that participate in root recursive check, build, lint, and test workflows without breaking existing packages.
- Add minimal activate/deactivate wiring and a testable dependency boundary for VS Code APIs.

## Out Of Scope

- Forma binary execution.
- Workspace discovery or status UI.
- Reference navigation or View preview.
- VSIX release packaging.
- Marketplace publication.

## Acceptance Criteria

- The package is discovered by the existing `packages/*` workspace pattern.
- Type check, unit test, development bundle, and production bundle commands pass.
- The bundle externalizes `vscode` and has one valid extension-host entrypoint.
- Extension Host smoke can activate the package in a controlled fixture.
- The minimum VS Code version is justified by used APIs and is not simply pinned to current stable.
- Root checks still recognize shared and WebApp packages.
- Existing pre-Goal dependency and TS/CSS commits are not rewritten or folded into this task.

## Execution Notes

This is the only Ready entry for the Alpha 13 Goal. Move downstream tasks only as their declared blocker completes.
