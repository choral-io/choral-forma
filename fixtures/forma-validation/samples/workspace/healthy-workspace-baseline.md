---
schemaVersion: 1
kind: validation-sample
title: Healthy Workspace Baseline
summary: Connected baseline record that links the complete first-batch case suite and defines the expected zero-error workspace state.
stage: done
priority: P0
area: workspace
owner: "Riley Kumar"
reviewer: "Taylor Brooks"
longValue: "workspace-health://expected?errors=0&warnings=0&invalid-fixtures=isolated-outside-this-workspace"
tags:
    - health
    - baseline
    - suite-index
relatedSamples:
    - "samples/reader/markdown-rendering-showcase"
---

# Healthy Workspace Baseline

The unified fixture workspace must remain valid, deterministic, and free of intentional configuration failures.

## First-Batch Cases

- [[cases/workspace-navigation-and-quick-open]]
- [[cases/markdown-reader-rich-content]]
- [[cases/mermaid-rendering-and-inspection]]
- [[cases/table-overflow-and-sticky-header]]
- [[cases/kanban-overflow-and-sticky-header]]
- [[cases/graph-projection-and-interaction]]
- [[cases/responsive-shell-and-theme]]

## Corpus Cycle

The sample relationship cycle returns to [[samples/reader/markdown-rendering-showcase]], ensuring every first-batch Sample has an inbound reference.

## Expected Health

`forma check --json` and `forma workspace health --json` should both report zero errors and zero warnings. Intentional invalid-input suites belong in isolated workspaces added in a later batch.
