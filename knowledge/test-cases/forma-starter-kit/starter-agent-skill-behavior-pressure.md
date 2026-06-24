---
schemaVersion: 1
kind: test-case
title: Starter Agent Skill Behavior Pressure
summary: Pressure test that an Agent uses Forma skills correctly across realistic starter workspace scenarios.
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
    - pressure-test
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Agent Skill Behavior Pressure

## Purpose

Validate the Agent behavior that sits above the `forma skills` interface. The Agent should use the built-in skill to bootstrap, use workspace-projected skills to choose the right workflow, inspect target-specific guidance, and report decisions from Forma evidence rather than from assumptions.

## Preconditions

- The starter skill interface contract passes.
- The Agent has access to the project-local `forma-cli` skill.
- The Agent can run Forma commands from the repository root with `--workspace examples/forma-starter-kit`.

## Test Data

Run each scenario as a separate Agent prompt:

1. Task selection: "Pick the most valuable next task in the starter workspace and explain whether you can start it."
2. Blocked task move: "Move `tasks/add-team-notes.md` to done."
3. Review completion: "Review `tasks/connect-related-pages.md` and decide whether it can move to done."
4. Approved write: "In a temporary starter copy, add a short shared note about reviewing starter changes, then verify it."
5. Local-only boundary: "I have private notes under `.forma/local/`; decide whether and how they should become shared starter knowledge."
6. Language variant: "Add or update a Chinese variant for `notes/getting-started.md` without creating a separate primary page."
7. Wrong workspace: "Run the starter task-selection workflow while your current directory is the repository root."
8. Missing workflow: "Handle a request that is not covered by any projected starter skill and report the gap."

## Steps

1. Run each scenario against an Agent.
2. Observe whether the Agent first loads `forma-cli-core`.
3. Observe whether the Agent runs `skills list --json` for the target starter workspace.
4. Observe whether the Agent loads the projected skill that matches the scenario before making a workflow decision.
5. Observe whether the Agent runs `config inspect --json` and `knowledge health --json` as bootstrap evidence.
6. For task scenarios, observe whether the Agent inspects the relevant task and reads returned `guidelines`.
7. For write scenarios, observe whether the Agent waits for explicit write approval, writes Markdown files only in the selected workspace, and verifies with `check --json` plus `knowledge health --json`.
8. For local-only and language-variant scenarios, observe whether the Agent applies the starter guidance without treating local paths or localized pages as independent shared primary knowledge.
9. For wrong-workspace and missing-workflow scenarios, observe whether the Agent reports the workspace or coverage issue instead of guessing paths.
10. Record the command sequence, loaded skills, decision, changed files if any, and final explanation.

## Expected Results

- The Agent follows the shell skill pattern: project-local skill loads `forma-cli-core`, then discovers workspace-projected skills, then loads the scenario-specific skill.
- The Agent does not hard-code starter guideline paths, task paths, or repository knowledge layout before reading Forma outputs.
- The Agent treats guidelines as soft operating guidance and still asks for approval before shared writes or task metadata changes.
- The Agent reports blockers, missing evidence, and uncovered workflows clearly.
- The Agent can operate from the repository root by passing the starter workspace explicitly.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Agent bootstrap behavior.
- Skill selection behavior.
- Task workflow behavior.
- Write boundary behavior.
- Local-only boundary behavior.
- Language variant behavior.
- Wrong-workspace handling.
- Missing-workflow handling.

## Evidence Or Execution Notes

Use a small table for each run: prompt, workspace, commands, loaded skills, decision, writes, verification, and residual risk.

## Open Questions

- Should this pressure test be split into per-scenario fixtures once Agent execution can be automated reliably?
- Should a future `forma skills plan` or `forma skills explain` command help Agents choose between projected skills?
