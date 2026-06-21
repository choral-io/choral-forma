---
scope: project
type: task
priority: P0
severity:
value: H
module: infra

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - release
    - validation

effort: S
status: done
readiness: ready
sprint:

blocked_by:
    - "tasks/audit-p0-release-scope-and-roadmap"
related_to:
    - "tasks/implement-ci-release-baseline"
    - "tasks/fix-mvp-validation-cli-issues"

reported_by:
affected_area: P0 release validation and cutline
---

# Run P0 Release Validation And Cutline Check

## Goal

Validate the current P0 release cutline and record whether Choral Forma is ready to cut or publish a P0 release artifact.

## Sources

- [[planning/p0-release-scope-audit]]
- [[product/product-direction]]
- [[product/forma-p0-starter-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-check-index-spec]]
- [[tasks/implement-ci-release-baseline]]
- [[tasks/fix-mvp-validation-cli-issues]]

## Context

The P0 feature baseline is complete enough to stop adding product surface area. The next release-risk reducer is a current-HEAD validation pass that ties existing focused evidence to an explicit release cutline.

## In Scope

- Confirm the candidate branch, commit, and working-tree state.
- Run the release-validation command matrix for knowledge, Rust, Web, and packaging/build readiness.
- Create a temporary starter workspace and smoke-test the P0 user flows: `forma init`, `forma config inspect`, `forma create`, `forma inspect`, `forma list`, `forma check`, and local WebApp serving/build readiness where practical.
- Verify generated or temporary smoke-test artifacts are not left in the shared repository.
- Record exact command results, failures, environment limits, and the final release-readiness decision.

## Out Of Scope

- Adding product features.
- Changing P0 scope or architecture decisions.
- Publishing a release or pushing tags.
- Fixing newly found defects beyond a small clearly scoped repair approved during the task.
- Moving Kanban cards without maintainer approval.

## Acceptance Criteria

- The candidate branch and commit are recorded.
- `git status --short --branch` is recorded before and after validation.
- The validation matrix result is recorded for:
    - `mise run check:rust`
    - `mise run test:rust`
    - `mise run check:pnpm`
    - `mise run build:pnpm`
    - `mise run check`
- A starter workspace smoke test records the commands run and whether they passed.
- Any release blocker has a concrete follow-up task or a recorded no-go decision.
- If all checks pass, the task states that the P0 cutline is ready for release publishing as a separate approved action.

## Relationship Notes

This task should move to Ready only after [[tasks/audit-p0-release-scope-and-roadmap]] is accepted or moved to Done.

The blocker is resolved by the accepted P0 scope audit and the approved Kanban move of [[tasks/audit-p0-release-scope-and-roadmap]] to Done.

## Validation Notes

### 2026-06-17 Internal Release Candidate

Candidate cutline:

- Branch: `codex/webapp-v2-dashboard`
- Code/documentation baseline before recording this validation note: `5d7f347 docs: align starter configuration references`
- Initial status before release-prep commit: `## codex/webapp-v2-dashboard...origin/codex/webapp-v2-dashboard [ahead 12]`
- Initial uncommitted files before release-prep commit: README and knowledge release documentation updates plus `pnpm-lock.yaml`.
- Latest tag before this candidate: `v0.1.0-alpha.4`.

Validation matrix:

- `mise run format:pnpm`: passed.
- `mise run check:pnpm`: passed.
- `mise run build:pnpm`: passed. Vite reported chunk-size warnings for large generated chunks, but exited 0.
- `mise run check:rust`: passed. This rebuilt WebApp assets, then ran Rust formatting and workspace checks.
- `mise run test:rust`: passed. Rust tests passed across `forma-cli`, `forma-core`, and `forma-rpc`.
- `mise run check`: passed. pnpm tests reported 4 files and 12 tests passed; Rust workspace tests reported `forma-cli` 20 unit tests plus 9 CLI tests, `forma-core` 85 tests, and `forma-rpc` 15 tests passed.

Starter workspace smoke test:

- Temporary workspace: `/private/tmp/forma-internal-release.q0xC65`
- `forma init` with name `Internal Release`, language `en`, timezone `Asia/Shanghai`, `-y`, and `--json`: passed. The created file list did not include a persistent index artifact.
- `forma config inspect --json`: passed.
- `forma create notes --input title=Alpha --input summary=Smoke --json`: passed without index-stale warnings.
- `forma inspect notes/alpha.md --json`: passed.
- `forma list --space notes --json`: passed and returned one note.
- `forma check --json`: passed with zero errors, warnings, and infos.
- `forma --help`: passed and did not list an `index` command.
- `forma serve --bind 127.0.0.1:0`: required approved localhost binding and passed at `http://127.0.0.1:59759`.
- HTTP root smoke check returned the WebApp HTML shell.
- JSON-RPC `workspace.dashboard` returned status `passed`, the `notes`, `todos`, and `users` spaces, and the created `Alpha` note.
- JSON-RPC `view.render` for `notes` returned status `passed`, table columns, and the created `Alpha` row.
- JSON-RPC `file.render` for `notes/alpha.md` in Markdown format returned status `passed` and Markdown for `# Alpha`.

Artifact check:

- `git status --short --branch` after smoke validation reported only the intended release-prep documentation updates and `pnpm-lock.yaml`.
- Smoke-test artifacts stayed under `/private/tmp/forma-internal-release.q0xC65`; no generated starter files were left in the shared repository.

Release decision:

- The local branch is validated for the next internal-test release candidate after committing these release-prep notes and lockfile updates.
- Publishing remains a separate approved action: do not tag or push as part of this validation step.
- Recommended next internal tag after review and push: `v0.1.0-alpha.5`.

## Open Questions

- None.
