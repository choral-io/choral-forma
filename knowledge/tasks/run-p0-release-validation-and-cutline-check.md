---
scope: project
type: task
priority: P0
severity:
value: H
module: infra

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p0
    - release
    - validation

effort: S
readiness: ready
sprint:

blocked_by:
    - "[[tasks/audit-p0-release-scope-and-roadmap]]"
related_to:
    - "[[tasks/implement-ci-release-baseline]]"
    - "[[tasks/fix-mvp-validation-cli-issues]]"

reported_by:
affected_area: P0 release validation and cutline
---

# Run P0 Release Validation And Cutline Check

## Goal

Validate the current P0 release cutline and record whether Choral Forma is
ready to cut or publish a P0 release artifact.

## Sources

- [[planning/p0-release-scope-audit]]
- [[product/product-direction]]
- [[product/forma-p0-starter-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-check-index-spec]]
- [[tasks/implement-ci-release-baseline]]
- [[tasks/fix-mvp-validation-cli-issues]]

## Context

The P0 feature baseline is complete enough to stop adding product surface area.
The next release-risk reducer is a current-HEAD validation pass that ties
existing focused evidence to an explicit release cutline.

## In Scope

- Confirm the candidate branch, commit, and working-tree state.
- Run the release-validation command matrix for knowledge, Rust, Web, and
  packaging/build readiness.
- Create a temporary starter workspace and smoke-test the P0 user flows:
  `forma init`, `forma config inspect`, `forma create`, `forma inspect`,
  `forma list`, `forma check`, `forma index rebuild`, `forma index check`, and
  local WebApp serving/build readiness where practical.
- Verify generated or temporary smoke-test artifacts are not left in the shared
  repository.
- Record exact command results, failures, environment limits, and the final
  release-readiness decision.

## Out Of Scope

- Adding product features.
- Changing P0 scope or architecture decisions.
- Publishing a release or pushing tags.
- Fixing newly found defects beyond a small clearly scoped repair approved
  during the task.
- Moving Kanban cards without maintainer approval.

## Acceptance Criteria

- The candidate branch and commit are recorded.
- `git status --short --branch` is recorded before and after validation.
- The validation matrix result is recorded for:
    - `mise run check:knowledge`
    - `mise run check:rust`
    - `mise run test:rust`
    - `mise run check:web`
    - `mise run build:web`
    - `mise run check`
- A starter workspace smoke test records the commands run and whether they
  passed.
- Any release blocker has a concrete follow-up task or a recorded no-go
  decision.
- If all checks pass, the task states that the P0 cutline is ready for release
  publishing as a separate approved action.

## Relationship Notes

This task should move to Ready only after
[[tasks/audit-p0-release-scope-and-roadmap]] is accepted or moved to Done.

The blocker is resolved by the accepted P0 scope audit and the approved Kanban
move of [[tasks/audit-p0-release-scope-and-roadmap]] to Done.

## Validation Notes

Candidate cutline:

- Branch: `main`
- Commit: `bb996c1ee18a3d54af6f97e51e9e426e1cef3df7`
- Initial status: `## main...origin/main [ahead 5]`
- Tags at HEAD: none.

Validation matrix:

- `mise run check:knowledge`: passed.
- `mise run check:rust`: passed; rebuilt WebApp assets first, then ran Rust
  formatting and workspace checks.
- `mise run test:rust`: passed; workspace tests passed across `forma-cli`,
  `forma-core`, and `forma-rpc`.
- `mise run check:web`: passed.
- `mise run build:web`: passed.
- `mise run check`: passed.

Starter workspace smoke test:

- Temporary workspace: `/private/tmp/forma-p0-cutline.fQS1M5`
- `forma init` with name `P0 Cutline`, language `en`, timezone
  `Asia/Shanghai`, `-y`, and `--json`: passed.
- `forma config inspect --json`: passed.
- `forma create notes --input title=Alpha --input summary=Smoke --json`: passed
  with expected `index.stale` warning after writing the entry.
- `forma inspect notes/alpha.md --json`: passed.
- `forma list --collection notes --json`: passed and returned one note.
- `forma check --json`: passed with expected stale-index warning before rebuild.
- `forma index rebuild --json`: passed.
- `forma index check --json`: passed after rebuild.
- `forma serve --bind 127.0.0.1:0`: sandboxed bind failed with
  `Operation not permitted`; reran with approved localhost binding and passed.
- HTTP root smoke check returned the WebApp HTML shell.
- JSON-RPC `list` smoke check returned the `notes` collection and the created
  `Alpha` note.

Artifact check:

- `git status --short --branch` after validation reported
  `## main...origin/main [ahead 5]`.
- `git diff --stat HEAD` after validation was empty before recording these
  notes.
- Smoke-test artifacts stayed under `/private/tmp/forma-p0-cutline.fQS1M5`; no
  generated starter files were left in the shared repository.

Release decision:

- The local P0 cutline is validated for internal-test release publishing as a
  separate approved action.
- Publishing is not yet source-stable because `main` is still ahead of
  `origin/main` and HEAD has no release tag.
- Recommended publication target: push current `main`, then publish
  `v0.1.0-alpha.4` from the pushed HEAD.

## Open Questions

- None.
