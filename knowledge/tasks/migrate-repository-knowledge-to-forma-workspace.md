---
scope: project
type: task
priority: P0
severity:
value: H
module: knowledge

owners:
    - "[[members/Tiscs]]"
assignees:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - forma
    - knowledge
    - migration
    - workspace

effort: L
readiness: blocked
sprint:

blocked_by:
    - "[[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]"
related_to:
    - "[[product/product-direction]]"
    - "[[architecture/forma-p0-check-index-spec]]"
    - "[[architecture/forma-p0-operation-api-spec]]"
    - "[[tasks/align-starter-kit-baseline-with-backend-and-webapp]]"

reported_by:
affected_area: Repository knowledge workspace structure and migration
---

# Migrate Repository Knowledge To Forma Workspace

## Goal

Migrate this repository's current development knowledge base into a Forma-native workspace shape by designing the target `.forma/` configuration first, then migrating content into that structure, and only then normalizing migrated content against Forma health and schema rules.

## Sources

- [[product/product-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]]
- [[tasks/align-starter-kit-baseline-with-backend-and-webapp]]

## Problem

The current `knowledge/` directory is a Knowledge Workflow development knowledge base. It is useful source material and dogfooding evidence, but it should not be treated as the target Forma workspace structure or as content that must remain unchanged.

The migration should avoid optimizing around the old workflow's incidental layout, old metadata shape, or old link conventions. Instead, it should first define the desired Forma workspace model, then migrate and normalize the old content into that model.

## In Scope

- Design the target repository Forma workspace structure before changing content:
    - `.forma.yml`
    - `.forma/spaces/*.md`
    - `.forma/spaces/templates/*.md`
    - `.forma/views/*.md`
    - schema, conventions, graph edge rules, and health rule choices
- Decide which current `knowledge/` areas become Forma spaces, which become support/archive inputs, and which should be rewritten or removed.
- Define migration rules for frontmatter, relationship fields, path-qualified references, body links, workspace member content, handoffs, research, task items, and planning files.
- Migrate current content into the target spaces and schemas without promising old Knowledge Workflow compatibility.
- Normalize migrated content after migration:
    - canonical path references
    - owners, assignees, reviewers, sources, related links, and graph edge fields
    - body link/reference forms
    - health warnings that remain meaningful under the target Forma rules
- Produce a short migration report covering changed paths, intentionally dropped compatibility assumptions, remaining warnings, and follow-up tasks.

## Out of Scope

- Preserving the old Knowledge Workflow layout as a compatibility requirement.
- Guaranteeing that old frontmatter fields, old link syntax, old task metadata, or old workspace paths remain unchanged.
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

### Phase 2: Content Migration

Move or rewrite current knowledge content into the target model.

Migration should:

- convert relationship metadata to Forma path-qualified references where fields represent knowledge objects;
- keep body links as body references, not metadata substitutes;
- avoid localized files as source-of-truth inputs;
- classify handoffs and research as shared workspace/support material only when still useful;
- rewrite or archive obsolete Knowledge Workflow process details instead of keeping historical compatibility notes;
- update task and planning content so delivery state is represented by the target Forma workspace model, not by incidental old workflow mechanics.

### Phase 3: Normalization And Validation

After migration, run Forma checks and normalize only the migrated target workspace.

Normalization should:

- fix true broken references;
- reduce or suppress only intentional health exceptions according to the target health policy;
- verify that list, board, inspect, file references, graph, and knowledge health operations describe the migrated workspace accurately;
- record remaining follow-up tasks instead of preserving old compatibility behavior.

## Acceptance Criteria

- The target `.forma/` structure is documented and committed before broad content migration begins.
- Current repository knowledge content is migrated according to target spaces and schemas rather than preserved as an unchanged legacy layout.
- `.forma` space definitions, templates, views, graph edge rules, and health rules are sufficient to browse and inspect the migrated knowledge base through Forma CLI/WebApp read operations.
- Migrated frontmatter relationship fields use canonical path-qualified references where Forma controls writes.
- Body links and embeds remain body references and follow the supported body link/reference model.
- `forma knowledge health --json` reports only meaningful warnings under the target workspace policy; old Knowledge Workflow compatibility warnings are not treated as blockers.
- The migration report identifies intentionally removed compatibility assumptions, remaining warnings, and follow-up tasks.

## Relationship Notes

This task should be executed after the CLI read-side replacement work is complete enough to inspect tasks, board state, page references, and knowledge health through Forma operations. It should not block narrowly scoped CLI implementation fixes that are still needed to make migration observable.
