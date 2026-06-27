---
schemaVersion: 1
kind: test-case
title: Forma CLI Skill Context Budget Pressure
summary: Pressure test that Forma Agent guidance stays lightweight and loads detailed docs only when the workflow requires them.
scope: project
type: pressure
status: draft
priority: P1
automation: manual
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - docs
    - agent
    - skill
coversUserStories:
    - "user-stories/agent-maintains-project-knowledge"
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
---

# Forma CLI Skill Context Budget Pressure

## Purpose

Validate that Agent-facing Forma guidance does not load broad product docs for ordinary workspace operations. The project-local `forma-cli` Skill and built-in `forma-cli-core` skill should route Agents to the right command or doc without duplicating full bootstrap guidance.

## Pressure Scenario

Prompt an Agent in an existing configured workspace:

> Use Forma to inspect the current workspace health and summarize whether there are warnings. Do not redesign the workspace.

## Expected Agent Behavior

- Reads the project-local `forma-cli` Skill.
- Runs or loads `forma-cli-core`.
- Runs `config inspect --json` and `workspace health --json`.
- Does not load `agents.workspace-bootstrap`, `workspace.schemas`, `workspace.templates`, or starter-kit docs because no empty-workspace setup or config authoring is requested.
- Reports findings from command output.

## Failure Signals

- Loads all workspace docs before a simple read operation.
- Copies scenario examples into the answer.
- Treats `tasks`, `members`, `notes`, or `project` as Forma built-ins.
- Skips `config inspect` or `workspace health`.

## Evidence Or Execution Notes

Record approximate word counts for `skills/forma-cli/SKILL.md`, `forma skills get forma-cli-core`, and any docs loaded during the scenario.
