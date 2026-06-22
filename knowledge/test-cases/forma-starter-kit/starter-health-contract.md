---
schemaVersion: 1
kind: test-case
title: Starter Health Contract
summary: Verify that the starter workspace health output is intentional, explainable, and useful for Agent gate checks.
scope: starter-kit
type: contract
status: draft
priority: P1
automation: cli
owners:
    - "members/tiscs"
tags:
    - starter-kit
    - cli
    - health
    - contract
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks: []
---

# Starter Health Contract

## Purpose

Ensure `knowledge health` gives a clean gate signal for the starter workspace and that any warnings are deliberate teaching fixtures rather than accidental broken content.

## Preconditions

- The starter config contract passes.

## Test Data

- Workspace: `examples/forma-starter-kit`
- Command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit knowledge health --json`

## Steps

1. Run the health command.
2. Inspect `status`, `summary`, `diagnostics`, and `findings`.
3. Confirm there are no errors.
4. Confirm warnings, if any, are documented in the starter README or this test case.
5. Confirm no persistent index file is required or generated.

## Expected Results

- Health status is `passed` or has only intentional warnings.
- Broken references, localized-only primary pages, and local-only leaks are not present unless intentionally documented.
- The command writes no hidden index file.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- In-memory index behavior.
- Link and backlink diagnostics.
- Language variant health.
- Starter reliability as a skill gate fixture.

## Evidence Or Execution Notes

Record warning counts and explain whether each warning is intentional.

## Open Questions

- Should the starter keep one intentional health warning for demonstration, or remain warning-free?
