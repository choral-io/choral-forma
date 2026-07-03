---
schemaVersion: 1
kind: release
title: Next Internal Release
summary: Internal release gate for proving Forma CLI onboarding, `.forma.md` configuration, generic read operations, and workspace content workflows.
scope: project
type: release
status: planned
version: v0.1.0-alpha.12
date: 2026-07-03
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
    - "test-cases/forma-cli-docs-bootstrap"
relatedExperiments:
    - "experiments/starter-kit-agent-pressure-validation"
relatedMetrics:
    - "metrics/knowledge-workflow-replacement-readiness"
---

# Next Internal Release

## Purpose

This is a rolling pre-release checklist for the next internal Forma version. After an internal version is tagged or published, reset this record to the next candidate instead of treating it as a permanent release note.

## Scope

This internal release should prove that Forma can manage this repository's project content through configured Markdown spaces, schemas, guidelines, CLI checks, embedded Agent docs, and WebApp read surfaces without relying on the old `knowledge-workflow` skills.

The release is internal. It does not require public packaging, public documentation polish, MCP support, editor-extension support, or comprehensive write-operation coverage.

## Included Changes

- Forma CLI and configured guidelines are the primary Agent-facing content workflow.
- Forma exposes Agent-facing skills from the configured workspace, with `forma-cli-core` embedded from a Markdown source asset and the project-local `forma-cli` skill aligned with the installed Agent entrypoint.
- Workspace guideline skills now expose compact Agent-facing sections by default through `forma skills get`, with `--full` available for the complete guideline text.
- The project workspace includes configured guideline skills for workspace onboarding and routing, proposal and dry-run handling, workspace audit and reporting, and local worklist execution.
- `forma init` creates a minimal `.forma.md` workspace bootstrap and Agent runtime entrypoint for empty or ordinary project directories.
- `.forma.md` is the only active configuration entrypoint; legacy `.forma.yml` behavior is removed from the current product path.
- Imported Markdown config nodes now report `config.unknownNodeKind` when an included config file uses an unsupported `kind`.
- Agent-facing bootstrap docs now support no-example workspace design discovery, first-slice dry runs, explicit example acceleration boundaries, and context-pressure guardrails.
- `workspace.first-slice-config` provides the default short reference for first-slice workspace setup, while full `workspace.configuration` remains available for runtime values, named types, `entryRef`, migration/debug, local identity defaults, and full reference behavior.
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
- Review [[test-cases/forma-cli-docs-bootstrap]] for no-example bootstrap, workspace design discovery, example accelerator boundaries, and context-pressure evidence.
- Complete or review [[tasks/run-starter-kit-agent-pressure-validation]].
- Review [[experiments/starter-kit-agent-pressure-validation]] and classify the outcome.
- Review [[metrics/knowledge-workflow-replacement-readiness]] and decide whether the threshold is met.

Current validation result:

- Candidate version: `v0.1.0-alpha.12`.
- Candidate cutline before final validation: pending final release-prep commit.
- Latest previous tag: `v0.1.0-alpha.11`.
- Current distance from latest previous tag: pending final release-prep commit.
- Repository `config inspect`, `check`, and `workspace health`: passed locally on 2026-07-03.
- Full `CI=true mise run check`: passed locally on 2026-07-03 after `pnpm install` stabilized dependency state.
- Starter-kit validation and pressure evidence review: covered by the configured guideline pressure test cases and current workspace health; no blocking issue found for this internal alpha.
- Release decision: ready to commit and push `main`; do not tag `v0.1.0-alpha.12` until GitHub Actions passes on pushed `main`.

Validation history:

- `v0.1.0-alpha.8`: repository `config inspect`, `check`, `workspace health`, full `CI=true mise run check`, starter-kit `check`, starter-kit pressure validation, and readiness metric review passed at cutline `0190809 test: align builtin skill wording expectation`; latest previous tag was `v0.1.0-alpha.7`. Vite reported non-blocking chunk-size warnings.

Task-board alignment:

- This release record being `planned` does not imply that every related task has been moved to `done`.
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

> Forma now supports compact workspace-projected guideline skills for Agent workflows, reducing default context pressure while keeping full guideline text available on demand. This alpha also expands the project workspace guidelines for onboarding, proposal and dry-run handling, audit/reporting, and local execution workflows.

## Rollback Plan

No runtime rollback is required for an internal knowledge release. If validation fails, keep the release in `planned` status, record the blocker, and create or update follow-up tasks.

## Post-Release Follow-Up

- Decide whether remaining old knowledge-workflow references can be deleted or archived.
- Use [[tasks/implement-docs-backed-init-and-agent-onboarding]] as the next milestone candidate for helping internal team members start from empty projects and collect Forma CLI feedback.
- Decide whether reviewable write operations need to move into a later milestone after onboarding feedback.
- Decide whether starter-kit validation should become an automated gate.
