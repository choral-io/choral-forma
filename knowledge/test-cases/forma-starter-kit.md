---
schemaVersion: 1
kind: test-case
title: Forma Starter Kit Evaluation Suite
summary: Test suite for validating the starter workspace as a Forma CLI, WebApp, and Agent skill evaluation fixture.
scope: starter-kit
type: suite
status: active
priority: P1
automation: mixed
owners:
    - "members/tiscs"
tags:
    - starter-kit
    - evaluation
    - cli
    - skill
coversUserStories:
    - "user-stories/agent-maintains-project-knowledge"
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Forma Starter Kit Evaluation Suite

## Purpose

This suite defines project-level validation cases for `examples/forma-starter-kit`. The starter workspace should remain clean and copyable for users, while these test cases live in the Forma project knowledge base as evaluation assets.

This suite is part of the validation chain for [[releases/next-internal-release]] and [[metrics/knowledge-workflow-replacement-readiness]].

## Contract Tests

- [[test-cases/forma-starter-kit/starter-config-contract]]
- [[test-cases/forma-starter-kit/starter-health-contract]]
- [[test-cases/forma-starter-kit/starter-guideline-discovery-contract]]
- [[test-cases/forma-starter-kit/starter-schema-quality-contract]]

## Agent Pressure Tests

- [[test-cases/forma-starter-kit/starter-task-selection-pressure]]
- [[test-cases/forma-starter-kit/starter-blocked-to-done-pressure]]
- [[test-cases/forma-starter-kit/starter-review-to-done-pressure]]
- [[test-cases/forma-starter-kit/starter-write-verify-pressure]]
- [[test-cases/forma-starter-kit/starter-local-only-promotion-pressure]]
- [[test-cases/forma-starter-kit/starter-language-variant-pressure]]

## Skill Mode Bootstrap

Agent-facing tests should exercise the current Forma skill mode:

1. Load the built-in CLI guide with `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills get forma-cli-core`.
2. Discover workspace-projected skills with `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit skills list --json`.
3. Load `starter-workspace-operations` for starter knowledge, local-only, language-variant, and write-classification workflows.
4. Load `starter-task-selection` for starter task selection, blocker, review, and status workflows.
5. Use `--workspace examples/forma-starter-kit` whenever the Agent is not executing from the starter workspace root.

## Evaluation Boundary

- Keep evaluation assets outside `examples/forma-starter-kit` so users can copy the starter without test-only material.
- Use the starter workspace to validate Forma product principles, CLI/RPC contracts, WebApp behavior, and the `forma-cli` skill gate.
- Do not copy this repository's project knowledge structure into the starter unless the structure is also a product-level starter recommendation.
