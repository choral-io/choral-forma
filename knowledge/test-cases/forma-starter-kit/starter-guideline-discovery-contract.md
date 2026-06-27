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
- Built-in skill command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get forma-cli-core`
- Skills list command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills list --json`
- Config command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`
- Inspect command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit inspect --space tasks add-team-notes --json`

## Steps

1. Run the built-in skill command and confirm it prints `forma-cli-core` Markdown with workspace-root guidance.
2. Run the skills list command.
3. Confirm `forma-cli-core`, `starter-workspace-operations`, and `starter-task-selection` are returned.
4. Confirm projected workspace skills cite their source guideline paths.
5. Run the config command.
6. Confirm workspace-level `guidelines` are returned as Markdown paths inside the starter workspace.
7. Confirm bootstrap output does not require the Agent to know task-specific guideline paths in advance.
8. Run the inspect command.
9. Confirm the inspect operation returns the workspace guidelines plus the guideline declared by the configured tasks space.
10. Confirm all returned guideline paths can be read as ordinary starter knowledge pages.

## Expected Results

- Agents can discover baseline workspace guidance from `config inspect`.
- Agents can discover and load projected starter skills from `skills list` and `skills get`.
- Agents can discover configured-space guidance from generic operations such as `inspect --space tasks`.
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
