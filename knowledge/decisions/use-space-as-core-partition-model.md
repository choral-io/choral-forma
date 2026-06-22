---
scope: project
type: decision
owners:
    - "members/tiscs"
reviewers: []
tags:
    - architecture
    - product
    - terminology
    - spaces
supersedes: []
superseded_by:
    - "decisions/use-settings-driven-taxonomy-and-navigation-model"
---

# Use Space As Core Partition Model

## Context

Forma previously used `collection` as the core partition concept for configured knowledge groups. During WebApp V2 design, the product language stabilized on `Space` because the GUI presents these groups as browsable knowledge areas, while still needing schema, include, template, create, and view-filtering behavior.

Keeping both `collection` and `space` would create two names for the same domain model across configuration, index data, RPC, CLI, and WebApp adapters.

## Decision

Use `Space` as the single product, configuration, API, and internal domain term for knowledge partitions.

A space owns:

- file inclusion rules;
- entry schema;
- template and create behavior;
- display metadata;
- conventions for title, summary, and created-at fields.

The previous `collection` terminology should be removed instead of kept as a compatibility alias. Current code and schema may make breaking changes because Forma has not shipped a stable public release.

## Consequences

- Space-like taxonomy and term configuration is loaded from `.forma.yml` includes rather than a dedicated spaces registry file.
- Effective configuration exposes spaces from included term configuration.
- semantic type definitions use `kind: space` and `space: <id>`.
- view definitions use `view.space`.
- query targets use `entry.space`.
- CLI and RPC write operations continue to exist, but their parameters use `space` instead of `collection`.
- WebApp, shared TypeScript contracts, and future editor extensions share the same terminology.
- Existing fixtures, generated starter workspaces, and docs must be updated together because no compatibility layer is retained.

## Alternatives Considered

### Keep Collection Internally And Space In The WebApp

This would reduce immediate Rust churn, but it would force the WebApp adapter and future editor extensions to keep translating between two terms that refer to the same model.

### Support Both Collection And Space

This would make migration easier after a release, but the current pre-release state makes compatibility unnecessary. Supporting both would also increase test, schema, and documentation surface area.

## Related Knowledge

- [[architecture/forma-core-technical-direction]]
- [[architecture/forma-p0-schema-dsl-spec]]
- [[architecture/webapp-v2-read-model-contract]]
- [[decisions/forma-p0-core-architecture]]
- [[decisions/use-settings-driven-taxonomy-and-navigation-model]]
