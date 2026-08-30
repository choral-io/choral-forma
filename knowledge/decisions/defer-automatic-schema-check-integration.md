---
schemaVersion: 1
kind: decision
scope: project
type: decision
title: "Keep Structured Schema Validation Explicit Before Automatic Check Integration"
summary: "Keep schema.validate as the manual Forma CLI MVP and defer artifact declarations and automatic forma check integration until repeated workspace evidence justifies a compatible opt-in model."
owners:
    - "members/tiscs"
reviewers: []
tags:
    - product
    - architecture
    - cli
    - schema
    - structured-artifacts
    - validation
sources:
    - "architecture/forma-p0-schema-dsl-spec"
    - "product/structured-artifacts-and-source-facts"
    - "planning/forma-product-value-gap-roadmap"
    - "decisions/forma-p0-core-architecture"
supersedes: []
supersededBy: []
---

# Keep Structured Schema Validation Explicit Before Automatic Check Integration

## Context

The immediate product goal is to let a workspace user run a schema check deliberately from `forma-cli`. The first implementation now provides `forma tools list`, `forma tools describe`, and `forma tools schema validate` for explicit JSON, single-document YAML, and JSONL inputs.

The earlier execution route called for a later phase that would add artifact declarations and make `forma check` validate declared structured files. That phase would introduce new configuration semantics, migration questions, and a second source of workspace-wide failure signals. The current goal does not require those capabilities.

## Decision

Keep structured schema validation as an explicit, read-only `forma tools` operation for the current MVP. A caller supplies the data path, schema path, and optional format; automation may invoke the same command and consume its JSON result and exit status.

Defer the automatic artifact-declaration and `forma check` integration phase. Until it is separately reopened and accepted:

- Forma does not add an `artifacts` configuration section for schema bindings.
- `forma check` and `workspace health` do not scan or infer JSON, YAML, or JSONL artifacts.
- Schema files remain ordinary workspace files with explicit ownership and documentation.
- The Forma Schema DSL remains the source of truth for Markdown frontmatter and configured space constraints; JSON Schema remains a complementary structured-artifact tool.

This is a deferral, not a rejection. The `forma tools` registry and Core validation operation remain the stable seam for a future opt-in integration.

## Consequences

The current path has a smaller configuration and migration surface and preserves the no-default-scan, no-hidden-index, and read-only boundaries. Users and CI workflows must invoke validation explicitly, so an artifact can be missed if its command is not included in the workflow. Automatic workspace-wide coverage and health aggregation are intentionally not promised.

## Reopen Criteria

Reconsider the deferred phase when all of the following have evidence:

1. At least two independent workspaces show repeated cost in maintaining explicit schema commands or a material risk of missed validation.
2. A reviewed declaration contract defines artifact identity, path or glob matching, format, schema ownership, overrides, and `check` failure semantics.
3. The design remains opt-in and reuses the existing Core operation and diagnostics across CLI, RPC, health, and check surfaces.
4. Compatibility, migration, path-boundary, and cross-platform tests are specified before implementation.

## Re-entry Plan

Reopen the value-validation phase first, then propose the declaration contract as a separate configuration change. If accepted, implement `check` integration only for explicitly declared artifacts, preserve the manual command as the debugging path, and complete the full release and cross-platform gates before treating automatic coverage as supported.

## Related Knowledge

- [[architecture/forma-p0-schema-dsl-spec]]
- [[product/structured-artifacts-and-source-facts]]
- [[planning/forma-product-value-gap-roadmap]]
- [[decisions/forma-p0-core-architecture]]
- `docs/cli/tools.md`
