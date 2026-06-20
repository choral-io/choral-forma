---
scope: project
type: task
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
    - workspace

effort: L
status: done
readiness: ready
sprint:

blocked_by: []
related_to:
    - "product/product-direction"
    - "architecture/forma-p0-check-index-spec"
    - "architecture/forma-p0-operation-api-spec"
    - "tasks/align-starter-kit-baseline-with-backend-and-webapp"
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "tasks/load-user-authored-space-schemas"
    - "tasks/migrate-repository-knowledge-content"
    - "tasks/normalize-repository-forma-knowledge-health"

reported_by:
affected_area: Repository knowledge workspace structure and migration
---

# Migrate Repository Knowledge To Forma Workspace

## Goal

Prepare this repository's current development knowledge base for migration into a Forma-native workspace shape by designing the target `.forma/` configuration first, adding the current runnable review surface, and splitting broad content migration and normalization into follow-up tasks.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/repository-forma-workspace-migration-design]]
- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]
- [[tasks/align-starter-kit-baseline-with-backend-and-webapp]]

## Problem

The current `knowledge/` directory is a Knowledge Workflow development knowledge base. It is useful source material and dogfooding evidence, but it should not be treated as the target Forma workspace structure or as content that must remain unchanged.

The migration should avoid optimizing around the old workflow's incidental layout, old metadata shape, or old link conventions. Instead, it should first define the desired Forma workspace model, then migrate and normalize the old content into that model.

## In Scope

- Design the target repository Forma workspace structure before changing content.
- Decide which current `knowledge/` areas become Forma spaces, which become support/archive inputs, and which should be rewritten or removed.
- Define migration rules for frontmatter, relationship fields, path-qualified references, body links, workspace member content, handoffs, research, task items, and planning files.
- Add a currently runnable review surface for the repository graph using supported body-reference graph edges.
- Split schema runtime support, broad content migration, and health normalization into follow-up tasks.
- Record residual warnings and follow-up work instead of preserving old Knowledge Workflow compatibility behavior.

## Out of Scope

- Preserving the old Knowledge Workflow layout as a compatibility requirement.
- Guaranteeing that old frontmatter fields, old link syntax, old task metadata, or old workspace paths remain unchanged.
- Broadly moving or rewriting repository knowledge content in this slice.
- Implementing user-authored space schema loading in this slice.
- Implementing Forma MCP.
- Implementing write-capable repair automation beyond explicit repository file edits.
- Migrating third-party note app formats or promising Obsidian/Foam compatibility.
- Productizing the repository's current Knowledge Workflow rules wholesale.

## Migration Plan

### Phase 1: Target Workspace Design

Define the target Forma workspace model before content migration.

Expected design outputs:

- workspace identity, canonical language, supported languages, and local-only boundaries;
- space list and source include/exclude patterns;
- schemas for product, architecture, decisions, concepts, discovery, guidelines, tasks, members, planning, and shared workspace material where each remains useful;
- templates for new task, knowledge, member, decision, and workspace-support entries;
- page, list, kanban, table, and graph views that represent the migrated knowledge base;
- graph edge configuration for body links, embeds, and schema-declared field relations;
- health rule policy for broken references, unsupported fragments, isolated entries, local-only files, archived content, members, tasks, and external-source-heavy research documents.

### Follow-Up Phase 2: Space Schema Runtime Support

Implement [[tasks/load-user-authored-space-schemas]] before relying on field-reference graph edges or target per-space schemas for migrated repository content.

### Follow-Up Phase 3: Content Migration

Move or rewrite current knowledge content into the target model.

Migration should:

- convert relationship metadata to Forma path-qualified references where fields represent knowledge objects;
- keep body links as body references, not metadata substitutes;
- avoid localized files as source-of-truth inputs;
- classify handoffs and research as shared workspace/support material only when still useful;
- rewrite or archive obsolete Knowledge Workflow process details instead of keeping historical compatibility notes;
- update task and planning content so delivery state is represented by the target Forma workspace model, not by incidental old workflow mechanics.

This phase is tracked by [[tasks/migrate-repository-knowledge-content]].

### Follow-Up Phase 4: Normalization And Validation

After migration, run Forma checks and normalize only the migrated target workspace.

Normalization should:

- fix true broken references;
- reduce or suppress only intentional health exceptions according to the target health policy;
- verify that list, board, inspect, file references, graph, and knowledge health operations describe the migrated workspace accurately;
- record remaining follow-up tasks instead of preserving old compatibility behavior.

This phase is tracked by [[tasks/normalize-repository-forma-knowledge-health]].

## Acceptance Criteria

- The target `.forma/` structure is documented and committed before broad content migration begins.
- The design defines target spaces, schema expectations, graph edge policy, health policy, and content mapping.
- A runnable `Knowledge Graph` view exists for currently supported body-reference graph edges.
- Follow-up tasks exist for user-authored space schema loading, broad content migration, and post-migration health normalization.
- `forma check --json`, `forma config inspect --json`, `forma tasks list --json`, `forma board show --json`, and `forma knowledge health --json` run against the review surface.
- The graph view is present in `.forma/views/knowledge-graph.md` for runtimes and clients that consume configured views; a direct `forma view render` CLI command remains outside this slice.
- The task records that old Knowledge Workflow compatibility assumptions are migration inputs, not target requirements.

## Relationship Notes

This task is the reviewable Phase 1 migration preparation slice. The CLI read-side replacement work is treated as sufficiently observable for this slice because task inventory, board state, graph rendering, and knowledge health all run through Forma CLI operations in this branch.

## Review Readiness

| Field | Evidence |
| --- | --- |
| Scope completed | Target workspace migration design, runnable graph view config, and follow-up task split are present. |
| Files changed | `.forma/views/knowledge-graph.md`, [[architecture/repository-forma-workspace-migration-design]], this task, follow-up task items, and the Kanban card move. |
| Knowledge updated | Yes: target migration design and follow-up task graph are recorded in canonical knowledge. |
| Checks run | Prettier, `forma check --json`, `forma config inspect --json`, `forma tasks list --json`, `forma board show --json`, and `forma knowledge health --json`. |
| Residual risks | Broad content migration is intentionally deferred to [[tasks/migrate-repository-knowledge-content]]. User-authored space schema loading is deferred to [[tasks/load-user-authored-space-schemas]]. |
| Suggested review | Review the target structure, scope split, and whether the migration avoids preserving old Knowledge Workflow assumptions by accident. |
