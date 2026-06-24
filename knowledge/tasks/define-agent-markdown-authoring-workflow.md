---
schemaVersion: 1
kind: task
scope: project
title: "Define Agent Markdown Authoring Workflow"
summary: "Define the Human and Agent procedure for approved direct Markdown edits before product-level write operations exist."
type: task
priority: P1
value: H
module: knowledge
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - agents
    - guidelines
    - knowledge
    - authoring
blockedBy: []
relatedTo:
    - "guidelines/forma-knowledge-operations"
    - "guidelines/knowledge-capture"
    - "guidelines/task-selection"
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "tasks/run-starter-kit-agent-pressure-validation"
    - "test-cases/forma-starter-kit/starter-write-verify-pressure"
    - "test-cases/forma-starter-kit/starter-local-only-promotion-pressure"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: "Agent Markdown authoring, Forma guidelines, repository knowledge workflow"
---

# Define Agent Markdown Authoring Workflow

## Goal

Define the approved direct Markdown authoring workflow for Agents while Forma remains focused on read, inspect, check, health, and guidance rather than product-level write operations.

## Sources

- [[guidelines/forma-knowledge-operations]]
- [[guidelines/knowledge-capture]]
- [[guidelines/task-selection]]
- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]
- [[tasks/run-starter-kit-agent-pressure-validation]]
- [[test-cases/forma-starter-kit/starter-write-verify-pressure]]
- [[test-cases/forma-starter-kit/starter-local-only-promotion-pressure]]
- Built-in CLI guide asset: `crates/forma-core/assets/skills/forma-cli-core.md`

## Context

The current stage should prioritize read workflows and disciplined Agent-authored Markdown edits. Direct Agent edits remain acceptable when explicitly approved, but they need a clearer procedure than broad product-level write operations.

This task should clarify how Agents use `.forma.yml`, configured spaces, schema, guidelines, and Forma CLI diagnostics before and after editing repository Markdown.

The workflow must include discovery of workflow-relevant skills via `cargo run -q -p forma-cli -- skills list` and `cargo run -q -p forma-cli -- skills get`, including the built-in `forma-cli-core` and guideline-projected workspace skills.

The built-in `forma-cli-core` Markdown source is packaged from `crates/forma-core/assets/skills/forma-cli-core.md`. It is intentionally a code asset rather than a project knowledge guideline, while workspace skills are projected only from configured guideline documents.

## In Scope

- Define the Agent workflow for approved direct Markdown edits.
- Define when an Agent must provide a dry-run summary before editing.
- Define how an Agent chooses the target configured space and file path.
- Define local-only, shared-knowledge, and promotion boundaries.
- Define required post-edit checks and review evidence.
- Update existing guidelines or the project-local `forma-cli` skill if the workflow needs clearer entrypoint instructions.
- Include `skills list` and `skills get` into the workflow to expose and apply built-in `forma-cli-core` and guideline-projected workspace skills.
- Identify whether starter-kit Agent pressure tests need an additional case or wording updates.

## Out of Scope

- Implementing product-level write operations.
- Implementing proposal, dry-run, apply, or policy runtime commands.
- Designing WebApp write or proposal UI.
- Designing AI Chat write behavior.
- Replacing human review with machine-enforced policy.

## Acceptance Criteria

- The workflow starts from `config inspect`, `knowledge health`, and applicable guideline discovery instead of hard-coded repository paths.
- The workflow distinguishes single-file approved edits from multi-file edits, promotion from local-only material, task status changes, guideline/config changes, and dependency-related knowledge edits.
- The workflow explains how to select a configured space, target path, frontmatter shape, and links before writing.
- The workflow states which edits require a dry-run summary before file changes.
- The workflow states required verification commands after writing, including `check` and `knowledge health` when references or placement matter.
- The workflow defines review evidence that Agents must report after edits.
- The workflow includes `skills list` and `skills get` usage, and explicitly documents projection of the built-in `forma-cli-core` skill and guideline-defined workspace skills into task execution.
- Existing product-level write-operation tasks remain deferred and are not treated as prerequisites.
- Forma checks and knowledge health pass after the workflow is recorded.

## Implementation Notes

Completed on 2026-06-24.

Changes:

- Expanded [[guidelines/knowledge-capture]] with a dedicated direct Markdown authoring procedure.
- Defined entry conditions for approved shared Markdown writes.
- Distinguished a narrow single-file fast path from dry-run-required cases.
- Defined target selection through effective Forma config, configured spaces, schema, templates, and existing entries.
- Defined edit rules for canonical Markdown, references, source context, private material, and localized variants.
- Defined failure handling when `check` or `knowledge health` reports diagnostics after an edit.
- Updated [[test-cases/forma-starter-kit/starter-write-verify-pressure]] and [[test-cases/forma-starter-kit/starter-agent-skill-behavior-pressure]] to cover dry-run and target-selection expectations.

Validation:

- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- knowledge health --json`
- `cargo run -q -p forma-cli -- skills get markdown-authoring`
