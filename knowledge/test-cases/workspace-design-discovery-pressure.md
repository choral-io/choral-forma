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

### 2026-06-30 Lab Calibration Discovery Run

Temporary workspace: `/private/tmp/forma-discovery-lab.80YKFz`.

Design brief:

- Business outcome: track calibration status, due dates, and certificate evidence for lab instruments.
- Content candidates: instruments, calibration records, vendors, certificates, maintenance events.
- First slice: `calibrations`, because users can create two real records immediately and verify due-date tracking.
- Deferred slices: instruments, vendors, certificates, maintenance events.
- Lifecycle fields: `status`, `performedDate`, `dueDate`.
- Retrieval fields: `instrumentName`, `calibrationType`, `status`, `dueDate`, `vendorName`, `tags`.
- Relationship strategy: use scalar `instrumentName` and `vendorName` in the first slice; defer `entryRef` fields until `instruments` and `vendors` spaces exist.
- Operating rules: defer guidelines until the first records prove the review workflow.
- Verification path: `config inspect`, `check`, `create`, `list`, `inspect`, `workspace health`.

Loaded docs:

- `forma-cli-core`
- `agents.workspace-design-discovery`
- `agents.workspace-bootstrap`
- `workspace.configuration`
- `workspace.spaces`
- `workspace.schemas`
- `workspace.templates`

No example workspace content was loaded or copied.

Context budget evidence:

```text
122  skills/forma-cli/SKILL.md
490  docs/agents/forma-cli-core.md
413  docs/agents/workspace-design-discovery.md
1027 docs/agents/workspace-bootstrap.md
```

Verification results:

- `forma init --name "Lab Calibration" --json`: passed and wrote only `.forma.md` plus `.agents/skills/forma-cli/SKILL.md`.
- `forma skills list --json`: passed and returned only the built-in `forma-cli-core` skill.
- `forma config inspect --json`: passed and reported `spaces.calibrations`.
- `forma check --json`: passed after the first-slice config and sample records were present.
- `forma create calibrations ... --json`: passed for two records.
- `forma list --space calibrations --json`: the plan's original sample with `performedDate=""` failed `schema.format.invalid` for a `date` field; after removing the optional empty `performedDate` from the due calibration record, the command passed and returned both records.
- `forma inspect calibrations/pipette-p-200-quarterly-calibration.md --json`: passed.
- `forma workspace health --json`: after removing the invalid empty `performedDate`, the command returned `status: warning` with isolated-page `noBacklinks` and `noOutgoingReferences` findings, which matched the expected relationship feedback for an unlinked first slice.
