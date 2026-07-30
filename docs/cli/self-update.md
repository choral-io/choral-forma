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
- Use `--check` to inspect release and installation state without downloading or replacing Forma.
- Use `--yes` only when a noninteractive caller has already obtained update approval.
- Use `--reinstall` with an exact `VERSION` to replace the same version.
- Use `--allow-downgrade` with an exact lower `VERSION` to acknowledge the version direction.
- Use `--json` for the version, asset, ownership, applicability, and diagnostic contract.

Branches, commits, arbitrary URLs, channels, and caller-selected asset paths are not accepted.

## Installation Ownership

Only installations created by the official `install.sh` or `install.ps1` scripts can update themselves in place. Those scripts write `forma.install.json` beside the executable with the installation manager, repository, and version.

Forma installations managed by mise, WinGet, an editor extension, another package manager, or manual copying may use `forma self-update --check`, but Forma will direct their actual update back to that manager. Forma never infers ownership from an install path.

## Verification And Recovery

Before replacement, Forma validates the Release identity, exact platform asset, checksum asset, downloaded digest, executable permissions, and staged binary version. It records a recovery backup and pending receipt before invoking the cross-platform executable replacement layer, then verifies and commits the installed version.

If the process stops after replacement but before receipt finalization, the next `forma self-update` reconciles the pending receipt against the version of the running executable. A power or filesystem failure that prevents both replacement and recovery may still require rerunning the install script.

## Supported Release Targets

Self-update follows the same standalone binary matrix as a Forma Release:

- Linux x64 and Arm64 using the GNU environment;
- macOS x64 and Arm64;
- Windows x64 using MSVC.

Unsupported targets fail closed until the Release matrix defines an exact matching asset contract; Forma does not substitute a similarly named artifact.
