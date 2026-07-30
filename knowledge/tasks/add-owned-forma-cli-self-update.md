---
schemaVersion: 1
kind: task
scope: "project"
title: "Add owned Forma CLI self-update"
summary: "Add an explicit release-scoped checksum-verified self-update flow for install-script-owned Forma CLI binaries."
type: "task"
priority: "P1"
value: "H"
module: "cli"
effort: "M"
status: "done"
readiness: "ready"
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - "forma"
    - "cli"
    - "distribution"
    - "updates"
blockedBy: []
relatedTo:
    - "decisions/adopt-self-replace-for-forma-cli-updates"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: "CLI distribution, install ownership, release verification, and cross-platform executable replacement"
---

# Add owned Forma CLI self-update

## Goal

Let install-script users explicitly check for and install an exact, verified Forma Release without giving the CLI authority over package-manager or editor-managed installations.

## Sources

- [Adopt Self Replace For Forma CLI Updates](../decisions/adopt-self-replace-for-forma-cli-updates.md)

## In Scope

- Release discovery and exact SemVer selection.
- Platform asset and checksum verification.
- Install-script ownership receipts, confirmation, JSON output, replacement, and recovery.
- Unix, Windows, CLI, and release-matrix regression coverage.

## Out of Scope

- Passive startup update notices.
- Automatic mise, WinGet, or editor-extension updates.
- Channels, arbitrary assets, commits, branches, and custom download URLs.

## Acceptance Criteria

- Official install scripts write a versioned ownership receipt beside Forma.
- `forma self-update` can check latest or exact releases and applies only to an owned installation.
- Same-version replacement and downgrade require explicit version-direction flags.
- Interrupted replacement is recoverable or diagnosable without guessing installation ownership.
- The complete repository gate and configured workspace health pass.
