---
schemaVersion: 1
kind: test-case
title: Starter Skill Interface Contract
summary: Verify the Forma skills command contract for stable Agent-facing skill discovery and retrieval.
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
    - skill
    - contract
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Skill Interface Contract

## Purpose

Verify that `forma skills` is a stable Agent-facing interface: Agents can discover available skills, retrieve the right skill content, handle errors, and avoid falling back to workspace-specific path assumptions.

## Preconditions

- The starter config contract passes.
- The starter guideline discovery contract passes.
- The command runs from the repository root unless a test case explicitly changes the working directory.

## Test Data

- Workspace: `examples/forma-starter-kit`
- List command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills list --json`
- Built-in get command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get forma-cli-core`
- Projected task skill command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get starter-task-selection`
- Projected workspace skill command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get starter-workspace-operations`
- Missing skill command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get missing-skill`

## Steps

1. Run the list command.
2. Confirm the JSON status is `passed`.
3. Confirm the list includes `forma-cli-core`, `starter-workspace-operations`, and `starter-task-selection`.
4. Confirm each listed skill has stable Agent-facing fields: `id`, `title`, `description`, `source`, `sourcePath`, `order`, and `triggers`.
5. Confirm `forma-cli-core` has `source: builtIn` and `sourcePath: builtin:forma-cli-core`.
6. Confirm projected starter skills have `source: guideline` and source paths that point to ordinary starter Markdown guideline files.
7. Run each get command for the built-in and projected skills.
8. Confirm each get command returns readable Markdown with a frontmatter-like header and enough guidance for an Agent to act.
9. Confirm projected skill output is derived from the guideline content rather than a separate duplicated skill document.
10. Run the missing skill command.
11. Confirm the missing skill fails clearly and does not suggest hard-coded guideline paths or hidden fallback behavior.
12. Repeat the list and get commands from outside the starter workspace using `--workspace`, and confirm the results still point at the starter workspace.

## Expected Results

- `skills list --json` is stable enough for Agent routing and automation assertions.
- `skills get` is stable enough for direct Agent reading.
- Built-in and projected skills are distinguishable by `source` and `sourcePath`.
- Missing skill ids produce clear errors.
- Correct workspace selection is controlled by the CLI workspace option or current workspace root, not by repository-specific path guessing.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Skills list contract.
- Skills get contract.
- Built-in skill packaging.
- Guideline-projected skill packaging.
- Missing skill error behavior.
- Workspace selection behavior.

## Evidence Or Execution Notes

Record command output summaries, returned skill ids, source paths, and the missing-skill error text.

## Open Questions

- Should malformed skill metadata be reported by `skills list`, `check`, or both?
- Should `skills get` support JSON output for machine clients, or is Markdown output the primary Agent contract?
