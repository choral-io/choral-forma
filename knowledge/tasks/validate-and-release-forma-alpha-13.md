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
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - release
    - alpha-13
    - validation
blockedBy: []
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

## Current Evidence

- Local full gate: `CI=true mise run check` passed.
- Extension gates: typecheck, strict lint, 19 extension unit tests, package contents, VS Code 1.110 trusted, current stable trusted, and VS Code 1.110 restricted-mode Extension Host tests passed.
- VSIX: `forma-0.1.0-alpha.13.vsix` packaged with extension id `choral-io.forma`, installed into an isolated profile, and activated against a separately built Forma binary.
- UI: source-first list preview was inspected in VS Code dark and light themes; list/table/kanban and Graph deferred commands are covered by Extension Host integration.
- PR: [#1](https://github.com/choral-io/choral-forma/pull/1) merged as `7eb1d49eb0f621018dfbbcc7852a5ae2020764aa` after Knowledge, Web, Rust, and VS Code Extension checks passed in [PR CI run 29152153465](https://github.com/choral-io/choral-forma/actions/runs/29152153465).
- Merged-main gate: the same four jobs passed for merge commit `7eb1d49eb0f621018dfbbcc7852a5ae2020764aa` in [main CI run 29152228755](https://github.com/choral-io/choral-forma/actions/runs/29152228755) before tagging.
- Release: annotated tag `v0.1.0-alpha.13` points to the verified merge commit; [Release workflow run 29152308411](https://github.com/choral-io/choral-forma/actions/runs/29152308411) passed version validation, five binary builds, VSIX build and Extension Host tests, checksum generation, and GitHub prerelease publication.
- Published artifacts: [GitHub prerelease v0.1.0-alpha.13](https://github.com/choral-io/choral-forma/releases/tag/v0.1.0-alpha.13) contains five platform archives, the VSIX, and a checksum file for each payload.
- Downloaded verification: all six payload checksums passed; the released macOS arm64 binary reported `forma 0.1.0-alpha.13`; the released VSIX SHA-256 is `2bbc245e2f40d706afa7628d8f4e7b01baa33d2889067a1201292703ad0e8626` and its manifest reports `choral-io.forma@0.1.0-alpha.13`, `Forma for VS Code`, `https://forma.choral.io`, and VS Code `^1.110.0`.
- Released-package smoke: the exact downloaded VSIX installed into an isolated extension directory as `choral-io.forma@0.1.0-alpha.13` and activated with the downloaded released Forma binary. Automated installed-extension checks passed workspace discovery, ordinary Markdown links, wikilink fragments, embeds, semantic entry references, source opening, and list/table/kanban/Graph preview commands.
- Exact-package UI evidence: direct inspection verified expected list and table entries, Doing and Done kanban columns and cards, the Graph deferred state, editable source, Open Source actions, and dark and light VS Code theme adaptation.
