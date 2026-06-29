---
schemaVersion: 1
kind: release
title: Next Internal Release
summary: Internal release gate for proving Forma CLI onboarding, `.forma.md` configuration, generic read operations, and workspace content workflows.
scope: project
type: release
status: ready-for-review
version: v0.1.0-alpha.8
date: 2026-06-27
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - validation
relatedTasks:
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
    - "tasks/migrate-config-entrypoint-to-forma-md"
    - "tasks/generalize-task-specific-read-operations"
    - "tasks/stabilize-public-read-only-webapp-release"
    - "tasks/run-p0-release-validation-and-cutline-check"
    - "tasks/run-starter-kit-agent-pressure-validation"
    - "tasks/add-linux-arm64-release-artifact"
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedExperiments:
    - "experiments/starter-kit-agent-pressure-validation"
relatedMetrics:
    - "metrics/knowledge-workflow-replacement-readiness"
---

# Next Internal Release

## Scope

This internal release should prove that Forma can manage this repository's project content through configured Markdown spaces, schemas, guidelines, CLI checks, embedded Agent docs, and WebApp read surfaces without relying on the old `knowledge-workflow` skills.

The release is internal. It does not require public packaging, public documentation polish, MCP support, editor-extension support, or comprehensive write-operation coverage.

## Included Changes

- Forma CLI and configured guidelines are the primary Agent-facing content workflow.
- Forma exposes Agent-facing skills from the configured workspace, with `forma-cli-core` embedded from a Markdown source asset and the project-local `forma-cli` skill aligned with the installed Agent entrypoint.
- `forma init` creates a minimal `.forma.md` workspace bootstrap and Agent runtime entrypoint for empty or ordinary project directories.
- `.forma.md` is the only active configuration entrypoint; legacy `.forma.yml` behavior is removed from the current product path.
- Generic read operations replace task-specific CLI and RPC helpers for list, inspect, and view rendering workflows.
- The project content workspace uses configured spaces for product direction, tasks, test cases, releases, metrics, and user stories.
- The starter-kit validation suite is available outside the starter-kit template and can be used for pressure testing.
- The read-only WebApp includes workspace health context and graph node popup refinements.
- Product-facing docs, Agent guidance, and WebApp copy use neutral content-workspace language while preserving Choral Forma and Forma product naming.
- The project content workspace stays valid under Forma checks and health diagnostics.

## Validation

Required validation:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- Execute or simulate the contract and pressure cases listed in [[test-cases/forma-starter-kit]].
- Complete or review [[tasks/run-starter-kit-agent-pressure-validation]].
- Review [[experiments/starter-kit-agent-pressure-validation]] and classify the outcome.
- Review [[metrics/knowledge-workflow-replacement-readiness]] and decide whether the threshold is met.

Current validation result:

- Candidate version: `v0.1.0-alpha.8`.
- Candidate cutline before recording this validation note: `0190809 test: align builtin skill wording expectation`.
- Latest previous tag: `v0.1.0-alpha.7`.
- Repository `config inspect`, `check`, `workspace health`, and full `CI=true mise run check`: passed.
- Starter-kit `check`: passed.
- Starter-kit pressure validation: passed for this internal validation pass; see [[experiments/starter-kit-agent-pressure-validation]].
- Readiness metric: `ready`; see [[metrics/knowledge-workflow-replacement-readiness]].
- Non-blocking verification output: Vite reported chunk-size warnings; all validation commands exited successfully.

Task-board alignment:

- This release record being `ready-for-review` does not imply that every related task has been moved to `done`.
- Use `cargo run -q -p forma-cli -- view render .forma/views/task-board --json` as the source of truth for current task status.
- Reviewing or doing tasks must still be closed through explicit task-board review before any final release publish action.

## Rollout Plan

1. Keep this as an internal repository milestone.
2. Use it to validate Human and Agent workflows over the current project knowledge base.
3. Record gaps as tasks, proposals, or planning notes instead of widening the release scope.

## Migration Or Operations Notes

The old `knowledge-workflow` skills are not product runtime requirements. Their useful behavior should be represented by configured guidelines, schemas, checks, tasks, test cases, and release validation records.

## Release Notes

Draft release note:

> Forma now supports the next internal onboarding path: initialize a minimal `.forma.md` workspace, use embedded Agent docs and workspace-projected skills, browse configured content through the read-only WebApp, and rely on generic read operations instead of task-specific helpers.

## Rollback Plan

No runtime rollback is required for an internal knowledge release. If validation fails, keep the release in `planned` status, record the blocker, and create or update follow-up tasks.

## Post-Release Follow-Up

- Decide whether remaining old knowledge-workflow references can be deleted or archived.
- Use [[tasks/implement-docs-backed-init-and-agent-onboarding]] as the next milestone candidate for helping internal team members start from empty projects and collect Forma CLI feedback.
- Decide whether reviewable write operations need to move into a later milestone after onboarding feedback.
- Decide whether starter-kit validation should become an automated gate.
