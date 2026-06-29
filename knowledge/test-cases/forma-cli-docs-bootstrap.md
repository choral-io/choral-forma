---
schemaVersion: 1
kind: test-case
title: Forma CLI Docs Bootstrap Evaluation Suite
summary: Test suite for validating docs-backed Forma CLI and Agent bootstrap from an empty project.
scope: project
type: suite
status: active
priority: P0
automation: mixed
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - docs
    - agent
    - bootstrap
coversUserStories:
    - "user-stories/agent-maintains-project-knowledge"
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
---

# Forma CLI Docs Bootstrap Evaluation Suite

## Purpose

Validate that Forma CLI, embedded product docs, and Agent-facing skill output can guide Human and Agent collaboration from an empty project to a valid first content workflow.

## Pressure Tests

- [[test-cases/docs-backed-agent-bootstrap-pressure]]
- [[test-cases/scenario-driven-workspace-bootstrap-pressure]]
- [[test-cases/forma-cli-skill-context-budget-pressure]]

## Gate Usage

Run this suite before considering changes ready for review when the change affects:

- `docs/agents/**`;
- `docs/workspace/**` pages used by empty-workspace setup;
- `forma skills` output or embedded skill projection;
- `forma init` output or generated Agent runtime skill content.

Minimum evidence:

- wrong-config baseline still fails for the expected reason;
- guided `kind: term` + `taxonomy: spaces` content group setup passes;
- scenario-driven bootstrap asks clarifying questions and implements only the first confirmed slice;
- ordinary workspace operations load the lightweight Skill and core guide without pulling all bootstrap docs into context;
- `check`, `create`, `list`, `inspect`, and `view render` pass for the guided content group;
- isolated-page health warnings are reported as relationship feedback and can be cleared by adding explicit links.

## Evaluation Boundary

- Focus on docs-backed bootstrap from empty projects.
- Do not require `examples/getting-started-workspace` or this repository's project knowledge structure.
- Treat configured content groups as user-defined patterns, not built-in Forma domain objects.
- Treat Skill context as a budget. Keep the project-local Skill and built-in core guide as routers; load detailed docs only for matching workflows.
