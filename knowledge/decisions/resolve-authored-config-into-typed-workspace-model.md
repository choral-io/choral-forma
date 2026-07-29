---
scope: project
type: adr
owners:
    - "members/tiscs"
reviewers: []
tags:
    - architecture
    - configuration
    - core
    - projections
    - compatibility
sources:
    - "architecture/forma-core-technical-direction"
    - "architecture/forma-p0-check-index-spec"
    - "decisions/forma-p0-core-architecture"
    - "decisions/use-settings-driven-taxonomy-and-navigation-model"
supersedes: []
supersededBy: []
---

# Resolve Authored Config Into A Typed Workspace Model

**Status: Accepted**

## Context

Forma loads `.forma.md` and its imported Markdown nodes into an effective `WorkspaceConfig`. The current implementation also stores resolved runtime relationships inside that public serde type:

- taxonomy terms become schema-bearing content groups only when the raw taxonomy id is `spaces`;
- a private `space_term_keys` set records which taxonomy-term pairs produced those groups;
- named `entryRef` types receive a private resolved `space` field;
- scan, index, schema, and operation code consume a mixture of the serialized config fields and those hidden relationships.

This keeps the current CLI and RPC behavior working, but it makes authored configuration, resolution state, and client projections indistinguishable in the Core model. It also contradicts the accepted settings-driven taxonomy decision: a workspace may configure a familiar taxonomy titled "Spaces", but Forma must not require a taxonomy with the id `spaces`.

## Decision

Core uses this pipeline:

```text
authored config sources
-> typed config graph
-> resolved workspace model
-> scan, index, schema, operation, and client projections
```

### Authored Configuration

Authored configuration is the frontmatter in `.forma.md` and every explicitly imported config node. It remains the source of truth and remains inspectable through `config.inspect`.

Public serde config types describe authored or effective inspectable values. They must not carry resolved relationships in `serde(skip)` fields. In particular, a named `entryRef` keeps its authored `source`, and taxonomy-term relationships are not stored as private fields on `WorkspaceConfig`.

The serialized `WorkspaceConfig.spaces` field remains during this compatibility phase because current CLI, RPC, and Web clients consume it. It is a derived compatibility projection, not the owner of runtime relationships and not evidence that Space is a built-in Forma primitive.

### Typed Config Graph

After parsing, Core builds a typed graph with distinct ids for taxonomies, terms, semantic types, and projected content groups. A taxonomy-term identity is composite: the same term id in two taxonomies does not identify the same node.

Every typed node records source provenance using a workspace-relative POSIX config path. Resolution diagnostics use that provenance rather than reporting all imported-node problems against `.forma.md`.

The graph represents declarations and references. It does not perform file scans, contain indexed entries, or become a persisted artifact.

### Resolved Workspace Model

Core resolves the graph into one in-memory `ResolvedWorkspaceModel`. This model owns:

- the configured content-group projection and its taxonomy-term relationships;
- named semantic-type targets resolved from config source paths;
- validated lookup relations used by schema and reference analysis;
- the workspace scan plan and its control, content, taxonomy, and watch projections.

Core consumers use the resolved model rather than comparing raw identifiers or reconstructing relationships. The model is rebuildable from authored files and is never written as workspace content or a cache.

Runtime diagnostics remain separate operation results. The resolved model may use diagnostics produced during resolution, but diagnostics are not serialized into the model or effective config.

### Configured Content-Group Projection

A taxonomy opts into the schema-bearing content-group projection explicitly:

```yaml
schemaVersion: 1
kind: taxonomy
id: areas
projection: contentGroups
title: Areas
```

The taxonomy id is workspace-configured and has no reserved value. Its terms provide the current include, schema, template, create, convention, guideline, and display inputs used by the existing Space-compatible operations.

At most one taxonomy may declare `projection: contentGroups` in the first phase. An unknown projection or multiple content-group projections produce stable `config.projection.*` diagnostics at the authored source.

`projection` selects a Core projection. It does not control WebApp navigation, rename taxonomy, or introduce `collection` terminology.

### Legacy `id: spaces` Adapter

When no taxonomy explicitly declares `projection: contentGroups`, Core may adapt the taxonomy with `id: spaces` to the content-group projection. The adapter:

- lives only in the config resolver;
- emits a stable `config.projection.compatibilitySpaces` warning with the source path and the mechanical migration `projection: contentGroups`;
- is not repeated by scan, index, schema, operations, RPC, or clients;
- does not run when an explicit content-group projection exists, even when a different taxonomy still has the id `spaces`.

Removing this adapter or changing its diagnostic code requires a later compatibility decision. Adding the explicit projection is behavior-preserving and removes the warning.

## Projection Ownership

| Projection | Owner | Compatibility boundary |
| --- | --- | --- |
| Effective inspectable config | Config loader | Preserve current `config.inspect` shape where possible |
| Content groups | Resolved workspace model | Continue projecting public `spaces` fields for existing clients |
| Semantic type targets | Resolved workspace model | Preserve reference resolution behavior; remove hidden serde state |
| Scan and watch patterns | Core scan projection from the resolved model | Preserve file discovery and watcher behavior |
| Summary index | Core index projection | Preserve current CLI/RPC/Web JSON contracts |
| Dashboard and explorer results | Core operations over the resolved model and index | Do not infer taxonomy meaning in adapters |

## Diagnostics And Compatibility

Resolution is deterministic for unchanged authored inputs. Typed ids and provenance are internal Core identity; existing public JSON continues to use string ids and workspace-relative paths.

This phase may change the Rust `forma-core` API to expose the resolved model and remove hidden fields. It must keep CLI, RPC, and Web operation result shapes as stable as practical. Any unavoidable external contract change requires a separate decision.

Counterexample tests must prove that:

- a taxonomy whose id is not `spaces` can own `projection: contentGroups`;
- a separate taxonomy may reuse a projected term id without becoming a content group;
- the legacy `id: spaces` path emits the compatibility diagnostic;
- config nodes outside the recommended `.forma/spaces/` layout retain correct provenance and behavior.

## Consequences

- Authored values, typed identities, resolved relationships, and client projections have explicit boundaries.
- Core has one owner for compatibility inference and downstream consumers no longer compare `id == "spaces"`.
- Existing Space-named CLI and RPC contracts can migrate independently from the product model.
- Resolution introduces additional Core types and one in-memory graph, but no persistent database, hidden content store, or cache.
- `taxonomy` remains the current product term. This decision does not perform or authorize a taxonomy-to-collection rename.

## Alternatives Considered

### Keep Private `serde(skip)` Fields On `WorkspaceConfig`

This preserves the smallest diff, but it leaves inspectable config responsible for runtime relationships and lets constructors, clones, and deserialization silently lose essential state.

### Reserve The Taxonomy Id `spaces`

This matches current fixtures, but it turns one repository example into a product contract and conflicts with the accepted settings-driven taxonomy model.

### Break All Space-Named Public Contracts Immediately

This would remove compatibility code, but it would unnecessarily change CLI, RPC, Web, and editor consumers in the same architectural step. The resolved model allows those contracts to migrate deliberately later.

## Related Knowledge

- [[decisions/use-settings-driven-taxonomy-and-navigation-model]]
- [[guidelines/forma-product-model-and-configuration-fidelity]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]
- [[architecture/forma-p0-schema-dsl-spec]]
