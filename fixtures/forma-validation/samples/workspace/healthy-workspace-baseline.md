---
schemaVersion: 1
kind: validation-sample
title: Healthy Workspace Baseline
summary: Links the first-batch validation cases and records the expected workspace health diagnostics.
stage: done
priority: P0
area: workspace
owner: "Riley Kumar"
reviewer: "Taylor Brooks"
longValue: "workspace-health://expected?errors=0&warnings=11&invalid-fixtures=isolated-outside-this-workspace"
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

The sample relationship cycle returns to [[samples/reader/markdown-rendering-showcase]]. Use the index below to open the standalone Markdown samples used for rendering checks.

## Expected Health

`forma check --json` should report zero errors and zero warnings. `forma workspace health --json` should report zero errors and one `workspaceHealth.noOutgoingReferences` warning for each standalone sample below. These samples omit outgoing workspace links so the reader can exercise their source as written. Intentional invalid-input suites belong in isolated workspaces.

- The callout and disclosure samples are [[samples/markdown/callouts]], [[samples/markdown/callout-review]], and [[samples/markdown/disclosures]].
- The reader syntax samples are [[samples/markdown/reader]], [[samples/markdown/edge-cases]], [[samples/markdown/reading-p1]], and [[samples/markdown/review-regressions]].
- The image and diagram samples are [[samples/markdown/images]], [[samples/markdown/viewers]], [[samples/markdown/mermaid]], and [[samples/markdown/mermaid-geometry]].
