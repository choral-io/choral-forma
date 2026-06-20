---
scope: project
type: task
priority: P0
severity:
value: H
module: app

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - cli
    - agents
    - knowledge-health

effort: M
status: done
readiness: ready
sprint:

blocked_by: []
related_to:
    - "product/product-direction"
    - "architecture/forma-p0-operation-api-spec"
    - "tasks/expose-read-only-knowledge-health-in-webapp"
    - "tasks/design-reviewable-operation-proposal-flow"
    - "tasks/design-forma-policy-runtime"
    - "tasks/design-reviewable-forma-write-operations"

reported_by:
affected_area: Forma CLI, Agent skills, repository knowledge management
---

# Replace Knowledge Workflow Mechanics With Forma CLI

## Goal

Use Forma CLI operations and a thin Agent skill for repository knowledge checks, task inventory, task board reads, health inspection, and page inspection.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/expose-read-only-knowledge-health-in-webapp]]
- [[tasks/design-reviewable-operation-proposal-flow]]

## In Scope

- Make this repository's `knowledge/` directory readable as a Forma workspace.
- Add read-only Forma operations for knowledge health, task inventory, and task board state.
- Expose those operations through RPC and CLI JSON.
- Add a project-local `forma-cli` skill that routes Agent read, audit, and selection work through the CLI.
- Keep all indexing startup-scan and in-memory without a committed summary index.

## Out of Scope

- Forma MCP implementation.
- Write-capable task, metadata, or knowledge repair operations.
- Replacing reviewable change proposals with direct Agent edits.
- Productizing the repository's current Knowledge Workflow rules wholesale.

## Acceptance Criteria

- The repository knowledge base can be read as a Forma workspace.
- `forma knowledge health --json` reports reference and backlink health without a persistent index file.
- `forma tasks list --json` and `forma tasks inspect ... --json` expose task metadata.
- `forma board show --json` groups tasks by the repository Kanban columns while preserving readiness metadata.
- `.agents/skills/forma-cli/SKILL.md` routes Agent read, audit, and selection work through Forma CLI.
- MCP remains out of scope for this release slice.

## Follow-up

- Design Forma writable operations as proposal/dry-run/apply flows in [[tasks/design-reviewable-forma-write-operations]].
- Introduce machine-readable policies only when an operation can consume them through [[tasks/design-forma-policy-runtime]].
- Start policy execution with task audit and task status movement rather than a broad policy engine.
