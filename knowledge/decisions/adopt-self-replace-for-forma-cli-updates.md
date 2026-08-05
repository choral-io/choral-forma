---
schemaVersion: 1
kind: note
title: "Adopt Self Replace For Forma CLI Updates"
summary: "Use self-replace as the cross-platform executable replacement layer while Forma owns release identity, verification, explicit authorization, transient recovery, and CLI contracts."
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

Forma CLI self-update uses `self-replace` only as the cross-platform executable-replacement layer. Forma owns release discovery, exact version and asset selection, checksum verification, confirmation, structured output, transient recovery state, and update notifications.

The feature is a CLI Host and distribution capability. It is not a workspace operation, Forma Core primitive, RPC operation, WebApp capability, or editor-managed binary lifecycle.

The original v0.1.29 implementation is recorded in [Add owned Forma CLI self-update](../tasks/add-owned-forma-cli-self-update.md). The single-file installation correction is tracked in [Remove persistent self-update receipt](../tasks/remove-persistent-self-update-receipt.md).

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

## Update Authority And Installation State

Explicit invocation and confirmation authorize Forma to replace the running executable. A noninteractive caller must obtain approval before passing `--yes`. Forma does not persist or infer an installation owner.

The official install scripts leave only the Forma executable in the install directory after a fresh installation. The official repository identity is compiled into Forma, and the installed version comes from the running executable.

The same standalone binary may be installed by an official script, copied manually, or managed by mise, WinGet, an editor, or another package manager. Distinguishing those cases would require external persistent state, manager-specific binaries, or unreliable path inference. Forma instead recommends using the existing manager's update lifecycle while keeping an explicitly confirmed self-update available.

Adjacent `forma.install.json` files created by v0.1.29 are legacy inert files. New install scripts and self-update code neither read, overwrite, nor delete them.

Editor-managed Forma binaries retain their existing exact-release, checksum-verified, versioned-storage lifecycle. Editor adapters do not invoke CLI self-update automatically.

## Verification And Replacement

The updater resolves an exact platform-specific standalone release asset and its exact sibling `.sha256` asset. Before replacement it:

1. validates Release identity and published state;
2. downloads into an adjacent staging file;
3. strictly validates the checksum entry and payload digest;
4. restores executable permissions where required;
5. runs the staged executable with `--version`;
6. records a transient transaction journal and recovery backup;
7. calls `self-replace`;
8. verifies the executable now published at the original path;
9. removes the journal, staging file, backup, and lock after success or rollback.

If an update stops after the transaction is written, the next explicit self-update reconciles the journal against the running binary version and removes the transient files. Power loss in the final replacement window may still require installer-assisted recovery. A permanent launcher and unconditional crash-safe rollback remain deferred until observed demand justifies their additional runtime and distribution complexity.

## Deferred

Passive startup notification, a bounded update-check cache, stronger signed provenance, channel selection, automatic package-manager invocation, and a permanent launcher are separate follow-ups. Machine-readable, LSP, server, editor-managed, and noninteractive surfaces must remain free of unsolicited update output.
