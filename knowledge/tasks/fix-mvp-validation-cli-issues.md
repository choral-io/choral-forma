---
scope: project
type: task
priority: P0
severity:
value: M
module: app

owners:
    - "members/Tiscs"
assignees:
    - "members/Tiscs"
reviewers: []
tags:
    - forma
    - p0
    - mvp-validation
    - cli

effort: S
readiness: ready
sprint:

blocked_by: []
related_to:
    - "tasks/implement-ci-release-baseline"
    - "tasks/implement-starter-init-create-inspect-list"

reported_by: MVP validation on 2026-05-22
affected_area: CLI install and initialization validation
---

# Fix MVP Validation CLI Issues

## Goal

Fix CLI issues found during the first MVP validation pass.

## Sources

- [[tasks/implement-ci-release-baseline]]
- [[tasks/implement-starter-init-create-inspect-list]]

## Context

The MVP validation used a clean temporary Forma workspace and the local `target/debug/forma` binary. Core init, create, check, index, list, inspect, serve, RPC, and WebApp read-only browsing flows passed. Two CLI usability gaps were found in the install and initialization validation path.

## In scope

- Add standard `forma --version` support.
- Keep the existing no-argument `forma` version output working.
- Improve non-JSON failed command output so diagnostics include useful code and message details instead of only `<operation> failed`.
- Add focused CLI tests for the changed behavior.

## Out of scope

- Release artifact download testing.
- Install script changes.
- WebApp feature changes.
- Knowledge Workflow migration cleanup.

## Acceptance criteria

- `forma --version` exits successfully and prints `forma 0.1.0`.
- Running `forma init --name <name>` in a non-interactive shell without `--yes` exits unsuccessfully and prints the `init.confirmationRequired` diagnostic in human-readable output.
- Existing JSON output for failed operations remains unchanged.
- Focused Rust CLI tests pass.

## Relationship notes

Release artifact and install-script validation is a separate follow-up validation step after these CLI behavior fixes.

## Validation notes

- Added `forma --version` and `forma -V`.
- Improved human-readable failed operation output to include diagnostic severity, code, message, and path when available.
- Verified `target/debug/forma --version` prints `forma 0.1.0`.
- Verified non-interactive `forma init --name <name>` prints `init.confirmationRequired` in non-JSON output.
- Verified `cargo test -p forma-cli`, `cargo check -p forma-cli`, and `cargo fmt --check` pass.
- Release artifact validation passed after network recovery:
    - downloaded `forma-macos-arm64.tar.gz` and matching `.sha256`;
    - verified checksum with `shasum -a 256 -c`;
    - extracted `forma-macos-arm64/bin/forma`;
    - verified the release binary can `init`, `create`, `check`, `list`, `inspect`, `config inspect`, and `serve`;
    - verified `forma serve` serves embedded WebApp assets and RPC;
    - opened the release WebApp in the in-app browser and confirmed overview, spaces, views, diagnostics, and `rpc: connected`.

## Open questions

-
