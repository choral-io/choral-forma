---
schemaVersion: 1
kind: task
scope: "project"
title: "Add Linux ARM64 release artifact before next release"
summary: "Add a Linux ARM64 release build artifact before publishing the next Forma version."
type: "task"
priority: "P2"
value: "M"
module: "release"
effort: "S"
status: "backlog"
readiness: "needs-refinement"
owners: []
assignees: []
reviewers: []
tags: []
blockedBy: []
relatedTo:
    - "releases/next-internal-release"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: ""
---

# Add Linux ARM64 release artifact before next release

## Goal

Before publishing the next Forma release, add a Linux ARM64 release artifact so ARM Linux users can install Forma through the release archive, install script, and mise GitHub backend without building from source.

## Sources

- Release workflow currently publishes Linux x64, macOS arm64/x64, and Windows x64 artifacts.
- `install.sh` already maps `aarch64` and `arm64` hosts to the expected `forma-linux-arm64.tar.gz` asset name.

## In Scope

- Add a `linux-arm64` release build to `.github/workflows/release.yml`.
- Confirm the Rust target and GitHub hosted runner choice for ARM64 Linux.
- Update README artifact listings if the release matrix changes.
- Verify the generated archive and checksum names match installer expectations.

## Out of Scope

- Do not add the Linux ARM64 build before the next release preparation pass.
- Do not add Windows ARM64 in this task.
- Do not change install script behavior unless release artifact naming changes.

## Acceptance Criteria

- Release workflow builds and uploads `forma-linux-arm64.tar.gz`.
- The corresponding `.sha256` artifact is uploaded.
- `install.sh` can resolve the Linux ARM64 asset using its existing OS and architecture detection.
- README release artifact list includes Linux ARM64.
- Release validation includes checking the Linux ARM64 artifact in GitHub Actions output.
