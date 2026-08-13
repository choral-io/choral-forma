---
schemaVersion: 1
kind: note
title: "Define CLI And Editor Compatibility Window"
summary: "Replace exact CLI and editor package equality with an explicit protocol and capability contract while retaining a safe legacy fallback."
scope: project
type: decision
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - editor-extension
    - compatibility
    - protocol
sources:
    - "architecture/editor-extension-adapter-contract"
    - "tasks/design-cli-editor-compatibility-window"
    - "tasks/manage-vscode-forma-cli-lifecycle"
    - "planning/forma-product-value-gap-roadmap"
---

# Define CLI And Editor Compatibility Window

## Decision

Forma adapters will eventually negotiate compatibility from a workspace-independent CLI capability response. Package version remains release identity and an upgrade hint; it is not the sole compatibility gate once the response is available. The first implementation is deliberately deferred until the contract has fixture coverage in both VS Code and Zed.

The proposed command is:

```text
forma compatibility --json
```

It has no workspace or network dependency and returns a schema-validated document like:

```json
{
    "schemaVersion": 1,
    "package": { "version": "0.1.30", "releaseTag": "v0.1.30" },
    "protocols": {
        "cliJson": { "id": "forma.cli.json", "min": 1, "max": 1 },
        "lsp": { "id": "forma.lsp", "min": 1, "max": 1 }
    },
    "capabilities": [
        { "id": "config.inspect", "version": 1 },
        { "id": "workspace.health", "version": 1 },
        { "id": "view.render", "version": 1 },
        { "id": "lsp.navigation", "version": 1 }
    ]
}
```

The adapter owns its contract declaration: supported protocol ranges, required capability identifiers, optional capability identifiers, and the adapter package version. A result is selected as follows:

1. A protocol range must overlap for every protocol the adapter requires. The selected revision is the highest common revision.
2. Every required capability must be present at a supported version. Optional capabilities are enabled only when present and compatible.
3. Package versions are reported for diagnostics. A compatible previous release receives a compatibility warning, not a failure.
4. Unknown, malformed, or incomplete responses fail closed with the command source and an actionable upgrade or explicit-path instruction.

The command is a compatibility probe, not a replacement for operation schemas. Each structured CLI result and LSP message remains validated against its own schema after the probe succeeds.

## Legacy And Managed Binary Behavior

Adapters first try the capability response. A CLI that does not recognize `compatibility --json` follows the existing exact-package-version fallback: an equal package version is accepted with a legacy warning, and a mismatch is rejected with an actionable message. An explicit `forma.path` remains authoritative for command selection, but it does not make a malformed structured response safe to interpret.

Managed acquisition keeps exact release identity, asset names, checksums, and versioned storage. The preferred candidate is the extension's exact release. A previously installed compatible candidate may be selected only after an explicit user action; compatibility negotiation must not introduce automatic downgrades, remote manifests, or silent replacement of a user-managed binary.

## Two-Release Bridge And Release Matrix

The first compatibility window is a two-release bridge:

| Adapter | CLI | Expected result | Evidence |
| --- | --- | --- | --- |
| N | N | compatible, no warning | current/current fixture |
| N+1 | N | compatible when protocol and required capabilities overlap; warn about previous package | current/previous fixture |
| N | N+1 | compatible when the adapter's range still overlaps; warn about newer package | previous/current fixture |
| N+1 | N-1 | reject when the bridge no longer overlaps | rejected fixture |
| any | legacy equal package | accept through legacy fallback; emit warning | legacy fixture |
| any | malformed or missing required capability | reject safely | malformed/rejected fixture |

Every release candidate keeps the existing exact asset and SHA-256 verification. It additionally runs the capability probe against the adapter contract fixtures for each shipped CLI artifact and exercises the LSP initialization path with the selected protocol revision. A release may not claim a compatibility window from package-version tests alone.

## Boundaries

This decision does not implement the command, protocol negotiation, remote manifests, telemetry, revocation, automatic downgrade, or decoupled release versioning. Those remain follow-up implementation work after the contract fixtures and cross-surface capability matrix are accepted.
