---
scope: project
type: task
title: Clean Obsolete Knowledge Workflow Language
summary: Remove obsolete Knowledge Workflow compatibility wording from current Forma knowledge.
priority: P0
severity:
value: H
module: knowledge

owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - knowledge
    - migration
    - cleanup
    - historical

effort: S
status: done
readiness: ready
sprint:

blockedBy: []
relatedTo:
    - "architecture/repository-forma-workspace-migration-design"
    - "planning/repository-knowledge-content-migration-audit"
    - "tasks/migrate-repository-knowledge-content"

reportedBy:
affectedArea: Repository knowledge content migration
---

# Clean Obsolete Knowledge Workflow Language

## Goal

Remove wording that presents the old Knowledge Workflow system as a current compatibility target, while preserving intentional migration history where it is still useful.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[planning/repository-knowledge-content-migration-audit]]
- [[tasks/audit-repository-knowledge-migration-scope]]
- [[tasks/migrate-repository-knowledge-content]]

## In Scope

- Rewrite current product, guideline, and planning language that still assumes Knowledge Workflow compatibility.
- Keep references that are clearly migration history, replacement rationale, or test-case context.
- Prefer current Forma terms for task selection, knowledge capture, guidelines, and checks.

## Out of Scope

- Removing all historical mentions of Knowledge Workflow.
- Changing task status semantics.
- Changing Forma runtime behavior.

## Acceptance Criteria

- Remaining Knowledge Workflow references are classified as migration history, replacement rationale, or explicit non-current context.
- Current operating guidance uses Forma CLI, guidelines, and configured knowledge sources rather than old workflow paths.
- `cargo run -q -p forma-cli -- check --json` passes.
- `cargo run -q -p forma-cli -- knowledge health --json` has no new cleanup-caused warnings.

## Result

Current operating guidance no longer presents old Knowledge Workflow commands as current requirements. Remaining Knowledge Workflow references are either migration history, replacement rationale, or explicit non-current context as classified in [[planning/repository-knowledge-content-migration-audit]].
