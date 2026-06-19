---
scope: project
type: task
priority: P1
severity:
value: M
module: infra

owners:
    - "members/Tiscs"
assignees:
    - "members/Tiscs"
reviewers: []
tags:
    - forma
    - p0
    - ci
    - release

effort: M
status: done
readiness: ready
sprint:

blocked_by:
    - "tasks/scaffold-forma-workspace"
    - "tasks/implement-read-only-webapp"
related_to:
    - "decisions/forma-p0-core-architecture"
    - "architecture/forma-core-technical-direction"

reported_by:
affected_area: CI and release distribution
---

# Implement CI Release Baseline

## Goal

Add the P0 CI and release packaging baseline for the single `forma` binary and development workspaces.

## Sources

- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-core-technical-direction]]

## Context

P0 distribution should prioritize standalone binaries, install scripts, and mise GitHub backend support. End users should not need a Node or frontend runtime for released builds.

## In Scope

- Add CI checks for Rust formatting/tests and web package checks/builds.
- Add release build workflow skeleton for macOS arm64/x64, Linux x64, and Windows x64.
- Embed or package built WebApp assets with the released `forma` binary.
- Add `install.sh` and `install.ps1` skeletons.
- Document mise GitHub backend installation expectations.
- Add checksum generation to the release plan or workflow skeleton.

## Out Of Scope

- Homebrew, Scoop, Chocolatey, npm, or system package managers.
- Auto-updater.
- Signed/notarized releases unless needed for a later release task.

## Acceptance Criteria

- CI runs knowledge, Rust, and web checks.
- Release workflow can build platform artifacts or has documented placeholders for incomplete platform packaging.
- Released binary strategy does not require Node, Bun, pnpm, or Vite at end-user runtime.
- Installation scripts are explicit and reviewable.

## Relationship Notes

Blocked by scaffold and WebApp integration because release packaging needs the final binary and asset serving shape.

The scaffold and WebApp integration blockers are resolved by completed delivery tasks. The `blocked_by` entries remain as dependency history.

## Implementation Notes

- Added GitHub Actions CI jobs for knowledge formatting, Web checks/builds, and Rust formatting/check/test. Workflow pnpm setup uses a centralized `PNPM_VERSION` workflow variable and avoids adding a second top-level `packageManager` version source to `package.json`.
- Added a release workflow that builds Linux x64, macOS arm64, macOS x64, and Windows x64 artifacts, with WebApp assets built before Rust release builds so `forma serve` does not require an end-user frontend runtime.
- Standardized release asset names as `forma-linux-x64.tar.gz`, `forma-macos-arm64.tar.gz`, `forma-macos-x64.tar.gz`, and `forma-windows-x64.zip`, each with a sibling `.sha256` file.
- Added `install.sh` and `install.ps1` skeletons that download, verify, and install GitHub Release artifacts.
- Documented GitHub Release installation scripts and mise GitHub backend installation expectations in `README.md`.

## Review Readiness

| Field             | Evidence                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| Scope completed   | CI, release workflow, install scripts, checksums, and README documented. |
| Files changed     | Intended CI/release/docs/task files only; unrelated dirty files remain.  |
| Knowledge updated | Updated architecture, decision, README, and this task item.              |
| Checks run        | Markdown/YAML/script syntax, Rust check/test, TypeScript check/build.    |
| Residual risks    | GitHub Actions release matrix still needs first real workflow run.       |

## Open Questions

- Actual release signing/notarization strategy can wait until a release readiness task.
