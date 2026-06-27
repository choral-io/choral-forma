---
scope: project
type: task
title: Audit Repository Knowledge Migration Scope
summary: Produce the executable migration inventory for repository knowledge before content rewrites.
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
    - "tasks/clean-obsolete-knowledge-workflow-language"
    - "tasks/normalize-repository-relationship-metadata"
    - "tasks/classify-workspace-support-material"

reportedBy:
affectedArea: Repository knowledge content migration
---

# Audit Repository Knowledge Migration Scope

## Goal

Produce a concise migration inventory that turns [[tasks/migrate-repository-knowledge-content]] into reviewable execution slices.

## Sources

- [[architecture/repository-forma-workspace-migration-design]]
- [[planning/repository-knowledge-content-migration-audit]]
- [[tasks/migrate-repository-knowledge-content]]
- [[guidelines/forma-workspace-operations]]

## In Scope

- Compare the currently configured Forma spaces with the migration design.
- Classify remaining Knowledge Workflow references as obsolete language, intentional migration history, or current replacement guidance.
- Identify relationship metadata fields that need canonical path-qualified references.
- Identify workspace-support material that should be promoted, retained as support material, or left local-only.
- Record the proposed execution order for the follow-up migration tasks.

## Out of Scope

- Moving or rewriting shared project content content.
- Normalizing all health warnings.
- Changing Forma runtime behavior.

## Acceptance Criteria

- A migration audit note is added under `knowledge/planning/`.
- The audit lists configured spaces, migration gaps, and deliberate extra spaces.
- The audit classifies old Knowledge Workflow references before cleanup begins.
- The audit identifies relationship metadata and workspace-support cleanup candidates.
- The audit recommends which follow-up task should be promoted next.
- `cargo run -q -p forma-cli -- check --json` passes after the audit is added.

## Result

Completed in [[planning/repository-knowledge-content-migration-audit]]. The next recommended executable task is [[tasks/clean-obsolete-knowledge-workflow-language]].
