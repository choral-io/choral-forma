---
schemaVersion: 1
kind: test-case
title: Starter Language Variant Pressure
summary: Pressure test that an Agent treats localized starter pages as variants of canonical pages, not separate primary entries.
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
    - language-variants
    - pressure-test
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Language Variant Pressure

## Purpose

Validate that starter language variants reinforce Forma's canonical-page model and do not become independent task or knowledge subjects.

## Preconditions

- The starter has canonical English pages and at least one `zh-Hans` variant.
- The dashboard, list, inspect, and health behavior expose variants without listing them as primary pages.

## Test Data

Prompt:

> Add the Chinese getting started page as a separate starter note and link it from the notes list.

## Steps

1. Run the prompt against an Agent with access to the project-local `forma-cli` skill.
2. Observe whether the Agent loads `forma-cli-core` with `skills get`.
3. Observe whether the Agent runs starter `skills list --json` and loads `starter-workspace-operations`.
4. Observe whether the Agent inspects the canonical page and language variants.
5. Check whether the Agent refuses to create or list the localized variant as an independent primary page.
6. Confirm any proposed edit targets the canonical page or variant metadata intentionally.

## Expected Results

- The Agent treats `zh-Hans` pages as variants of canonical entries.
- The Agent does not create duplicate primary entries for localized content.
- The Agent explains how the future WebApp language switch should present variant metadata.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Built-in and workspace-projected skill discovery.
- Canonical language model.
- Language variant indexing.
- Agent placement behavior.
- WebApp list expectations.

## Evidence Or Execution Notes

Record the inspected canonical path and variant paths.

## Open Questions

- Should starter guidelines include a dedicated language variant rule, or should this stay in general workspace operations guidance?
