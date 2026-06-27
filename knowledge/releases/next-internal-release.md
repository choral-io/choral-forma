---
schemaVersion: 1
kind: release
title: Next Internal Release
summary: Internal release gate for proving the Forma-managed knowledge workflow against the starter-kit pressure suite and current project knowledge.
scope: project
type: release
status: ready-for-review
version: v0.1.0-alpha.6
date: 2026-06-27
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - validation
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedExperiments:
    - "experiments/starter-kit-agent-pressure-validation"
relatedMetrics:
    - "metrics/knowledge-workflow-replacement-readiness"
---

# Next Internal Release

## Scope

This internal release should prove that Forma can manage this repository's project knowledge through configured Markdown spaces, schemas, guidelines, CLI checks, and WebApp read surfaces without relying on the old `knowledge-workflow` skills.

The release is internal. It does not require public packaging, public documentation polish, MCP support, editor-extension support, or comprehensive write-operation coverage.

## Included Changes

- Forma CLI and configured guidelines are the primary Agent-facing knowledge workflow.
- Forma exposes Agent-facing skills from the configured workspace, with `forma-cli-core` embedded from a Markdown source asset and the project-local `forma-cli` skill aligned with the installed Agent entrypoint.
- The project knowledge base uses configured spaces for product direction, tasks, test cases, releases, metrics, and user stories.
- The starter-kit validation suite is available outside the starter-kit template and can be used for pressure testing.
- The read-only WebApp includes knowledge health context and graph node popup refinements.
- The project knowledge base stays valid under Forma checks and health diagnostics.

## Validation

Required validation:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- knowledge health --json`
- Execute or simulate the contract and pressure cases listed in [[test-cases/forma-starter-kit]].
- Complete or review [[tasks/run-starter-kit-agent-pressure-validation]].
- Review [[experiments/starter-kit-agent-pressure-validation]] and classify the outcome.
- Review [[metrics/knowledge-workflow-replacement-readiness]] and decide whether the threshold is met.

Current validation result:

- Candidate version: `v0.1.0-alpha.6`.
- Candidate cutline before recording this validation note: `848d655 docs: define forma cli agent skill source`.
- Latest previous tag: `v0.1.0-alpha.5`.
- Repository `config inspect`, `check`, `knowledge health`, and full `CI=true mise run check`: passed.
- Starter-kit `config inspect`, `check`, `knowledge health`, `skills list`, `tasks list`, and `inspect notes/getting-started.md`: passed.
- Starter-kit local server smoke passed for HTTP root, `workspace.dashboard`, `file.render`, and `view.render` JSON-RPC operations.
- Starter-kit pressure validation: passed for this internal validation pass; see [[experiments/starter-kit-agent-pressure-validation]].
- Readiness metric: `ready`; see [[metrics/knowledge-workflow-replacement-readiness]].
- Non-blocking verification output: Vite reported chunk-size warnings, and macOS SDK discovery emitted sandbox-like `xcrun`/`xcodebuild` cache warnings; all validation commands exited successfully.

## Rollout Plan

1. Keep this as an internal repository milestone.
2. Use it to validate Human and Agent workflows over the current project knowledge base.
3. Record gaps as tasks, proposals, or planning notes instead of widening the release scope.

## Migration Or Operations Notes

The old `knowledge-workflow` skills are not product runtime requirements. Their useful behavior should be represented by configured guidelines, schemas, checks, tasks, test cases, and release validation records.

## Release Notes

Draft release note:

> Forma is now usable as the primary knowledge-management workflow for this repository's project knowledge, with configured spaces, schemas, guidelines, CLI checks, and starter-kit pressure validation as the review baseline.

## Rollback Plan

No runtime rollback is required for an internal knowledge release. If validation fails, keep the release in `planned` status, record the blocker, and create or update follow-up tasks.

## Post-Release Follow-Up

- Decide whether remaining old knowledge-workflow references can be deleted or archived.
- Use [[tasks/implement-docs-backed-init-and-agent-onboarding]] as the next milestone candidate for helping internal team members start from empty projects and collect Forma CLI feedback.
- Decide whether reviewable write operations need to move into a later milestone after onboarding feedback.
- Decide whether starter-kit validation should become an automated gate.
