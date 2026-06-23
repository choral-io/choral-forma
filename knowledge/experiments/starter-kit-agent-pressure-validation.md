---
schemaVersion: 1
kind: experiment
title: Starter Kit Agent Pressure Validation
summary: Validates whether Agents can use Forma CLI and configured guidelines to manage knowledge workflows against the starter-kit pressure cases.
scope: project
type: experiment
status: planned
owners:
    - "members/tiscs"
tags:
    - experiment
    - validation
    - agents
hypothesis: "Agents can discover and follow the intended knowledge workflow from Forma configuration, guidelines, test cases, and task records without hard-coded repository assumptions."
metrics:
    - "metrics/knowledge-workflow-replacement-readiness"
guardrails:
    - "Do not require old knowledge-workflow skills."
    - "Do not move private local material into shared knowledge without approval."
    - "Do not expand internal release scope to broad write-operation automation."
relatedReleases:
    - "releases/next-internal-release"
relatedUserStories:
    - "user-stories/agent-maintains-project-knowledge"
---

# Starter Kit Agent Pressure Validation

## Hypothesis

Agents can discover and follow the intended knowledge workflow from Forma configuration, guidelines, test cases, and task records without hard-coded repository assumptions.

## Method

Use [[test-cases/forma-starter-kit]] and [[tasks/run-starter-kit-agent-pressure-validation]] as the execution source.

## Metrics

- [[metrics/knowledge-workflow-replacement-readiness]]

## Guardrails

- Do not require old `knowledge-workflow` skills.
- Do not move private local material into shared knowledge without approval.
- Do not expand the internal release scope to broad write-operation automation.

## Outcome

Record the outcome after the pressure validation task is reviewed.
