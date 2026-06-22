---
schemaVersion: 1
kind: test-case
title: Starter Schema Quality Contract
summary: Verify that starter space schemas and create inputs are strong enough to guide Humans and Agents through common knowledge operations.
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
    - schema
    - contract
covers_user_stories: []
covers_product:
    - "product/choral-forma"
related_tasks: []
---

# Starter Schema Quality Contract

## Purpose

Validate that the starter workspace expresses its content model through Forma configuration rather than through hidden application behavior or old workflow assumptions.

## Preconditions

- The starter config contract passes.
- The starter includes notes, tasks, members, and guidelines spaces.

## Test Data

- Workspace: `examples/forma-starter-kit`
- Command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`

## Steps

1. Run the config inspect command.
2. Confirm each starter space has an `include` pattern, display metadata, a template, create inputs, and schema fields appropriate to its role.
3. Confirm task-like fields include status, readiness, priority, assignees, owners, reviewers, and blockers.
4. Confirm relationship fields use explicit ref targets where the target is known, such as task assignees to members and task blockers to tasks.
5. Confirm guideline pages can express ownership and review without requiring a separate workflow system.
6. Confirm `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json` still passes after schema inspection.

## Expected Results

- The starter schema is sufficient for Agents to classify and inspect starter content without relying on old workflow skill rules.
- Relationships that matter for navigation and graph views are represented as structured fields or links.
- Create inputs support basic writes without forcing every operation through manual frontmatter editing.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Starter content model.
- Structured metadata.
- Relationship fields.
- CLI-guided creation surface.
- Schema-based replacement for data-shape checks previously described by workflow skills.

## Evidence Or Execution Notes

Record missing fields, unclear enum values, or relationship fields that should become typed refs.

## Open Questions

- Should task `status` and `readiness` be machine-validated as enum values during `check`, or remain soft guidance until schema validation is expanded?
