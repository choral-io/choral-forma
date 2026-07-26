---
schemaVersion: 1
kind: validation-case
title: Mermaid Rendering and Inspection
summary: Validates valid and invalid diagrams, sanitization boundaries, theme adaptation, source disclosure, and zoomable inspection.
status: active
priority: P0
area: mermaid
surfaces:
    - Reader
    - Diagram Viewer
automation: partial
sampleRefs:
    - "samples/reader/markdown-rendering-showcase"
    - "samples/projections/diagram-worker-boundary"
viewPaths: []
operations:
    - inspect
    - serve
assertionIds:
    - MMD-001
    - MMD-002
    - MMD-003
    - MMD-004
    - MMD-005
tags:
    - mermaid
    - worker
    - sanitization
    - zoom
---

# Mermaid Rendering and Inspection

## Purpose

Exercise Mermaid as a bounded Reader enhancement: valid diagrams render asynchronously, invalid diagrams fail locally, and inspection controls remain safe and accessible.

## Preconditions

- Open the Mermaid section in [[samples/reader/markdown-rendering-showcase]].
- Open [[samples/projections/diagram-worker-boundary]] in a second navigation pass.

## Steps

1. Wait for the valid flowchart and sequence diagram to render.
2. Inspect the intentionally invalid diagram and its source fallback.
3. Switch between light and dark themes.
4. Use zoom in, zoom out, pan, reset, and expanded viewer controls.
5. Use an ordinary wheel gesture outside explicit zoom interaction.

## Expected Results

- **MMD-001:** Each valid diagram renders independently through the lazy worker path.
- **MMD-002:** Invalid source produces a local fallback without breaking other diagrams or the Reader.
- **MMD-003:** Rendered SVG remains sanitized and does not request external fonts or assets.
- **MMD-004:** Theme changes preserve readable diagram text and semantic colors.
- **MMD-005:** Zoom controls affect only the diagram viewer; ordinary page scrolling remains available.

## Evidence

Record worker or render diagnostics, diagram fallback text, theme states, zoom state, and console output.

## Known Limitations

This case does not attempt exhaustive coverage of the Mermaid grammar.

## Related Case

Continue with [[cases/table-overflow-and-sticky-header]].
