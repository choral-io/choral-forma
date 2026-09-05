---
scope: project
title: Workspace Onboarding And Routing
summary: Agent-facing entrypoint for understanding the Forma workspace, choosing the right workflow skill, and routing user requests without writing prematurely.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - onboarding
    - routing
    - agents
skill:
    id: workspace-onboarding-and-routing
    title: Workspace Onboarding And Routing
    description: Route unclear Forma workspace requests to the configured space, focused guideline skill, and safe next action.
    projection: section
    order: 12
sources:
    - "guidelines/forma-workspace-operations"
    - "guidelines/content-maintenance"
    - "guidelines/task-selection"
---

# Workspace Onboarding And Routing

## Purpose

This guideline is the lightweight entrypoint that replaces the old team-facing workflow assistant role. Use it to orient a Human or Agent before choosing a narrower workflow.

It is read-only by default. It does not authorize shared content writes, task state changes, config edits, or local worklist execution.

## Agent Skill

### When To Use

Use this skill when:

- the user asks how this workspace is organized;
- the request is broad, unclear, or could belong to several spaces;
- the Agent needs to decide whether to use authoring, delivery, audit, proposal, or local execution guidance;
- the workspace state appears stale, missing, contradictory, or migrated from older workflow material;
- the user asks for a next prompt, recovery path, or safe operating boundary.

### Bootstrap

Follow the common bootstrap in `skills get workspace-operations` ([[guidelines/forma-workspace-operations]]) using this repository's CLI invocation. Reuse current results and load only the guideline needed for this request.

### Routing Rules

- Use [[guidelines/proposal-and-dry-run]] when the request may change shared content, task state, release evidence, config, schemas, views, guidelines, or skill metadata.
- Use [[guidelines/content-maintenance]] when the user approved Markdown authoring, content placement, capture, cleanup, or promotion.
- Use [[guidelines/task-selection]] when the user asks about next tasks, readiness, task metadata, delivery state, board moves, or a named Task implementation/review.
- Use [[guidelines/workspace-audit-and-reporting]] when the user asks for workspace status, health, schema consistency, stale content, task metadata issues, or a report.
- Use [[guidelines/local-worklist-and-execution]] when the user asks to manage member-local work, logs, drafts, or execution notes.
- Use [[guidelines/forma-product-model-and-configuration-fidelity]] when a request changes or interprets Forma concepts, configuration, reserved identifiers, path behavior, classification, or publication boundaries.
- Use [[guidelines/forma-runtime-cache-and-performance]] for workspace loading, caches, snapshots, static generation, or performance changes.
- Use project-specific guidelines such as [[guidelines/dependency-governance]] only when their topic appears in the task or inspected target.

### Stop Rules

Stop at routing guidance when:

- the user asked for evaluation, explanation, onboarding, or a recommendation only;
- the target configured space is ambiguous;
- the operation would promote local-only material without approval for that audience;
- the next action requires approval under [[guidelines/proposal-and-dry-run]].

### Output

Respond with:

- request classification;
- relevant configured spaces or files;
- recommended skill or guideline;
- one safe next action;
- actions to avoid until approved.

### Completion Criteria

Finish routing when the request class, configured target or unresolved ambiguity, one focused skill, one safe next action, and all applicable stop or approval boundaries are explicit.
