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
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers:
    - "members/tiscs"
tags:
    - forma
    - product-value
    - compatibility
    - editor-extension
    - protocol
    - release
blockedBy: []
relatedTo:
    - "planning/forma-product-value-gap-roadmap"
    - "architecture/editor-extension-adapter-contract"
    - "decisions/define-cli-editor-compatibility-window"
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

## Proposed Contract

The workspace-independent probe is `forma compatibility --json`. Its versioned response reports the package version and release tag, independent `forma.cli.json` and `forma.lsp` protocol ranges, and immutable capability identifiers with schema versions. The adapter declares its own supported ranges plus required and optional capabilities. Package equality remains release identity and a diagnostic hint, not the negotiated compatibility decision.

Compatibility requires an overlap for every required protocol and a supported version for every required capability. The selected protocol is the highest common revision; optional capabilities are enabled only when present. Every subsequent CLI JSON result and LSP message remains validated against its own operation schema.

## Selection And Fallback Matrix

| Adapter | CLI | Result |
| --- | --- | --- |
| N | N | compatible |
| N+1 | N | compatible when ranges/capabilities overlap; warn about previous package |
| N | N+1 | compatible when the adapter range still overlaps; warn about newer package |
| N+1 | N-1 | reject when the two-release bridge no longer overlaps |
| any | legacy equal package | accept through exact-version fallback with a legacy warning |
| any | malformed, unknown, or missing required data | reject safely with an actionable instruction |

Managed acquisition still prefers the exact extension release and keeps exact asset/checksum identity. A previously installed compatible candidate requires explicit user selection; negotiation must not introduce automatic downgrades, remote manifests, telemetry, or revocation.

## Validation Sequence

The first implementation must add fixtures for current/current, current/previous, previous/current, rejected, legacy-equal, and malformed responses in VS Code and Zed adapter tests. Release verification must run the probe against each shipped CLI artifact and exercise LSP initialization with the selected revision, while retaining the existing exact artifact and SHA-256 checks. Package-version tests alone are insufficient evidence.

## Result

The compatibility contract, safe fallback, two-release bridge, managed-binary boundary, and release evidence matrix are defined. Negotiation and the `forma compatibility --json` command remain intentionally unimplemented and are the next implementation slice after this design review.
