---
schemaVersion: 1
kind: planning
title: "Forma CLI Product Workflow Validation"
summary: "Validation summary for using Forma CLI, guidelines, and starter-kit pressure tests as the product-oriented successor to the old knowledge-workflow skills."
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

# Forma CLI Product Workflow Validation

## Purpose

Evaluate whether Forma CLI plus configured guidelines can now support this repository's product R&D workflow without recreating the old `knowledge-workflow` skill system.

## Current Product R&D Role

This planning record is supporting evidence for [[releases/next-internal-release]]. It is not the release gate itself.

Current readiness should be judged through [[metrics/knowledge-workflow-replacement-readiness]], [[experiments/starter-kit-agent-pressure-validation]], [[test-cases/forma-starter-kit]], and [[tasks/run-starter-kit-agent-pressure-validation]].

## Current Result

The current Forma-based workflow is usable for current project knowledge management and product R&D:

- The repository knowledge workspace is discoverable from `.forma.md`.
- Repository `check`, `workspace health`, and `list --space tasks` pass with no diagnostics.
- The project-local `forma-cli` skill is config-driven and does not hard-code repository knowledge paths.
- Guidelines now carry the soft task-selection, content-maintenance, local-only, review-evidence, and write-boundary rules previously spread across old skills.
- The starter-kit example is clean enough to act as a product-level evaluation fixture instead of borrowing this repository's own knowledge structure.

This is not intended to be a full behavioral clone of the old workflow. The old skills are useful as pressure-test material, but the product direction is to keep only the workflow pieces that help Forma users manage repository-backed Markdown in a reviewable way.

Forma currently provides evidence and guidance; Human and Agent behavior still enforce the soft rules until policy-aware write operations exist.

## Evidence

Repository workspace:

- `cargo run -q -p forma-cli -- config inspect --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- workspace health --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- list --space tasks --json` passed.

Starter-kit workspace:

- `cargo run -q -p forma-cli -- --workspace examples/getting-started-workspace config inspect --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/getting-started-workspace check --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/getting-started-workspace workspace health --json` passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/getting-started-workspace list --space tasks --json` passed and exposed ready, doing, reviewing, blocked, done, and needs-refinement examples.
- `cargo run -q -p forma-cli -- --workspace examples/getting-started-workspace inspect --space tasks add-team-notes --json` passed and returned workspace plus task-specific guidelines.

## Product Workflow Coverage

Covered by current Forma mechanisms and still relevant to product R&D:

- Bootstrap from a configured workspace rather than hidden workflow files.
- Task inventory and board-state read through task metadata.
- Task selection guidance through configured guidelines.
- Knowledge health and reference diagnostics through Forma CLI.
- Knowledge capture guidance through configured guidelines.
- Local-only handling as workflow guidance, not runtime path magic.
- Starter-kit pressure scenarios kept outside the copyable starter workspace.

Productization gaps:

- Reviewable write operations: writes are currently ordinary approved Markdown edits followed by checks, not proposal, dry-run, approval, apply, and verification operations shared by CLI, RPC, WebApp, and Agents.
- Minimal policy gates: task status, readiness, local-only boundaries, and reference health are still guideline-enforced instead of machine-readable operation preconditions.
- Review evidence: guidelines describe the expected evidence, but no first-class operation packages it into a review artifact.
- Agent pressure validation: adversarial and shortcut prompts are represented by pressure test cases but are not yet continuously exercised.

Explicitly not migrated:

- The old `.workflow/runtime.md`, `manifest.yml`, rules, schemas, and templates directory model.
- `planning/KANBAN.md`; task board state now comes from task `status` and Forma views.
- A one-to-one recreation of old delivery, intake, capture, audit, assistant, and worklist skills.
- Personal execution-loop mechanics such as local `run-loop`, worker protocol, and daily execution logs as product core.
- Detailed task scoring tables unless a concrete product workflow needs them.

## Next Product Slice

The highest-value next product slice is [[tasks/design-reviewable-forma-write-operations]].

That task should design the minimal shared operation flow for a narrow structured write, such as a space/schema-driven single-entry metadata patch or manual Action over that patch. It should produce proposal, dry-run, diagnostics, explicit approval, apply, and post-apply verification behavior without treating this repository's `tasks` space as a built-in Forma concept.

[[planning/no-example-workspace-bootstrap-phase-1-plan]] defines the Phase 1 plan for improving Human and Agent workspace design from an empty initialized workspace before relying on examples or profile acceleration.

[[tasks/design-forma-policy-runtime]] should remain downstream until a concrete write-operation consumer exists. [[tasks/run-starter-kit-agent-pressure-validation]] remains useful validation evidence, but it should not drive a full clone of the old skill interface.

## Decision

Continue using `forma-cli` as the primary product workflow entrypoint. Do not reintroduce old workflow files, and do not productize the old skill structure directly.

The next implementation work should improve reviewable write-operation support, then attach minimal policy gates to concrete operations. It should avoid expanding Agent skills only to reproduce old workflow behavior.
