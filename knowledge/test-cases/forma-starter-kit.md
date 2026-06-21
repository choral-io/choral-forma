---
schemaVersion: 1
kind: test-case
title: Forma Starter Kit Evaluation Suite
summary: Test suite for validating the starter workspace as a Forma CLI, WebApp, and Agent skill evaluation fixture.
scope: starter-kit
type: suite
status: draft
priority: P1
automation: mixed
owners:
    - "members/tiscs"
tags:
    - starter-kit
    - evaluation
    - cli
    - skill
covers_user_stories: []
covers_product:
    - "product/choral-forma"
related_tasks: []
---

# Forma Starter Kit Evaluation Suite

## Purpose

This suite defines project-level validation cases for `examples/forma-starter-kit`. The starter workspace should remain clean and copyable for users, while these test cases live in the Forma project knowledge base as evaluation assets.

## Contract Tests

- [[test-cases/forma-starter-kit/starter-config-contract]]
- [[test-cases/forma-starter-kit/starter-health-contract]]
- [[test-cases/forma-starter-kit/starter-guideline-discovery-contract]]
- [[test-cases/forma-starter-kit/starter-schema-quality-contract]]
- [[test-cases/forma-starter-kit/starter-shared-profile-selection-contract]]

## Agent Pressure Tests

- [[test-cases/forma-starter-kit/starter-task-selection-pressure]]
- [[test-cases/forma-starter-kit/starter-knowledge-capture-pressure]]
- [[test-cases/forma-starter-kit/starter-blocked-to-done-pressure]]
- [[test-cases/forma-starter-kit/starter-review-to-done-pressure]]
- [[test-cases/forma-starter-kit/starter-write-verify-pressure]]
- [[test-cases/forma-starter-kit/starter-local-only-promotion-pressure]]
- [[test-cases/forma-starter-kit/starter-language-variant-pressure]]

## Evaluation Boundary

- Keep evaluation assets outside `examples/forma-starter-kit` so users can copy the starter without test-only material.
- Use the starter workspace to validate Forma product principles, CLI/RPC contracts, WebApp behavior, and the `forma-cli` skill gate.
- Do not copy this repository's project knowledge structure into the starter unless the structure is also a product-level starter recommendation.
