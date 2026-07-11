---
schemaVersion: 1
kind: task
scope: project
title: Integrate VSIX CI and release artifact
summary: Build, test, checksum, and upload the Forma for VS Code VSIX through pull-request CI and the tag-triggered GitHub Release workflow.
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
    - github-actions
    - vscode
    - release
blockedBy: []
relatedTo:
    - "releases/forma-v0.1.0-alpha.13"
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: GitHub Actions CI and Release workflows
---

# Integrate VSIX CI And Release Artifact

## Goal

Make GitHub Actions the authoritative builder of the internally distributed VSIX and publish it with aligned Forma release artifacts.

## Sources

- [[planning/editor-extension-alpha-13-execution-plan]]
- [[releases/forma-v0.1.0-alpha.13]]

## In Scope

- Add an extension CI job that installs frozen dependencies, checks versions, type-checks, lints, runs unit and Extension Host tests, builds, packages, and inspects the VSIX.
- Use appropriate Linux display handling for Extension Host tests.
- Upload the pull-request VSIX as a short-lived Actions artifact for review.
- Add a tag-triggered extension build to the Release workflow.
- Validate the tag against Cargo and extension versions before artifact builds.
- Generate a SHA-256 checksum for the VSIX.
- Include the VSIX and checksum in the existing publish job alongside platform binary archives.
- Keep Marketplace publishing absent.
- Avoid rebuilding the extension once per binary target when one platform-independent package job is sufficient.

## Out Of Scope

- Marketplace publication.
- Remote SSH, Dev Containers, and WSL CI matrices.
- Signing or notarizing the VSIX unless required by observed tooling.

## Acceptance Criteria

- PR CI produces a downloadable VSIX artifact only after extension checks pass.
- A deliberate test or version failure prevents packaging or release.
- Release workflow produces one VSIX and checksum with the expected aligned name.
- The publish job uploads binary archives, binary checksums, VSIX, and VSIX checksum to the prerelease.
- Existing five-platform binary builds remain intact.
- Workflow YAML and local command equivalents are documented and validated where feasible.
