---
schemaVersion: 1
kind: task
scope: project
title: Align Forma release versioning
summary: Establish and enforce one Alpha 13 version across Cargo, binary, VSIX, release record, tag, and release artifacts.
type: task
priority: P1
value: H
module: infra
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - versioning
    - release
    - alpha-13
blockedBy: []
relatedTo:
    - "releases/forma-v0.1.0-alpha.13"
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Cargo, CLI, VSIX, release, and tag version identity
---

# Align Forma Release Versioning

## Goal

Make all Forma release artifacts report and validate the same version instead of relying on a prerelease tag while the binary reports `0.1.0`.

## Sources

- [[releases/forma-v0.1.0-alpha.13]]
- [[planning/editor-extension-alpha-13-execution-plan]]

## In Scope

- Set the Cargo workspace release version to `0.1.0-alpha.13` for the candidate.
- Set the VS Code extension manifest version to `0.1.0-alpha.13`.
- Keep the Git tag and release record form as `v0.1.0-alpha.13`.
- Ensure `forma --version` reports the aligned prerelease version.
- Add a machine-readable version consistency check used locally and in CI.
- Validate the expected tag against Cargo and extension manifests in the Release workflow.
- Document that all Forma release artifacts use a coordinated version line while package ecosystems retain their required formatting.
- Update install and version examples that must identify the current candidate at release time.

## Out Of Scope

- Independent extension versioning.
- Marketplace-specific prerelease channels.
- Redesigning semantic versioning after the Alpha series.

## Acceptance Criteria

- One check fails on deliberate Cargo, extension, release, or tag mismatches.
- Cargo metadata and the built binary report `0.1.0-alpha.13`.
- VSIX manifest reports `0.1.0-alpha.13` and `choral-io.forma`.
- Release workflow rejects a mismatched tag before building artifacts.
- Existing installers continue to use the `v0.1.0-alpha.13` GitHub tag and normalized mise version where applicable.
