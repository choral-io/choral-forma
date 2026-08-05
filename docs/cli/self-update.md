---
id: cli.self-update
title: forma self-update
summary: Check for or install a checksum-verified Forma CLI release.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma self-update
order: 65
---

# forma self-update

## Overview

`forma self-update` resolves a published Forma GitHub Release, selects the exact standalone binary for the running platform, verifies its sibling `.sha256` checksum and reported version, and replaces the current executable through a recoverable staging flow.

Self-update is an explicit CLI Host operation. It does not read a workspace, change Markdown content, run during ordinary Forma commands, or update editor-managed Forma binaries.

## CLI Help

```text
forma self-update [VERSION] [--check] [--yes] [--reinstall]
                         [--allow-downgrade] [--json]
```

- Omit `VERSION` to select the newest eligible published release.
- Supply an exact SemVer such as `0.1.29` or `v0.1.29` to select that release.
- Use `--check` to inspect release state without downloading or replacing Forma.
- Use `--yes` only when a noninteractive caller has already obtained update approval.
- Use `--reinstall` with an exact `VERSION` to replace the same version.
- Use `--allow-downgrade` with an exact lower `VERSION` to acknowledge the version direction.
- Use `--json` for the version, asset, applicability, and diagnostic contract.

Branches, commits, arbitrary URLs, channels, and caller-selected asset paths are not accepted.

## Update Authority And Installation State

Explicitly invoking `forma self-update` and confirming the selected version authorizes Forma to replace the running executable. Forma does not infer an installation manager from an executable path, environment layout, or persistent receipt.

The official `install.sh` and `install.ps1` scripts keep the steady-state installation single-file. If mise, WinGet, an editor, or another package manager manages Forma, prefer that manager's update lifecycle so its version records remain consistent. Forma does not automatically invoke or coordinate with those managers.

## Verification And Recovery

Before replacement, Forma validates the Release identity, exact platform asset, checksum asset, downloaded digest, executable permissions, and staged binary version. It records an adjacent transient transaction journal and recovery backup before invoking the cross-platform executable replacement layer, then verifies the installed version.

The journal, staging file, backup, and lock are removed after successful replacement or rollback. If the process stops while an update is pending, the next `forma self-update` reconciles the transaction against the version of the running executable and removes the transient files. A power or filesystem failure that prevents both replacement and recovery may still require rerunning the install script.

## Supported Release Targets

Self-update follows the same standalone binary matrix as a Forma Release:

- Linux x64 and Arm64 using the GNU environment;
- macOS x64 and Arm64;
- Windows x64 using MSVC.

Unsupported targets fail closed until the Release matrix defines an exact matching asset contract; Forma does not substitute a similarly named artifact.
