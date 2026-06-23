---
schemaVersion: 1
kind: user-story
title: Agent Maintains Project Knowledge
summary: An Agent can use Forma configuration, guidelines, diagnostics, and repository Markdown to maintain project knowledge without relying on hidden workflow skills.
scope: project
type: user-story
status: active
owners:
    - "members/tiscs"
tags:
    - agents
    - knowledge
    - workflow
actors:
    - Agent
    - Human maintainer
relatedProduct:
    - "product/product-direction"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedMetrics:
    - "metrics/knowledge-workflow-replacement-readiness"
---

# Agent Maintains Project Knowledge

## User Or Actor

An Agent working with a Human maintainer in the Choral Forma repository.

## Goal

The Agent can inspect the configured Forma workspace, read the relevant guidelines, propose or perform approved knowledge updates, and verify the result with Forma diagnostics.

## Context

The repository previously depended on separate `knowledge-workflow` skills for many soft workflow rules. The current product direction is to make Forma itself provide the configured structure, diagnostics, and guidance needed for repository-backed knowledge work.

## Value

This story validates Forma's core promise: project knowledge remains ordinary Markdown, but Humans and Agents can still operate with shared structure, reviewability, and workflow guidance.

## Story Or Use Case

As an Agent, I want to discover the knowledge workspace structure and operating guidelines from Forma configuration so that I can help maintain project knowledge without hard-coded repository assumptions.

## Main Flow

1. The Agent runs `forma config inspect`.
2. The Agent reads the configured guidelines.
3. The Agent uses Forma list, inspect, task, check, and health operations as evidence.
4. The Agent proposes a dry run before multi-file shared knowledge edits.
5. After approval, the Agent edits the smallest set of Markdown files.
6. The Agent verifies the result with `forma check` and `forma knowledge health`.
7. The Agent reports files changed, durable facts added, checks run, and residual risks.

## Alternate Or Exception Flows

- If diagnostics fail, the Agent reports the failure before changing unrelated content.
- If source material is local-only or private, the Agent asks before promoting it to shared knowledge.
- If a guideline gap is found, the Agent reports the gap instead of inventing hidden rules.

## Acceptance Intent

This story is satisfied for the next internal release when the starter-kit pressure validation demonstrates that the workflow is discoverable, repeatable, and reviewable using Forma CLI plus configured guidelines.

## Related Knowledge

- [[releases/next-internal-release]]
- [[metrics/knowledge-workflow-replacement-readiness]]
- [[guidelines/forma-knowledge-operations]]
- [[guidelines/knowledge-capture]]
- [[guidelines/task-selection]]

## Open Questions

- Which parts of this flow should eventually become reviewable write operations?
- Which parts should remain soft Human/Agent guidance?
