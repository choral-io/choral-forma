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
    - GRAPH-006
    - GRAPH-007
    - GRAPH-008
    - GRAPH-009
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

6. Select a node, expand the viewer, fit it, and close with Escape; repeat using the collapse button.
7. Inspect selected-node details, opener focus and scroll restoration after closing. Compare the right-side control lane with renderer and selected-summary bounds.
8. Open the static export without JavaScript and follow a node link in its semantic fallback.

## Expected Results

- **GRAPH-001:** Resolved edges retain body-link or `relatedSamples` provenance.
- **GRAPH-002:** Nodes use configured area colors; unclassified or multi-term states remain neutral if present.
- **GRAPH-003:** Selection emphasizes one-hop neighbors without duplicating nodes.
- **GRAPH-004:** Renderer bounds update after sidebar and viewport changes.
- **GRAPH-005:** Light, dark, and expanded presentations remain readable and interactive.

- **GRAPH-006:** Expand, fit and collapse preserve the selected node and live graph instance without recomputing its layout. Escape in expanded inspection closes without clearing selection; inline Escape keeps the graph engine's normal selection behavior.
- **GRAPH-007:** Closing expanded inspection restores focus to Expand graph and releases the page scroll lock.
- **GRAPH-008:** Renderer picking, fit and node details stay within the usable viewport beside the right control rail. Toolbar controls remain Reset/Fit and expand/collapse, without zoom-in/zoom-out buttons.
- **GRAPH-009:** Static initial HTML preserves readable node/link information and usable node navigation when JavaScript is disabled.

## Automation Coverage

`mise run test:markdown:browser` uses a deterministic single-node graph in its isolated workspace to cover selection across expand, fit and Escape within GRAPH-006, focus restoration within GRAPH-007, and availability of a node-navigation link within GRAPH-009, for the applicable hosts. It does not replace the configured dense graph in this case: one-hop emphasis, layout/instance identity, control-lane geometry, inline Escape and physical gestures need their focused tests or manual acceptance. Keep `automation: partial`.

## Evidence

Record node and edge counts from CLI output, selected-node behavior, legend labels, resize states, and console output.

## Known Limitations

The first batch uses a small deterministic graph rather than performance-scale thousands of nodes.

## Related Case

Continue with [[cases/responsive-shell-and-theme]].
