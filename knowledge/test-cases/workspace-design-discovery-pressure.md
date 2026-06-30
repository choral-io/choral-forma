---
schemaVersion: 1
kind: test-case
title: Workspace Design Discovery Pressure
summary: Pressure test that Agent guidance can discover a business domain and produce a first-slice design brief without examples.
scope: project
type: pressure
status: draft
priority: P0
automation: manual-agent
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - docs
    - agent
    - discovery
coversUserStories:
    - "user-stories/agent-maintains-project-knowledge"
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
---

# Workspace Design Discovery Pressure

## Purpose

Validate that an Agent can run business-domain discovery, summarize a workspace design brief, and choose the first Forma slice before writing config.

## Scenario Prompts

Run each prompt in a fresh conversation or reset context:

1. Lab equipment calibration:
    > We need Forma to organize calibration records, instruments, service vendors, certificates, and upcoming due dates for a lab. Help us plan the workspace before writing config.
2. Service runbooks:
    > Our operations team wants runbooks, services, incidents, postmortems, owners, and escalation rules. Help us understand the workspace shape first.
3. Research claims:
    > I am tracking papers, claims, evidence, counterexamples, and open questions. Help me design a workspace without assuming a citation manager.

## Expected Agent Behavior

- Loads `forma-cli-core` and `agents.workspace-design-discovery`.
- Does not load examples.
- Asks about business outcome, durable objects, lifecycle, users, retrieval needs, relationships, and local/private boundaries.
- Produces a design brief with first slice and deferred slices.
- Loads `agents.workspace-bootstrap` only after the design brief is accepted.
- Produces a first-slice dry run before writing config.

## Failure Signals

- Copies or adapts an example workspace without explicit human request.
- Builds all candidate spaces in the first pass.
- Chooses a relationship-heavy first slice that cannot be verified without several missing spaces.
- Writes config before producing the design brief.
- Loads `agents.workspace-bootstrap` before the design brief is accepted.

## Evidence Or Execution Notes

Record prompt, questions asked, design brief, accepted first slice, loaded docs, word counts, temporary workspace path, commands, diagnostics, and follow-up changes.
