---
scope: project
title: Workspace Audit And Reporting
summary: Read-only Agent procedure for workspace health checks, task metadata audits, status reports, and diagnostic summaries.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - audit
    - reporting
    - agents
skill:
    id: workspace-audit-and-reporting
    title: Workspace Audit And Reporting
    description: Use when an Agent needs to audit workspace health, task metadata, schema consistency, status, stale claims, or produce a read-only project knowledge report.
    triggers:
        - workspace audit
        - schema audit
        - task metadata audit
        - status report
        - health report
        - stale knowledge
        - readiness report
    order: 18
sources:
    - "guidelines/forma-workspace-operations"
    - "guidelines/content-maintenance"
    - "guidelines/task-selection"
    - "guidelines/proposal-and-dry-run"
---

# Workspace Audit And Reporting

## Purpose

This guideline consolidates the old read-only audit and status-report role. It helps Agents diagnose workspace structure, task quality, content health, and delivery state without silently changing files.

Audits are read-only unless the user separately approves a specific repair through [[guidelines/proposal-and-dry-run]].

## Agent Skill

### When To Use

Use this skill when the user asks for:

- workspace health, schema, link, or placement diagnosis;
- task metadata, readiness, blocker, owner, or board consistency checks;
- project status, release readiness, delivery progress, or knowledge-base report;
- stale, contradictory, duplicate, orphaned, or localized-only content detection;
- dry-run repair suggestions without applying them.

### Bootstrap

Run or confirm current output from:

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- config summary --sources --json`
- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`

For task audits, also run:

- `cargo run -q -p forma-cli -- list --space tasks --json`
- `cargo run -q -p forma-cli -- view render .forma/views/task-board --json`

Inspect specific entries before reporting item-level findings.

### Audit Rules

- Separate machine diagnostics from human judgment.
- Separate field-based, board-based, link-based, git-based, test-based, and inferred evidence.
- Treat task `status` as board membership and `readiness` as executability.
- Treat proposals as unaccepted until their status and related canonical target show acceptance.
- Treat repository-excluded local files as workflow-local context unless the user selected them for review. Do not claim that Forma paths provide privacy.
- Report stale or contradictory claims with source paths instead of choosing silently.
- Do not repair files during an audit unless a confirmed dry run already approved the exact change.

### Report Shape

Use the smallest report that answers the question:

- `Scope`: spaces, views, files, or task set inspected.
- `Evidence`: commands and key files used.
- `Findings`: ordered by impact, with file paths.
- `Dry-run fixes`: concrete repairs that would require approval.
- `Requires judgment`: decisions the Agent cannot make safely.
- `Residual risk`: checks not run or evidence not available.

For status reports, include `Reliability`: `verified`, `partial`, or `inferred`.

### Handoff To Write Work

When an audit finds repair work:

1. Summarize the smallest coherent fix.
2. Point to the target guideline: [[guidelines/content-maintenance]], [[guidelines/task-selection]], or [[guidelines/proposal-and-dry-run]].
3. Stop unless the user explicitly approves the exact repair scope.
