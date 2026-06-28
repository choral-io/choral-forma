---
schemaVersion: 1
kind: test-case
title: Starter Config Contract
summary: Verify that the starter workspace exposes the expected Forma configuration contract without project-specific assumptions.
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
    - config
    - contract
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/run-starter-kit-agent-pressure-validation"
---

# Starter Config Contract

## Purpose

Verify that `examples/forma-starter-kit` works as a clean, reusable Forma workspace whose structure is discoverable from `.forma.md` and imported configuration nodes.

## Preconditions

- The repository is checked out with dependencies installed.
- The command runs from the repository root.

## Test Data

- Workspace: `examples/forma-starter-kit`
- Command: `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`

## Steps

1. Run the config inspect command.
2. Confirm the operation status is `passed`.
3. Confirm the config contains workspace identity, supported languages, runtime values, spaces, views, dashboard sections, and semantic types.
4. Confirm all paths are workspace-relative and no `workspace.root` configuration field is present.
5. Confirm any configured guidelines are ordinary Markdown paths inside the starter workspace.
6. Confirm the starter workspace's Agent bootstrap material has a canonical `skills/forma-cli/SKILL.md` source and an aligned `.agents/skills/forma-cli/SKILL.md` runtime entrypoint when Agent bootstrap is enabled.

## Expected Results

- The starter config is self-contained and does not depend on this repository's `knowledge/` layout.
- The config can be used by Agents without hard-coded paths.
- The starter remains safe to copy as a user template.
- The Agent bootstrap skill is a reviewable starter file, not a generated copy of workspace-projected guideline skills.

## Coverage

- Suite index: [[test-cases/forma-starter-kit]]
- Forma config discovery.
- Starter workspace portability.
- Agent bootstrap contract.

## Evidence Or Execution Notes

Record the JSON summary and any unexpected diagnostics.

## Open Questions

- Which starter guidelines should be mandatory for the first evaluation version?
