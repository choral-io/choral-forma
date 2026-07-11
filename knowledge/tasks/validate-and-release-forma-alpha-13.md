---
schemaVersion: 1
kind: task
scope: project
title: Validate and release Forma Alpha 13
summary: Complete local validation, reviewable commits, PR CI, merge, tag, GitHub prerelease, and downloaded binary and VSIX verification.
type: task
priority: P1
value: H
module: infra
effort: L
status: backlog
readiness: blocked
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - release
    - alpha-13
    - validation
blockedBy:
    - "tasks/integrate-vsix-ci-release-artifact"
relatedTo:
    - "releases/next-internal-release"
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Alpha 13 cutline, PR, CI, Git tag, GitHub Release, and artifact verification
---

# Validate And Release Forma Alpha 13

## Goal

Prove the complete Alpha 13 cutline locally and through GitHub Actions, then publish and verify aligned binary and VSIX artifacts.

## Sources

- [[planning/editor-extension-alpha-13-execution-plan]]
- [[releases/next-internal-release]]

## In Scope

- Run every local gate in the execution plan before the first push, including full repository checks and disposable VSIX install smoke.
- Review the final diff for unrelated changes, secrets, generated files, package contents, task evidence, and release scope.
- Create reviewable commits using required commit prefixes on `codex/vscode-extension-alpha13`.
- Push the branch, create a ready PR, monitor required checks, inspect logs, fix failures, and rerun until green.
- Merge when checks pass and no required human review or branch protection blocks it.
- Confirm merged-main CI passes before tagging.
- Tag the intended merge commit as `v0.1.0-alpha.13` and push the tag.
- Monitor the Release workflow, repair release defects within scope, and verify the GitHub prerelease.
- Download and verify release archives, checksums, binary version, VSIX checksum, manifest version, installation, activation, discovery, navigation, and View preview smoke.
- Record exact validation evidence and final task/release states without claiming unrun checks.

## Out Of Scope

- Marketplace upload.
- Graph renderer implementation.
- Broad product additions discovered during validation.
- Bypassing required human review or branch protection.

## Acceptance Criteria

- Local validation is complete before push and exact commands/results are recorded.
- PR and merged-main CI pass at the intended cutline.
- Commit history is reviewable and excludes unrelated pre-Goal dependency cleanup.
- GitHub prerelease `v0.1.0-alpha.13` contains all expected binary archives, checksums, VSIX, and VSIX checksum.
- Released binary and VSIX report aligned `0.1.0-alpha.13` versions.
- Downloaded VSIX installs and activates against a separately installed released Forma binary.
- The extension smoke covers workspace discovery, reference navigation, list/table/kanban preview, theme behavior, and Graph deferred state.
- Release and related tasks are moved to final states only after evidence supports them.

## Stop Rule

If required review blocks merge, leave the PR green and ready. If credentials or GitHub service state blocks push, merge, tag, or release, record the exact blocker and do not fabricate release evidence.
