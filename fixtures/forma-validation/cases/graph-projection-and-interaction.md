---
schemaVersion: 1
kind: validation-case
title: Graph Projection and Interaction
summary: Validates resolved body and field edges, configured taxonomy colors, selection, one-hop focus, resize, theme, and expanded inspection.
status: active
priority: P0
area: graph
surfaces:
    - Graph View
automation: partial
sampleRefs:
    - "samples/projections/graph-reference-density"
    - "samples/workspace/repository-markdown-source"
    - "samples/workspace/workspace-config-inspection"
    - "samples/reader/reference-target"
    - "samples/navigation/mobile-navigation-dialog"
viewPaths:
    - ".forma/views/workspace-graph.md"
operations:
    - view.render
    - serve
assertionIds:
    - GRAPH-001
    - GRAPH-002
    - GRAPH-003
    - GRAPH-004
    - GRAPH-005
tags:
    - graph
    - taxonomy
    - references
    - responsive
---

# Graph Projection and Interaction

## Purpose

Validate that Core supplies deterministic graph semantics and that the shared renderer handles presentation and interaction without guessing taxonomy meaning.

## Preconditions

- `forma view render workspace-graph --json` passes.
- Open `Validation Sample Graph` in the WebApp.

## Steps

1. Compare visible nodes and edges with body links and `relatedSamples`.
2. Confirm the legend uses the configured `areas` taxonomy colors.
3. Select a dense node and inspect its one-hop neighborhood.
4. Collapse and expand the desktop sidebar, then resize the viewport.
5. Switch themes and open the expanded graph viewer.

## Expected Results

- **GRAPH-001:** Resolved edges retain body-link or `relatedSamples` provenance.
- **GRAPH-002:** Nodes use configured area colors; unclassified or multi-term states remain neutral if present.
- **GRAPH-003:** Selection emphasizes one-hop neighbors without duplicating nodes.
- **GRAPH-004:** Renderer bounds update after sidebar and viewport changes.
- **GRAPH-005:** Light, dark, and expanded presentations remain readable and interactive.

## Evidence

Record node and edge counts from CLI output, selected-node behavior, legend labels, resize states, and console output.

## Known Limitations

The first batch uses a small deterministic graph rather than performance-scale thousands of nodes.

## Related Case

Continue with [[cases/responsive-shell-and-theme]].
