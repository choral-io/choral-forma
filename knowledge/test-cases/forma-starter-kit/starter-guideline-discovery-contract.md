---
schemaVersion: 1
kind: test-case
title: Starter Guideline Discovery Contract
summary: Verify that Agents discover applicable starter guidelines through Forma config and operation results, without hard-coded paths.
scope: starter-kit
type: contract
status: draft
priority: P1
automation: cli
owners:
    - "members/tiscs"
tags:
    - starter-kit
    - cli
    - guidelines
    - contract
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Guideline Discovery Contract

## Purpose

Verify that the starter workspace exposes guidance as ordinary knowledge and that Agents can discover the relevant guidance from Forma outputs rather than assuming a repository layout or copying old workflow conventions.

## Preconditions

- The starter config contract passes.
- The starter has workspace-level guidelines and at least one space-specific guideline.

## Test Data

- Workspace: `examples/forma-starter-kit`
- Bootstrap command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`
- Task command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks inspect tasks/add-team-notes.md --json`

## Steps

1. Run the bootstrap command.
2. Confirm workspace-level `guidelines` are returned as Markdown paths inside the starter workspace.
3. Confirm bootstrap output does not require the Agent to know task-specific guideline paths in advance.
4. Run the task command.
5. Confirm the task operation returns the workspace guidelines plus the task-specific guideline declared by the tasks space.
6. Confirm all returned guideline paths can be read as ordinary starter knowledge pages.

## Expected Results

- Agents can discover baseline workspace guidance from `config inspect`.
- Agents can discover task guidance from task-oriented operations such as `tasks inspect`.
- The `forma-cli` skill can remain structure-agnostic: it follows Forma outputs instead of hard-coding `guidelines/task-selection.md` or this repository's `knowledge/` layout.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Guideline discovery model.
- Skill bootstrap behavior.
- Space-specific operating guidance.
- Replacement path for the soft constraints previously supplied by workflow skills.

## Evidence Or Execution Notes

Record returned guideline arrays from both commands and note any missing or unexpected path.

## Open Questions

- Should list and board operations also return applicable guidelines, or is inspect-level guidance enough for the first evaluation version?
