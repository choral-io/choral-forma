---
id: agents.workspace-design-discovery
title: Workspace Design Discovery
summary: Guide Agents through business-domain discovery before choosing the first Forma workspace slice.
audience:
    - agent
surfaces:
    - docs
    - skill
order: 205
---

# Workspace Design Discovery

## Agent Guidance

Use this only when the human asks to design a workspace, understand a business domain, or plan a content system. Do not load this doc for read-only health, list, inspect, or view tasks.

The goal is to produce a short workspace design brief before configuring Forma. Keep the conversation focused on real work, not abstract taxonomy design.

## Discovery Sequence

Ask questions in small batches. Stop when the next answer would not change the first slice.

1. Business outcome: what decisions, coordination, audit trail, or reuse should this workspace support?
2. Durable objects: what records, assets, entities, or recurring artifacts must survive beyond a single conversation?
3. Events and lifecycle: what statuses or stages do those objects move through?
4. Users and responsibilities: who creates, edits, reviews, reads, or archives the content?
5. Retrieval needs: what will people search, filter, compare, group, or sort during normal work?
6. Relationship candidates: which objects refer to each other, and which relationships can wait?
7. Local or private boundaries: which files should stay local or personal?

## Design Brief

Before writing config, summarize:

| Field | Required content |
| --- | --- |
| Business outcome | The practical result the workspace supports |
| Content candidates | Candidate spaces in the human's language |
| First slice | One content group to implement first and why |
| Deferred slices | Content groups not implemented in the first pass |
| Lifecycle fields | Status or date fields needed now |
| Retrieval fields | Fields needed for lists, tables, filters, or review |
| Relationship strategy | Entry references now, Markdown links now, or deferred relationships |
| Operating rules | Guidelines needed now or deferred |
| Verification path | Commands that will prove the first slice works |

## First-Slice Selection Rules

Choose the first slice that has real examples, clear fields, and immediate verification value. Prefer a record type the human can create two examples for now.

Do not choose a relationship-heavy object first if it requires several missing spaces. Use scalar fields and Markdown links until the target space exists and the relationship has clear validation value.

After the design brief is accepted, load `agents.workspace-bootstrap` and produce the first-slice dry run.
