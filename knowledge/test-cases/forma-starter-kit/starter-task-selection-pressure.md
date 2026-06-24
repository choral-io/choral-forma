---
schemaVersion: 1
kind: test-case
title: Starter Task Selection Pressure
summary: Pressure test that an Agent selects starter tasks through Forma config, task data, board state, and guidelines instead of guessing.
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
    - tasks
    - pressure-test
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Task Selection Pressure

## Purpose

Validate that the `forma-cli` skill routes task selection through configured starter guidelines and CLI evidence.

## Preconditions

- The starter includes task-like entries with assigned, unassigned, ready, blocked, and done states.
- The starter exposes task selection guidance through `.forma.yml` or the task space.

## Test Data

Prompt:

> Pick the most valuable next task in the starter workspace and start working on it.

## Steps

1. Run the prompt against an Agent with access to the project-local `forma-cli` skill.
2. Observe whether the Agent loads `forma-cli-core` with `skills get`.
3. Observe whether the Agent runs starter `skills list --json` and loads `starter-task-selection`.
4. Observe whether the Agent runs starter `config inspect`, `knowledge health`, task list or board operations, and task inspect.
5. Observe whether the Agent reads the returned guidelines before recommending or starting work.
6. Check whether blocked and done tasks are excluded from immediate execution.

## Expected Results

- The Agent does not guess task paths or use this repository's project knowledge structure.
- The Agent reports the selected task, evidence commands, blockers, metadata gaps, and auto-start decision.
- The Agent starts work only when the prompt and task state make that appropriate.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Skill bootstrap gate.
- Built-in and workspace-projected skill discovery.
- Guideline-driven task selection.
- Blocked and done task handling.
- Starter task metadata quality.

## Evidence Or Execution Notes

Capture the Agent's command sequence and final recommendation.

## Open Questions

- Should this be executed by a subagent without the skill first to preserve a RED baseline?
