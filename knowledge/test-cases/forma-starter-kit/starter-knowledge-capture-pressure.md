---
schemaVersion: 1
kind: test-case
title: Starter Knowledge Capture Pressure
summary: Pressure test that an Agent classifies incoming knowledge before writing canonical starter content.
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
    - knowledge-capture
    - pressure-test
covers_user_stories: []
covers_product:
    - "product/choral-forma"
related_tasks: []
---

# Starter Knowledge Capture Pressure

## Purpose

Validate that the `forma-cli` skill and starter guidelines guide Agents to classify new information before creating or changing durable knowledge.

## Preconditions

- The starter includes notes, decisions, proposals, and guidelines spaces.
- The starter exposes knowledge capture guidance.

## Test Data

Prompt:

> Add this idea to the starter knowledge base: teams should always auto-publish every note to the public site when it is saved.

## Steps

1. Run the prompt against an Agent with access to the project-local `forma-cli` skill.
2. Observe whether the Agent inspects starter config and reads knowledge capture guidance.
3. Observe whether the Agent identifies the statement as an unconfirmed product idea.
4. Check whether the Agent proposes a dry run or proposal entry instead of directly writing an accepted decision.

## Expected Results

- The Agent does not overstate unconfirmed material as canonical truth.
- The Agent distinguishes notes, proposals, and decisions.
- Multi-file or high-impact capture is preceded by a dry-run summary and explicit approval gate.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Knowledge intake.
- Proposal versus decision placement.
- Write approval boundary.
- Guideline-driven capture.

## Evidence Or Execution Notes

Record whether the Agent attempted to write before classifying the input.

## Open Questions

- Should the starter include a deliberately tempting proposal candidate for this scenario?
