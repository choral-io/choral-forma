---
scope: project
title: Release Execution And Verification
summary: Repository-specific procedure for validating a Forma release candidate, publishing an immutable tag, verifying released assets, and recording closure evidence.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - release
    - validation
    - agents
skill:
    id: release-execution-and-verification
    title: Release Execution And Verification
    description: Use when an Agent prepares a Forma version bump, release candidate, tag, GitHub Release, published-asset verification, or post-release evidence update.
    triggers:
        - prepare Forma release
        - verify release candidate
        - create release tag
        - publish GitHub Release
        - verify release assets
        - update release evidence
    order: 35
sources:
    - "guidelines/forma-workspace-operations"
    - "guidelines/proposal-and-dry-run"
    - "tasks/align-forma-release-versioning"
    - "tasks/integrate-vsix-ci-release-artifact"
---

# Release Execution And Verification

## Purpose

This guideline defines the repository-specific release path for coordinated Forma CLI and editor-extension versions. It keeps candidate validation, tag publication, GitHub Release assets, post-release verification, and durable evidence distinct.

It does not define Forma product behavior for user workspaces. It does not authorize a release: version, tag, push, publication, release-record, and task-state changes require explicit maintainer approval.

## Agent Skill

### When To Use

Use this skill for:

- release version planning or aligned version changes;
- candidate readiness and cutline evaluation;
- tag creation or GitHub Release publication;
- released CLI, archive, checksum, or VSIX verification;
- post-release evidence and related task closure.

### Bootstrap

Run or confirm:

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- `cargo run -q -p forma-cli -- skills get release-execution-and-verification`

Inspect the target release record and related tasks before changing the candidate, status, tag, or evidence. Follow [[guidelines/proposal-and-dry-run]] for authorization and write boundaries.

### Candidate Gates

Before creating a tag:

1. Align Cargo workspace, Cargo lockfile, CLI, VS Code extension, changelog, README, release record, and expected tag through the repository version tasks.
2. Run `mise run version:check -- <tag>`.
3. Run the complete local gate with the repository-pinned tools: `CI=true mise run check`.
4. Run Forma content checks and workspace health.
5. Package and smoke-test the VSIX locally when the release changes the extension or its distribution path.
6. Commit and push the complete candidate.
7. Confirm that main CI passes for the exact candidate commit.

Do not create a release tag from an earlier green commit when the candidate has changed. A failed gate returns the release to the remediation loop.

### Remediation Loop

When any local or CI gate fails:

1. Identify whether the failure is a product defect, repository configuration gap, release-script defect, external service problem, or environment boundary.
2. Fix only within the approved release scope.
3. Add a regression test or executable assertion when the failure can recur.
4. Create a new commit and rerun the relevant focused checks plus the complete candidate gate.
5. Confirm main CI for the new exact HEAD before reconsidering the tag.

Do not bypass a failed check, reuse stale CI evidence, or continue publication because unrelated jobs passed.

### Tag And Publication Rules

- Create an annotated `v<version>` tag only after the exact candidate commit is green.
- Never move, overwrite, or republish a released tag. Publish a new version for corrective changes.
- Observe the tag-triggered Release workflow through concise status queries. Retrieve detailed job logs only when a job fails or stalls.
- Do not mark a release `released` merely because the GitHub Release workflow completed.

### Published Release Verification

After GitHub Release publication, run from the aligned source checkout:

```sh
mise run release:verify -- <tag>
```

The executable gate must verify:

- the release is published with the expected prerelease state;
- the exact workflow-defined asset inventory is present with no missing or unexpected files;
- the current-host standalone CLI and VSIX match their sibling SHA-256 files;
- the downloaded CLI reports the aligned version;
- the VSIX reports the aligned publisher, name, display name, version, and VS Code engine;
- the production editor-extension managed-install implementation downloads, verifies, installs, and executes the current-host CLI from the published release;
- temporary downloads and managed storage are cleaned on success or failure.

If the gate cannot run because of network, platform, authentication, or environment limits, record the limitation and keep the affected release acceptance criterion open. Do not replace this gate with an ad hoc downloader when the repository task is available.

### Evidence And Closure

After verification succeeds:

1. Record the exact candidate commit, main CI run, Release workflow run, GitHub Release URL, asset count, checked hashes, CLI version, VSIX identity, managed-install result, and untested platform boundaries in the release record.
2. Change the release status to `released` only when the approved release criteria are satisfied.
3. Move related tasks to `done` only when their acceptance criteria are supported by recorded evidence.
4. Commit post-release evidence separately. This evidence commit does not change the immutable release tag.
5. Run Forma checks and workspace health after evidence or task metadata changes.

Report checks not run and residual risks explicitly. Remote SSH, Dev Container, WSL, signing, or notarization remain unverified unless the release evidence names a completed test.
