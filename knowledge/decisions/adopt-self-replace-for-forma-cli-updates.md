---
schemaVersion: 1
kind: note
title: "Adopt Self Replace For Forma CLI Updates"
summary: "Use self-replace as the cross-platform executable replacement layer while Forma owns release identity, verification, installation ownership, recovery, and CLI contracts."
scope: project
type: decision
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - distribution
    - updates
    - installation
sources:
    - "architecture/forma-core-technical-direction"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/manage-vscode-forma-cli-lifecycle"
---

# Adopt Self Replace For Forma CLI Updates

## Decision

Forma CLI self-update uses `self-replace` only as the cross-platform executable-replacement layer. Forma owns release discovery, exact version and asset selection, checksum verification, installation ownership, confirmation, structured output, recovery state, and update notifications.

The feature is a CLI Host and distribution capability. It is not a workspace operation, Forma Core primitive, RPC operation, WebApp capability, or editor-managed binary lifecycle.

Implementation and release-gate coverage are tracked in [Add owned Forma CLI self-update](../tasks/add-owned-forma-cli-self-update.md).

## CLI Contract

The explicit update surface is:

```text
forma self-update [VERSION] [--check] [--yes] [--reinstall]
                         [--allow-downgrade] [--json]
```

- Omitting `VERSION` selects the newest eligible published release.
- `VERSION` accepts normalized SemVer with or without the GitHub tag's leading `v`.
- A same-version replacement requires an exact `VERSION` plus `--reinstall`.
- A lower target version requires an exact `VERSION` plus `--allow-downgrade`.
- Branches, commits, arbitrary URLs, and caller-selected asset paths are not accepted.
- Normal workspace commands do not perform network requests as part of this first implementation.

## Installation Ownership

Only an adjacent, valid `forma.install.json` receipt with manager `forma-install-script` authorizes in-place replacement. The official `install.sh` and `install.ps1` scripts create this receipt.

The stable receipt fields are `schemaVersion`, `manager`, `repository`, and `installedVersion`. A transient `pendingUpdate` object may additionally record source and target versions plus adjacent backup and staging file names while replacement is in progress.

Installations managed by mise, WinGet, an editor extension, another package manager, or an unknown/manual process may check for releases but are not overwritten. Forma does not infer installation ownership from a path name, environment layout, or Git state.

Editor-managed Forma binaries retain their existing exact-release, checksum-verified, versioned-storage lifecycle and do not participate in CLI self-update.

## Verification And Replacement

The updater resolves an exact platform-specific standalone release asset and its exact sibling `.sha256` asset. Before replacement it:

1. validates Release identity and published state;
2. downloads into an adjacent staging file;
3. strictly validates the checksum entry and payload digest;
4. restores executable permissions where required;
5. runs the staged executable with `--version`;
6. records pending state and a recovery backup;
7. calls `self-replace`;
8. verifies the executable now published at the original path;
9. commits or restores the receipt and backup state.

Power loss in the final replacement window may still require installer-assisted recovery. A permanent launcher and unconditional crash-safe rollback remain deferred until observed demand justifies their additional runtime and distribution complexity.

## Deferred

Passive startup notification, a bounded update-check cache, stronger signed provenance, channel selection, automatic package-manager invocation, and a permanent launcher are separate follow-ups. Machine-readable, LSP, server, editor-managed, and noninteractive surfaces must remain free of unsolicited update output.
