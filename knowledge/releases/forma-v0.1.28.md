---
schemaVersion: 1
kind: release
title: "Forma v0.1.28"
summary: "Corrective release for cross-platform canonical-doc parsing and stable release gates."
scope: project
type: release
status: released
version: "v0.1.28"
date: 2026-07-29
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - corrective
    - cross-platform
    - workflow
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.28

## Scope

Publish the complete [[releases/forma-v0.1.26]] feature cutline through a new immutable tag after [[releases/forma-v0.1.27]] corrected the Windows WebApp shell incompatibility but exposed later release gates. The candidate retains the static publishing, resolved workspace operations, runtime performance, Agent Skill, CLI, WebApp, VS Code, Zed, and compatible dependency changes prepared for the preceding attempts.

## Included Changes

- Parse canonical-document frontmatter through the same line-oriented implementation used by Forma runtime Markdown, accepting both LF and CRLF without maintaining a divergent build-only parser.
- Cover LF, CRLF, and body-thematic-break boundaries with focused Core regression tests.
- Retry a complete 50-sample warm VSIX performance distribution only when its first p95 exceeds the accepted budget; fail when the repeated distribution also breaches the budget so deterministic regressions remain blocked.
- Add an exact Windows release-binary build to main CI so cross-platform build failures are rejected before a commit can become a tagged release candidate.
- Carry forward the complete `v0.1.26` and `v0.1.27` Public Preview scope because neither immutable tag reached GitHub Release or Marketplace publication.

## Validation

1. Focused Core frontmatter, release-contract, extension type, format, and lint gates pass.
2. `mise run version:check -- v0.1.28` and `CI=true mise run check` pass from the exact candidate.
3. Forma content checks and workspace health pass.
4. The matching `forma-0.1.28.vsix` packages and passes its isolated installation, activation, functional navigation, and repeated-breach performance smoke gate.
5. The complete candidate is pushed and main CI passes for its exact commit, including the new Windows release build, before tagging.
6. The tag-triggered Release workflow builds every supported CLI asset and the VSIX.
7. `mise run release:verify -- v0.1.28` verifies the published asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Rollout Plan

- Create an annotated `v0.1.28` tag only after exact-source local and main gates pass.
- Let the protected Release workflow publish GitHub assets and the verified VSIX to Marketplace.
- Keep the failed `v0.1.26` and `v0.1.27` tags immutable and do not create releases from them.

## Migration Or Operations Notes

- Existing Forma workspace content does not require migration.
- Consumers who did not receive `v0.1.26` or `v0.1.27` should upgrade directly from `v0.1.25` to `v0.1.28`.
- Main-branch static-site deployment remains independent from the versioned CLI and editor-extension release.

## Release Notes

> Forma `v0.1.28` publishes the full static-site, runtime-performance, resolved-workspace, and Agent Skill update with release gates hardened against Windows line endings and transient shared-runner scheduling pauses.

## Release Evidence

- Immutable tag: `v0.1.28` at candidate commit `3bf6bb43d164677c1cf2f795bc9416a298a08a61`.
- Candidate main CI: [run 30441907347](https://github.com/choral-io/choral-forma/actions/runs/30441907347) passed for that exact commit, including the Windows release build.
- Final GitHub Release, published-release verification, and Marketplace publication: [run 30442370720](https://github.com/choral-io/choral-forma/actions/runs/30442370720) passed. The Marketplace job published the smoke-tested VSIX through GitHub OIDC.
- Published release: [Forma v0.1.28](https://github.com/choral-io/choral-forma/releases/tag/v0.1.28) is non-draft, non-prerelease, and has the expected 22 assets.
- `mise run release:verify -- v0.1.28` passed on macOS ARM64: `forma-macos-arm64` reports `forma 0.1.28` with SHA-256 `82db77ad1b0497f038a1451823fc7d0fd458a93cfaa1b8a555653b29d1c12723`; `choral-io.forma@0.1.28` reports engine `^1.110.0` with SHA-256 `be2886cfc173f8464acab73577f80b2aeef0c78caec0ff114d2028e28b209389`; managed install also executed `forma 0.1.28`.
- The Release workflow's Linux Extension Host and packaged-VSIX smoke passed. A separate local attempt to launch VS Code from Codex aborted in macOS application registration before extension loading, so it is recorded as a local GUI-launch boundary rather than product evidence.
- Remote SSH, Dev Container, WSL, signing, and notarization remain untested.

## Rollback Plan

Do not move or overwrite `v0.1.26`, `v0.1.27`, `v0.1.28`, Marketplace versions, or verified release assets. If publication or post-release verification finds another blocker, publish a higher coordinated version after remediation.

## Post-Release Follow-Up

- Continue the planned WebApp code-splitting work for the largest generated chunks.
