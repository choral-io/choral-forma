---
schemaVersion: 1
kind: release
title: "Forma v0.1.36"
summary: "Guided Modeling foundation, explicit structured Markdown output, skill routing, configuration diagnostics, and toolchain refresh."
scope: project
type: release
status: unreleased
version: "v0.1.36"
date: 2026-09-09
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - guided-modeling
    - configuration
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.36

## Scope

Publish the next coordinated Public Preview patch after [[releases/forma-v0.1.35]]. The cutline includes the first reviewed Guided Modeling slice, explicit structured Markdown output, discoverable Skill routing, configuration-error provenance, and the coordinated dependency and Vitest 5 baseline refresh.

## Included Changes

- Add the `model`, `prepare`, and `apply` Guided Modeling flow for an initialized empty corpus, one content group, and `Text`, `Date`, and `table` fields.
- Make `structuredMarkdown` explicit in the model output contract and make the `forma-guided-modeling` Skill discoverable with deterministic routing and ordering.
- Preserve configuration-error provenance so diagnostics identify the authored source and location.
- Refresh dependencies and migrate the Vitest benchmark baseline.

Guided Modeling remains intentionally bounded: there is no modeling RPC, existing-content inventory/import, GUI, or complete natural-language inference. The frontmatter closing marker must begin in the first column for compatibility. `gm1` is an unpublished development intermediate and receives no compatibility implementation. The original design Task is not automatically marked complete by this release.

## Validation

### Candidate And Publication

- Candidate commit: to be recorded after version alignment and exact-candidate gates.
- Local gates: `mise run version:check -- v0.1.36`, `CI=true mise run check`, Forma content checks, workspace health, and applicable VSIX packaging/smoke checks.
- Exact-source main CI and the protected Release workflow will be recorded after publication.

### Published Assets And Installation

Published asset inventory, hashes, native CLI version, VSIX identity, managed-install verification, Marketplace publication, and exact workflow links will be recorded after the release workflow completes.

### Editor Runtime And Remaining Boundaries

Record the verified local and CI editor/runtime coverage. Remote SSH, Dev Container, WSL, signing, notarization, Zed Registry publication, non-native execution, and any other untested platform boundaries remain explicitly unverified unless evidence is added here.

## Rollout Plan

1. Align the coordinated version and release content, run the exact-candidate local gates, and commit and push the candidate.
2. Confirm main CI for the exact candidate SHA, then dispatch `.github/workflows/release.yml` with version `0.1.36`.
3. Verify the published assets and managed installation, then record closure evidence in this record and the delivery ledger in a separate post-release commit.

## Migration Or Operations Notes

- The frontmatter closing marker must begin in the first column; indented closing markers are not compatible with this release.
- Guided Modeling currently initializes only an empty corpus with one content group and `Text`, `Date`, and `table` fields. Existing-content inventory/import, modeling RPC, GUI, and complete natural-language inference remain future work.
- `gm1` is a development intermediate and is not a published compatibility format.
- The release remains a Public Preview.

## Release Notes

> Forma 0.1.36 adds the first bounded Guided Modeling workflow, explicit structured Markdown output, discoverable Skill routing, configuration diagnostics, and a refreshed Vitest 5 toolchain baseline.

## Rollback Plan

Before publication, remediate the candidate and repeat its exact-source gates. After publication, preserve the immutable tag and assets and publish a higher coordinated version for corrections. Use the official installer as the recovery path.

## Post-Release Follow-Up

Complete this record and the delivery ledger only after the protected release workflow and executable post-release verification succeed. Do not change the immutable release tag.
