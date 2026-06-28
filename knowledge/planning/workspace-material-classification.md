---
scope: project
type: planning
owners:
    - "members/tiscs"
tags:
    - forma
    - knowledge
    - migration
    - workspace
sources:
    - "planning/repository-knowledge-content-migration-audit"
    - "tasks/classify-workspace-material"
---

# Workspace Material Classification

## Purpose

Classify workspace material for [[tasks/migrate-repository-knowledge-content]] without promoting local-only execution context into shared repository knowledge.

## Previously Considered Workspace Material

| Path | Classification | Rationale |
| --- | --- | --- |
| `knowledge/workspace/tiscs/handoffs/forma-markdown-parser-spike.md` | Retain as working context | Historical handoff that explains a parser spike. It is useful as source context but not an accepted architecture decision. |
| `knowledge/workspace/tiscs/handoffs/forma-starter-kit-to-system-refactor.md` | Retain as working context | Historical execution handoff for the starter-kit refactor. Durable decisions have been moved into product, architecture, tasks, and starter-kit test cases. |

## Not Promoted To Canonical Spaces

| Path pattern | Classification | Rationale |
| --- | --- | --- |
| `knowledge/workspace/*/local/**` | Omit | Local-only execution context, drafts, logs, and worklists are not shared project facts. |
| `knowledge/workspace/*/handoffs/**` | Retain as working context | Handoffs can remain in member workspace folders as background but are not indexed by default. Promote durable context to a canonical space when it becomes current project knowledge. |
| `knowledge/workspace/*/research/**` | Retain as working context | Research notes can remain in member workspace folders as background but are not indexed by default. Promote durable synthesis to `discovery`, `architecture`, or `product` only when a current decision or implementation task needs it. |

## Outcome

No canonical content move is needed for the current migration slice.

The member workspace index pages remain the shared workspace entries. Handoffs and research notes remain working context outside the default shared read model. Local-only files remain outside shared migration, and durable research synthesis remains deferred until a concrete product or architecture task needs its evidence.
