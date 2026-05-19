---
scope: project
type: task
owners:
  - "[[groups/default-team]]"
assignees: []
reviewers:
  - "[[groups/default-team]]"
tags:
  - forma
  - p0
  - ci
  - release
priority: P1
severity:
value: M
module: infra
effort: M
readiness: blocked
sprint:
blocked_by:
  - "[[tasks/items/scaffold-forma-workspace]]"
  - "[[tasks/items/implement-read-only-webapp]]"
related_to:
  - "[[decisions/forma-p0-core-architecture]]"
  - "[[architecture/forma-core-technical-direction]]"
unblocks: []
reported_by:
affected_area: CI and release distribution
---

# Implement CI Release Baseline

## Goal

Add the P0 CI and release packaging baseline for the single `forma` binary and
development workspaces.

## Sources

- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-core-technical-direction]]

## Context

P0 distribution should prioritize standalone binaries, install scripts, and
mise GitHub backend support. End users should not need a Node or frontend
runtime for released builds.

## In Scope

- Add CI checks for Rust formatting/tests and web package checks/builds.
- Add release build workflow skeleton for macOS arm64/x64, Linux x64, and
  Windows x64.
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
- Release workflow can build platform artifacts or has documented placeholders
  for incomplete platform packaging.
- Released binary strategy does not require Node, Bun, pnpm, or Vite at
  end-user runtime.
- Installation scripts are explicit and reviewable.

## Relationship Notes

Blocked by scaffold and WebApp integration because release packaging needs the
final binary and asset serving shape.

## Open Questions

- Actual release signing/notarization strategy can wait until a release
  readiness task.
