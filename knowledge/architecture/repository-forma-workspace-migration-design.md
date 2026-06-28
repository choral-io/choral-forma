---
scope: project
type: technical-design
owners:
    - "members/tiscs"
tags:
    - architecture
    - forma
    - knowledge
    - migration
    - workspace
sources:
    - "product/product-direction"
    - "architecture/forma-core-technical-direction"
    - "architecture/forma-p0-check-index-spec"
    - "architecture/forma-p0-operation-api-spec"
    - "architecture/forma-view-query-model"
    - "tasks/migrate-repository-knowledge-to-forma-workspace"
---

# Repository Forma Workspace Migration Design

## Context

This repository's current `knowledge/` directory is a development knowledge base that was organized around Knowledge Workflow. It is useful source material, but it is not the target Forma workspace model.

The migration should first define the target Forma configuration, then migrate content into that structure, and only then normalize warnings and references against Forma rules.

## Goals

- Define the target `.forma/` structure for this repository before broad content changes.
- Keep repository Markdown and `.forma.md`-imported files as the shared source of truth.
- Keep runtime indexing startup-scan and in memory, with no committed summary index.
- Make old Knowledge Workflow paths and metadata migration inputs, not compatibility requirements.
- Preserve useful development knowledge while removing obsolete workflow-process coupling.
- Split migration execution into reviewable slices.

## Non-Goals

- Preserving the current Knowledge Workflow layout unchanged.
- Treating `.workflow/**` rules, schemas, templates, or local workspace state as product requirements.
- Supporting Obsidian, Foam, or another note application's full compatibility model.
- Introducing Forma MCP for this migration slice.
- Adding write-capable repair automation before reviewable operation proposals are designed.
- Creating a committed persistent index artifact, effective config cache, diagnostics cache, or local full index.

## Target Workspace Structure

The target repository Forma workspace should keep the root-level shared configuration small:

```text
.forma.md
.forma/
  dashboard.md
  spaces/
    product.md
    architecture.md
    decisions.md
    concepts.md
    discovery.md
    guidelines.md
    planning.md
    tasks.md
    members.md
    workspace.md
    templates/
      knowledge.md
      member-note.md
      task.md
  views/
    task-board.md
    knowledge-graph.md
```

The current minimal repository workspace may keep the broader `knowledge`, `tasks`, and `members` spaces while the runtime lacks user-authored space schema loading. The target model above is the migration destination, not a claim that every target space must be fully active in the current runtime before content migration begins.

## Space Mapping

| Current source | Target Forma space | Migration rule |
| --- | --- | --- |
| `knowledge/product/**` | `product` | Keep canonical product intent and remove workflow-history notes that are not current product direction. |
| `knowledge/architecture/**` | `architecture` | Keep durable module, API, config, operation, and runtime design. |
| `knowledge/decisions/**` | `decisions` | Keep accepted tradeoffs and supersession links. |
| `knowledge/concepts/**` | `concepts` | Keep glossary and shared mental model pages. |
| `knowledge/discovery/**` | `discovery` | Keep accepted research synthesis; archive or rewrite raw research that is no longer useful. |
| `knowledge/guidelines/**` | `guidelines` | Keep current cross-area guidance; remove obsolete compatibility guidance. |
| `knowledge/planning/**` | `planning` | Keep roadmaps, release plans, and delivery status views that still describe current project work. |
| `knowledge/tasks/**` | `tasks` | Keep active and useful historical task items as delivery records with Forma-owned relation fields. |
| `knowledge/members/**` | `members` | Keep shared member profiles only. |
| `knowledge/workspace/*/handoffs/**` | `workspace` | Keep handoffs only when still useful as shared support material. |
| `knowledge/workspace/*/research/**` | `workspace` or `discovery` | Promote durable research synthesis to `discovery`; otherwise keep only useful support notes. |
| `knowledge/workspace/*/local/**` | none | Do not migrate; local-only state remains excluded. |
| `knowledge/.workflow/**` | none by default | Do not migrate as project facts. Use only as source material when designing Forma-owned replacement behavior. |
| localized files | variants of canonical pages | Do not list or migrate localized pages as independent source-of-truth entries. |

## Target Schemas

Target schemas should use Forma Schema DSL in space definitions once user-authored schema loading is supported.

Common relationship fields should be path-qualified references when Forma controls writes:

- `owners`: references to `members`.
- `assignees`: references to `members`.
- `reviewers`: references to `members` or review groups when group support exists.
- `sources`: references to source pages when source material is internal.
- `blockedBy`: references to `tasks`.
- `relatedTo`: references to internal pages or tasks.

Body links and embeds stay body references. They should not be copied into frontmatter merely to make graphs denser.

## Graph Edge Policy

Graph views should use explicit `graph.edges` rules instead of hard-coded global relationship selection.

The default repository knowledge graph should start with body references:

```yaml
graph:
    edges:
        - source: body
          intent: link
          label: links to
        - source: body
          intent: embed
          label: embeds
```

After target schemas are active, the repository graph may add field relations:

```yaml
graph:
    edges:
        - source: fields
          field: owners
          label: owned by
        - source: fields
          field: assignees
          label: assigned to
        - source: fields
          field: reviewers
          label: reviewed by
        - source: fields
          field: blockedBy
          label: blocked by
        - source: fields
          field: relatedTo
          label: related to
        - source: fields
          field: sources
          label: sourced from
```

The `field` value is relative to the normalized `fields` object. It should be `assignees`, not `fields.assignees`. `label` is optional in the product model, but the repository should configure labels for task relationship fields where the field name alone is not good user-facing text.

## Health Policy

Migration validation should treat these as meaningful warnings:

- unresolved internal references;
- ambiguous internal references;
- unsupported body fragments that are not accepted heading or block references;
- files matching more than one target space;
- active task cards whose readiness and Kanban state disagree;
- configured graph field edges whose fields are missing or not reference typed once schema loading supports them.

Migration validation should not treat these as blockers by default:

- intentionally isolated member profile pages;
- archived or superseded historical records excluded from active views;
- external URLs that are not meant to become internal graph edges;
- old Knowledge Workflow process files that are not part of the target Forma workspace;
- localized variants that are correctly attached to canonical pages instead of listed independently.

## Migration Phases

### Phase 1: Design And Runtime Surface

- Document target `.forma/` structure and migration policy.
- Add a runnable graph view over currently resolved body references.
- Keep the task board and CLI read operations usable for review.
- Split remaining migration work into follow-up task items.

### Phase 2: Space And Schema Runtime Support

- Load user-authored space schemas from `.forma/spaces/*.md`.
- Validate relationship fields through schema-declared reference types.
- Let graph field edges use schema-backed references for task and member relationships.

### Phase 3: Content Migration

- Move or rewrite content into the target spaces.
- Drop obsolete Knowledge Workflow compatibility notes.
- Promote useful shared workspace material and omit local-only state.
- Keep localized pages as variants, not independent canonical entries.

### Phase 4: Normalization And Report

- Run Forma checks against the migrated target workspace.
- Fix true broken references and schema warnings.
- Record intentional warnings and follow-up tasks.
- Produce a migration report with changed paths and removed compatibility assumptions.

## Review Focus

Review should check whether this design gives enough structure for the migration to proceed without preserving the old workflow by accident. It should also check whether the proposed follow-up split is small enough for independent implementation and review.

## Related Links

- [[product/product-direction]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-view-query-model]]
- [[tasks/migrate-repository-knowledge-to-forma-workspace]]
- [[tasks/load-user-authored-space-schemas]]
- [[tasks/migrate-repository-knowledge-content]]
- [[tasks/normalize-repository-forma-knowledge-health]]
