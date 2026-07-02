---
scope: project
type: product
title: Structured Artifacts And Source Facts
summary: Product reference for using JSONL as merge-friendly source facts and SQLite as rebuildable projections when Forma supports structured content artifacts for broader low-code business systems.
owners:
    - "members/tiscs"
sources:
    - "product/product-direction"
    - "product/forma-actions-triggers-concept"
    - "architecture/forma-core-technical-direction"
tags:
    - product
    - low-code
    - business-systems
    - structured-artifacts
    - jsonl
    - sqlite
    - source-of-truth
---

# Structured Artifacts And Source Facts

## Purpose

This note captures a product-direction discussion for future Forma development. It is a reference, not an implementation commitment.

The discussion started from whether Forma could evolve toward a low-code CRM-like system. The more general conclusion is that this pattern is broader than CRM. It applies to repository-backed low-code business systems where the workspace needs structured facts, narrative context, reviewable history, and fast derived views.

The strongest path is not a traditional hidden application database, and not a pure Markdown-only system. A better model is a repository-backed mixed workspace where Markdown carries meaning and narrative context, JSONL carries merge-friendly source facts, and SQLite can be used as a rebuildable projection for fast query and view rendering.

## Product Position

Forma should not exclude non-Markdown content artifacts from a workspace. A SQLite database file, CSV file, image, PDF, or other media file can be part of repository knowledge when it is visible, documented, and governed by ordinary workspace files.

The boundary is source-of-truth clarity:

- Good: a structured artifact is a visible workspace content file with a Markdown description, schema explanation, ownership, and maintenance rules.
- Bad: Forma silently maintains a hidden application database while Markdown becomes only an export or display layer.

For operations, project, service, manufacturing, research, CRM-like, and other structured business workflows, this means Forma can support structured datasets without abandoning its files-first thesis. The important question is which file or artifact is the durable fact source for each kind of data.

## Business-System Implication

A Forma starter or workspace following this pattern could model many domain objects, for example:

- accounts;
- contacts;
- opportunities;
- interactions;
- follow-up tasks;
- proposals;
- contracts;
- customer research notes;
- sales guidelines and operating rules;
- projects;
- work orders;
- machines;
- incidents;
- inspections;
- experiments;
- inventory items;
- service cases.

CRM is one useful example, but the product direction should not narrow around CRM terminology. The same architecture can support many low-code operational systems where users need durable facts, explainable context, and structured views.

Markdown remains strong for research, meeting notes, rationale, solution proposals, decision records, operating rules, and collaboration guidance. Structured event data is stronger for current state, reporting, deduplication, chronological history, and repeatable views.

## SQLite As Source Artifact

A SQLite database file can be treated as a visible content artifact in a Forma workspace, especially when paired with a Markdown description file.

Example shape:

```text
business/
  README.md
  state.sqlite
  schema.md
  notes/
    entity-research.md
```

This is useful for local structured querying, report generation, and interoperability with common tools. However, SQLite is not Git-merge friendly. As a binary or near-binary state file, it is awkward for concurrent edits, conflict review, line-level history, and hand repair.

Therefore SQLite is a poor default source of truth for multi-person, high-frequency business collaboration unless the workspace has a clear write policy such as single writer, generated snapshot, or external authoritative system.

## Preferred Source-Fact Model

For collaborative low-code business-system use, JSONL should be considered as the source-fact layer and SQLite as a derived projection.

Recommended shape:

```text
business/
  README.md
  schema.md
  events/
    2026-07.jsonl
    2026-08.jsonl
  projections/
    state.sqlite
```

In this model:

```text
events/*.jsonl -> projector -> state.sqlite -> Forma views, reports, search, and Agent context
```

JSONL is the durable source fact because it is text, append-oriented, reviewable, and easier to merge than SQLite. SQLite is an implementation artifact for fast reads. It can be deleted and rebuilt from JSONL plus the projection rules.

Example event records:

```jsonl
{"id":"evt_001","at":"2026-07-02T10:00:00+08:00","actor":"members/tiscs","type":"account.created","entity":"accounts/acme","payload":{"name":"Acme","status":"lead"}}
{"id":"evt_002","at":"2026-07-02T10:30:00+08:00","actor":"members/tiscs","type":"opportunity.stage_changed","entity":"opportunities/acme-pilot","payload":{"from":"qualified","to":"proposal"}}
```

## Product Rules To Preserve

Future design should preserve these rules:

- JSONL events are immutable source facts; corrections should be new events rather than silent edits to old records.
- Every event should have a stable id, timestamp, actor, type, entity reference, and typed payload.
- JSONL should be sharded by time, domain, or workspace scale so files remain reviewable.
- Projection versions should be explicit. When projection logic changes, SQLite should be rebuilt.
- SQLite projections should normally be local-only or generated artifacts unless a workspace deliberately commits a snapshot.
- If a SQLite snapshot is committed, its role should be declared as `snapshot` or `derived`, not confused with the source fact log.
- Forma write operations should prefer writing JSONL events or reviewable proposals, then updating or rebuilding projections.
- Agent workflows should explain whether they are reading source facts, derived state, or a snapshot.

## Possible Configuration Direction

Future artifact configuration may need an explicit truth-mode declaration. This is a product-design sketch only:

```yaml
artifact:
    kind: sqlite
    path: business/projections/state.sqlite
    truthMode: derived
    derivedFrom:
        - business/events/*.jsonl
    mergePolicy: regenerated
```

Possible `truthMode` values:

- `source`: the artifact is itself the source of truth.
- `derived`: the artifact is rebuilt from other source files.
- `snapshot`: the artifact is a committed point-in-time export.
- `external`: another system is authoritative and Forma stores documentation or exported views.

Possible merge policies:

- `single-writer`;
- `append-log`;
- `regenerated`;
- `external-authoritative`.

These names are not accepted configuration yet. They are useful vocabulary for later product and architecture work.

## Relationship To Actions

Actions should not directly mutate a hidden application state store as the default behavior. For structured business workflows, the safer default is:

1. validate the intended change;
2. write a JSONL event or a reviewable proposal;
3. rebuild or refresh the SQLite projection;
4. render views from the projection and linked Markdown context.

For example, moving an opportunity, work order, incident, or service case from one stage to another should record a domain event such as `opportunity.stage_changed` or `case.stage_changed`. The board can then be rendered from the SQLite projection or from a direct JSONL projection when the dataset is small.

## Open Questions

- What is the minimal artifact description format for non-Markdown workspace content?
- Should artifact truth modes live in `.forma/` configuration, Markdown sidecar files, or both?
- How should Forma reference a row or entity inside a structured artifact from Markdown?
- What projection engine should build SQLite from JSONL, and how much of it belongs in Forma core?
- Which parts of this model belong to Forma itself, and which belong to domain Starter Kits such as CRM, service operations, manufacturing, research, or project delivery?
- Should committed SQLite snapshots be discouraged by default, allowed with diagnostics, or treated as ordinary resources?

## Current Guidance

Do not implement this yet. Treat it as product reference for future structured-artifact, low-code business-system, view-source, and action-design discussions.

The near-term product principle is:

```text
Markdown explains meaning.
JSONL records merge-friendly source facts.
SQLite accelerates derived read models.
Forma makes the boundary visible and checkable.
```
