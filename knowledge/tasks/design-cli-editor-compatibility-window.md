---
schemaVersion: 1
kind: task
scope: project
title: Design CLI And Editor Compatibility Window
summary: Define protocol and capability negotiation so editor adapters can accept bounded compatible CLI versions.
type: task
priority: P1
value: H
module: adapter
effort: M
status: backlog
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - product-value
    - compatibility
    - editor-extension
blockedBy: []
relatedTo:
    - "planning/forma-product-value-gap-roadmap"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/manage-vscode-forma-cli-lifecycle"
    - "tasks/implement-zed-extension-mvp"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code and Zed adapter compatibility with Forma CLI
---

# Design CLI And Editor Compatibility Window

## Goal

Define a bounded compatibility model based on adapter protocols and capabilities instead of exact CLI and extension package equality.

## Observed Baseline

VS Code and Zed compare `forma --version` with the adapter package version. VS Code manages exact-tag binaries, and current CI validates only the coordinated current extension and CLI.

## In Scope

- Define a workspace-independent compatibility result with package version, transport protocol revisions, and immutable capability identifiers.
- Define adapter min/max protocols plus required and optional capabilities.
- Preserve exact-version fallback for legacy CLIs that cannot negotiate.
- Define managed-binary candidate selection, warning/upgrade UX, and explicit-path authority.
- Define the two-release bridge and cross-version fixture matrix for VS Code and Zed.

## Out Of Scope

- Implementing negotiation.
- Decoupling coordinated release versioning immediately.
- Remote compatibility manifests, telemetry, revocation services, or automatic downgrades.
- Claiming compatibility with a release that lacks the handshake.

## Acceptance Criteria

- The contract distinguishes package, CLI JSON protocol, LSP protocol, and capabilities.
- Legacy and incompatible behavior fails safely and actionably.
- The staged sequence proves current/current, current/previous, previous/current, and rejected combinations.
- Release verification retains exact artifact identity while adding protocol/capability checks.
- The accepted design unblocks [[tasks/define-cross-surface-capability-matrix]].
