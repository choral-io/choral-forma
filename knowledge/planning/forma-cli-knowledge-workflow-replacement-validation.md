---
schemaVersion: 1
kind: planning
title: "Forma CLI Knowledge Workflow Replacement Validation"
summary: "Validation summary for using Forma CLI, guidelines, and starter-kit pressure tests to replace the old knowledge-workflow skills."
scope: project
type: validation
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - agents
    - validation
sources:
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "releases/next-internal-release"
    - "metrics/knowledge-workflow-replacement-readiness"
    - "experiments/starter-kit-agent-pressure-validation"
    - "user-stories/agent-maintains-project-knowledge"
    - "test-cases/forma-starter-kit"
    - "guidelines/forma-workspace-operations"
    - "guidelines/task-selection"
    - "guidelines/content-maintenance"
---

# Forma CLI Knowledge Workflow Replacement Validation

## Purpose

Evaluate whether Forma CLI plus configured guidelines can now replace the old knowledge-workflow skills as the primary Human and Agent entrypoint for repository knowledge work.

## Current Product R&D Role

This planning record is supporting evidence for [[releases/next-internal-release]]. It is not the release gate itself.

Current readiness should be judged through [[metrics/knowledge-workflow-replacement-readiness]], [[experiments/starter-kit-agent-pressure-validation]], [[test-cases/forma-starter-kit]], and [[tasks/run-starter-kit-agent-pressure-validation]].

## Current Result

The replacement is usable for current project knowledge management:

- The repository knowledge workspace is discoverable from `.forma.md`.
- Repository `check`, `workspace health`, and `tasks list` pass with no diagnostics.
- The project-local `forma-cli` skill is config-driven and does not hard-code repository knowledge paths.
- Guidelines now carry the soft task-selection, content-maintenance, local-only, review-evidence, and write-boundary rules previously spread across old skills.
- The starter-kit example is clean enough to act as a product-level evaluation fixture instead of borrowing this repository's own knowledge structure.

This is not yet a hard-constraint replacement. Forma currently provides evidence and guidance; Human and Agent behavior still enforce the soft rules until policy-aware write operations exist.

## Evidence

Repository workspace:

- `cargo run -q -p forma-cli -- config inspect --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- workspace health --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- tasks list --json` passed.

Starter-kit workspace:

- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit workspace health --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks list --json` passed and exposed ready, doing, reviewing, blocked, done, and needs-refinement examples.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks inspect --json tasks/add-team-notes.md` passed and returned workspace plus task-specific guidelines.

## Coverage Against Old Skill Value

Covered by current Forma mechanisms:

- Bootstrap from a configured workspace rather than hidden workflow files.
- Task inventory and board-state read through task metadata.
- Task selection guidance through configured guidelines.
- Knowledge health and reference diagnostics through Forma CLI.
- Knowledge capture guidance through configured guidelines.
- Local-only handling as workflow guidance, not runtime path magic.
- Starter-kit pressure scenarios kept outside the copyable starter workspace.

Partially covered:

- Agent behavior under adversarial or shortcut prompts is represented by pressure test cases but is not yet continuously exercised.
- Review evidence is documented in guidelines, but there is no first-class operation that packages evidence into a review artifact.
- Writes are currently ordinary approved Markdown edits followed by checks, not reviewable Forma operations.

Not covered yet:

- Machine-readable policy enforcement for task status transitions.
- Reviewable write-operation proposal, dry-run, apply, and verification flows.
- Executable harnesses for the starter-kit Agent pressure tests.

## Next Validation Slice

The highest-value next slice is [[tasks/run-starter-kit-agent-pressure-validation]].

That task should execute the existing starter-kit test cases as an evaluation pass, record which cases can be verified by CLI evidence today, and separate remaining manual Agent pressure cases from product/runtime gaps.

For product R&D tracking, that slice is now represented as [[experiments/starter-kit-agent-pressure-validation]] and gates [[releases/next-internal-release]] through [[metrics/knowledge-workflow-replacement-readiness]].

## Decision

Continue using `forma-cli` as the primary replacement for old knowledge-workflow skill entrypoints. Do not reintroduce old workflow files or productize their structure directly.

The next implementation work should improve verification and write-operation support rather than expanding the skill itself.
