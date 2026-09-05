---
scope: project
title: Proposal And Dry-Run Guidance
summary: Short Agent-facing procedure for deciding when to stop, produce a dry run, or create a proposal before shared workspace changes.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - agents
    - dry-run
    - proposal
skill:
    id: proposal-and-dry-run
    title: Proposal And Dry Run
    description: Decide write authority, preview scope, and proposal needs for shared content, Task state, configuration, or private-to-shared promotion.
    projection: section
    order: 15
sources:
    - "guidelines/forma-workspace-operations"
    - "guidelines/content-maintenance"
    - "guidelines/task-selection"
    - "tasks/define-agent-markdown-authoring-workflow"
---

# Proposal And Dry-Run Guidance

## Agent Skill

### When To Use

Before shared content, Task metadata, product decisions, guidelines, schemas, Views, templates, or Forma configuration writes; also before increasing the audience of local or private material.

### Bootstrap

Follow `skills get workspace-operations` ([[guidelines/forma-workspace-operations]]) using this repository's CLI invocation. Reuse its current baseline.

### Stop Rules

Compare the concrete change with the latest user authorization. A request to implement or optimize authorizes necessary reversible edits within its accepted scope. A preview makes those edits reviewable; it is not an automatic second approval round.

Pause only the dependent action when its target remains ambiguous, it expands scope or visibility, or it requires authority not yet given. Evaluation, selection, and recommendation requests remain read-only. Continue independent work while a required decision is pending.

Task and board changes require explicit approval for their target state and metadata. Selection or code implementation alone does not approve a board move.

### Direct Edit Fast Path

For an approved, unambiguous single-file wording or narrow metadata edit without new references, promotion, or lifecycle changes, proceed directly to authoring and verification. Use the preview below for broader edits or changed constraints.

### Configured Create Preview

Before an approved CLI create, run the same inputs with `--preview --json`. A writable path and valid preview are evidence, not authorization or a lock. Repeat when inputs or effective configuration change.

### Dry-Run Output

State target paths and configured space, source evidence, intended changes and references, audience, material risks, verification, and any decision still needed. Reuse a concrete plan already given; a short paragraph or table is sufficient.

End with `Requires confirmation: no — within the approved scope` or `Requires confirmation: yes — <specific unresolved decision>`. In the latter case, wait for that decision before the dependent write; elapsed time is not approval.

### Proposal Choice

Use a proposal when a valuable product or architecture direction is not accepted or evidence conflicts. Distinguish observed facts, inferences, assumptions, and acceptance questions. Routine fixes to accepted behavior do not require a new proposal or design record.

### Reference Routing

For Task, promotion, product, release, or guideline/config scenarios, load this skill with `--full` for the relevant reference below.

### Completion Criteria

The write target, scope, audience, evidence, and verification are concrete. Every required authorization is already present or its dependent action remains pending. Follow [[guidelines/content-maintenance]] to author and [[guidelines/forma-workspace-operations]] to verify.

## Reference

When changing this procedure or its projections, walk through [[test-cases/proposal-and-dry-run-guideline-pressure]] to verify both approval boundaries and authorized continuation.

### Scenario Templates

These are decision branches, not additional approval rounds. Reuse authorization for the same target, audience, and scope.

#### Task Or Board Change

Inspect the Task and board, verify its current state and acceptance criteria, and apply [[guidelines/task-selection]]. Preserve metadata outside the approved transition. Completion requires acceptance evidence, not merely an execution report.

#### Local-To-Shared Promotion

Identify the private source, destination audience, and approved selection of durable facts. Exclude secrets and unnecessary personal/customer data. Do not publish existing private context merely because new handoffs default to team shared.

#### Proposal Creation

Record the proposed canonical target, supporting sources, tradeoffs, open decisions, and acceptance criteria. Keep the proposal visibly unaccepted until a decision authorizes canonical updates.

#### Product Or Architecture Decision

Reuse accepted design and inspect later decisions before changing it. Propose unresolved behavior rather than presenting generated or conversation-only assumptions as accepted facts.

#### Release Evidence Or Cutline Change

Release work must additionally load `release-execution-and-verification`; inspect the exact candidate and follow its local, CI, and publication gates.

#### Milestone Or Release Evidence

Apply the release branch above; preserve historical validation records and distinguish local checks from published-release evidence.

#### Guideline Or Config Change

Identify affected paths, skill IDs, projections, and consumers. Preserve stable identifiers and machine anchors. Verify discovery and default/required full projections through the workspace-operations procedure.
