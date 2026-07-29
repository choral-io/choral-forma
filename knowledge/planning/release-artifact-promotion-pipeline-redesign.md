---
schemaVersion: 1
kind: note
title: "Release Artifact Promotion Pipeline Redesign"
summary: "Replace tag-first release builds with an exact-source, build-once, approval-gated artifact promotion pipeline."
scope: project
type: note
owners:
    - "members/tiscs"
tags:
    - release
    - workflow
    - supply-chain
    - github-actions
sources:
    - "guidelines/release-execution-and-verification"
    - "releases/forma-v0.1.26"
    - "releases/forma-v0.1.27"
    - "releases/forma-v0.1.28"
---

# Release Artifact Promotion Pipeline Redesign

## Outcome

Replace tag-first release builds with a staged promotion pipeline in which one exact `main` commit produces one verified candidate artifact set. A maintainer reviews that candidate before the workflow creates the immutable tag, publishes the same bytes to GitHub Release, verifies the published result, and sends the same VSIX to Visual Studio Marketplace.

The static site remains independent from version publication: a successful `main` workflow automatically deploys the verified static artifact to `forma.choral.io`.

## State Model

1. A release workflow is dispatched from an exact `main` commit with `version` as its only structured identity input.
2. The workflow validates the coordinated repository version, planned release record, exact-source main CI, and absence of conflicting tag or published version.
3. Five platform builds and the VSIX produce the complete candidate artifact set once.
4. An assembly job verifies the expected inventory and checksums and writes a source-bound candidate manifest.
5. The protected production environment pauses before any tag or external publication.
6. After approval, the workflow revalidates the source boundary, creates the annotated tag, and promotes the assembled artifacts without rebuilding.
7. Published-release verification must pass before the same VSIX is published through the Marketplace OIDC identity.
8. Durable release evidence is written in a separate post-release commit.

## Workflow Boundaries

### Main

- Run repository checks for pull requests and `main` pushes.
- Build and verify the static site artifact without deployment on pull requests.
- On a successful `main` push, deploy the verified artifact automatically.
- Expose Cloudflare credentials only to the deployment job.
- Cancel an obsolete in-progress `main` run when a newer commit supersedes it.

### Release Build

- Provide one reusable implementation for the supported CLI target matrix and VSIX candidate.
- Keep build jobs read-only.
- Execute each native CLI before upload where the runner can run the target.
- Generate archives, standalone managed binaries, and sibling SHA-256 files.
- Package and smoke-test the VSIX, including the bounded warm-performance confirmation policy.

### Release Promotion

- Accept only an unprefixed semantic `version`; derive the tag, titles, record path, and artifact identity.
- Bind all artifacts and the candidate manifest to the workflow source commit.
- Require a protected-environment approval after assembly and before tag creation.
- Grant write permissions only to the promotion job.
- Refuse to move a tag, overwrite a mismatched release, or publish artifacts that do not match the candidate manifest.
- Make retry behavior idempotent when an existing tag or release matches the same source and manifest.
- Publish to Marketplace only after GitHub Release verification succeeds.

## Failure Rules

- A failure before promotion creates no tag and no external release.
- A source change on `main` while approval is pending invalidates the candidate.
- A tag created by a partially completed promotion remains immutable.
- A retry may continue only when existing external state matches the exact source and candidate manifest.
- Any mismatched tag, release asset, checksum, or Marketplace identity blocks the run.
- A defect discovered after incompatible external publication requires a higher version.

## Executable Constraints

- Validate workflow syntax with `actionlint`.
- Parse workflow YAML for contract tests instead of depending only on textual regular expressions.
- Reject shell-specific environment assignment in cross-platform package scripts.
- Keep canonical-document parsing shared between build-time and runtime code and cover LF and CRLF.
- Unit-test the performance distribution policy independently from the Extension Host.
- Verify the exact release asset inventory, CLI versions, VSIX identity, managed install, and checksums after publication.

## Acceptance Criteria

1. Pull-request workflows cannot deploy the site or publish release assets.
2. A successful `main` push automatically deploys its verified static artifact without a version release.
3. The release workflow exposes `version` as its only release identity input.
4. All supported CLI targets and the VSIX are built exactly once in the release run.
5. No tag or release exists before production approval.
6. The annotated tag points to the exact candidate commit.
7. GitHub Release contains exactly the candidate artifacts and no rebuild.
8. Published-release verification passes before Marketplace publication.
9. A partial publication can resume only with matching source and manifest evidence.
10. Complete local repository and Forma gates pass, followed by a successful non-publishing or rejected-promotion rehearsal before the next version release.

## Non-Goals

- This change does not introduce code signing or platform notarization.
- It does not automatically edit release records or task metadata from GitHub Actions.
- It does not treat the repository's release workflow configuration as a Forma product built-in.
- It does not store Agent execution timing, model, session, or cost data in shared project content.
