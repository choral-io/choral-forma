---
scope: project
type: planning
owners:
    - "members/tiscs"
tags:
    - forma
    - knowledge
    - migration
    - workspace-support
sources:
    - "planning/repository-knowledge-content-migration-audit"
    - "tasks/classify-workspace-support-material"
    - "workspace/tiscs/handoffs/forma-markdown-parser-spike"
    - "workspace/tiscs/handoffs/forma-starter-kit-to-system-refactor"
---

# Workspace Support Material Classification

## Purpose

Classify workspace-support material for [[tasks/migrate-repository-knowledge-content]] without promoting local-only execution context into shared repository knowledge.

## Configured Workspace-Support Material

| Path | Classification | Rationale |
| --- | --- | --- |
| `knowledge/workspace/tiscs/handoffs/forma-markdown-parser-spike.md` | Retain as workspace support | Historical handoff that explains a parser spike. It is useful as source context but not an accepted architecture decision. |
| `knowledge/workspace/tiscs/handoffs/forma-starter-kit-to-system-refactor.md` | Retain as workspace support | Historical execution handoff for the starter-kit refactor. Durable decisions have been moved into product, architecture, tasks, and starter-kit test cases. |

## Not Promoted

| Path pattern | Classification | Rationale |
| --- | --- | --- |
| `knowledge/workspace/*/local/**` | Omit | Local-only execution context, drafts, logs, and worklists are not shared project facts. |
| `knowledge/workspace/*/research/**` | Retain as workspace support | Research notes are configured shared support evidence. Promote durable synthesis to `discovery`, `architecture`, or `product` only when a current decision or implementation task needs it. |

## Outcome

No shared content move is needed for the current migration slice.

The configured handoffs and research notes remain shared support material. Local-only files remain outside shared migration, and durable research synthesis remains deferred until a concrete product or architecture task needs its evidence.
