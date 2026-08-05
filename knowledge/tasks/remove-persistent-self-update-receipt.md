---
schemaVersion: 1
kind: task
scope: project
title: "Remove persistent self-update receipt"
summary: "Keep Forma install-script deployments single-file at rest while retaining verified, recoverable explicit self-update transactions."
type: task
priority: P1
value: H
module: cli
effort: S
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - cli
    - distribution
    - updates
blockedBy: []
relatedTo:
    - "decisions/adopt-self-replace-for-forma-cli-updates"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: "CLI installation, self-update transaction recovery, install scripts, and public documentation"
---

# Remove persistent self-update receipt

## Goal

Keep official install-script deployments single-file at rest without weakening exact-release verification, explicit update approval, or recoverable executable replacement.

## Sources

- [Adopt Self Replace For Forma CLI Updates](../decisions/adopt-self-replace-for-forma-cli-updates.md)

## In Scope

- Stop creating or depending on the adjacent `forma.install.json` receipt.
- Treat explicit self-update invocation and confirmation as authority to replace the running executable.
- Keep recovery metadata transient and remove it after successful update or rollback.
- Leave existing receipt files untouched.
- Align install scripts, CLI output, tests, and active documentation.

## Out of Scope

- Inferring an installation manager from executable paths.
- Automatically invoking mise, WinGet, or editor package management.
- Removing receipt files created by Forma v0.1.29.
- Passive update notifications or background updates.

## Acceptance Criteria

- A fresh official-script installation leaves only the Forma executable in the install directory.
- Reinstalling over a directory containing `forma.install.json` leaves that file unchanged.
- An explicitly confirmed self-update can replace any supported standalone Forma executable.
- Transaction journal, staging, backup, and lock files exist only while needed for update or recovery.
- The complete repository gate and configured workspace health pass.

## Implementation Evidence

Implemented locally on 2026-07-30 for inclusion in the next coordinated Forma release:

- the Unix and Windows installers validate the installed binary without creating, reading, overwriting, or deleting a receipt;
- self-update uses the compiled official repository identity and the running binary version;
- explicit invocation and confirmation replace persistent installation ownership;
- `.forma-update.json` records only an active or interrupted update transaction and is removed with staging, backup, and lock artifacts after reconciliation;
- the successful self-update JSON contract advances to schema version 2 and removes `installationOwner`;
- a live exact-release `--reinstall --check --json` without a receipt reports `canApply: true`;
- focused CLI and cross-platform installer tests pass;
- `mise run check` passes.

The installer change and the first receipt-free CLI release should be published as one coordinated release. Forma v0.1.29 still requires its receipt to apply an update, so this source change should not be pushed to `main` as an isolated installer-only delivery.
