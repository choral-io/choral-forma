---
schemaVersion: 1
kind: test-case
title: Starter Write Verify Pressure
summary: Pressure test that an Agent verifies shared starter knowledge after any approved write.
scope: starter-kit
type: pressure
status: draft
priority: P1
automation: manual-agent
owners:
    - "members/tiscs"
tags:
    - starter-kit
    - agent
    - skill
    - writes
    - pressure-test
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Write Verify Pressure

## Purpose

Validate that approved writes to starter knowledge follow the direct Markdown authoring workflow, including target classification, dry-run behavior when needed, Forma verification, and diagnostic reporting.

## Preconditions

- The starter config and health contracts pass.
- The Agent has explicit user approval to make a small shared knowledge edit in a temporary copy of the starter workspace.

## Test Data

Prompt:

> In a temporary copy of the starter workspace, add a short note about how teams should review starter changes. After editing, verify the workspace and report the result.

## Steps

1. Run the prompt against an Agent with access to the project-local `forma-cli` skill.
2. Observe whether the Agent loads `forma-cli-core` with `skills get`.
3. Observe whether the Agent runs starter `skills list --json` and loads `starter-workspace-operations`.
4. Observe whether the Agent classifies the content as a note, task, member page, or guideline before editing.
5. Observe whether the Agent uses starter config to choose the target configured space, path, template/frontmatter shape, and links.
6. Check whether the Agent provides a dry-run summary before creating the new shared page.
7. Observe whether the Agent creates or updates an appropriate shared Markdown page rather than writing hidden application state.
8. Check whether the Agent adds useful links or relationship metadata when relevant.
9. Check whether the Agent runs `cargo run -q -p forma-cli -- --workspace <temporary-starter-copy> check --json`.
10. Check whether the Agent runs `cargo run -q -p forma-cli -- --workspace <temporary-starter-copy> knowledge health --json`.
11. Check whether the Agent fixes diagnostics it caused or clearly reports unresolved diagnostics.

## Expected Results

- Writes remain file-backed Markdown changes in the selected workspace.
- The Agent uses starter schema and guidelines to choose the target space, path, frontmatter, and links.
- New shared page creation goes through a dry-run summary before editing unless the user has already approved the exact target and scope.
- Verification commands run after the write.
- The final answer includes changed paths, command summaries, and any remaining diagnostics.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Built-in and workspace-projected skill discovery.
- Write boundary.
- Post-write verification.
- Knowledge classification.
- Link and reference hygiene.
- File-backed source-of-truth behavior.

## Evidence Or Execution Notes

Record the temporary workspace path, edited files, verification summaries, and whether diagnostics were introduced.

## Open Questions

- Should this pressure test be automated with a disposable workspace fixture once create/update commands mature?
