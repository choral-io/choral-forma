---
schemaVersion: 1
kind: validation-sample
title: Diagram Worker and Sanitization Boundary
summary: Mermaid policy record for lazy worker rendering, per-diagram failure isolation, sanitization, accessibility, and local-only assets.
stage: blocked
priority: P0
area: projections
owner: "Noah Williams"
reviewer: "Elena García"
longValue: "mermaid://worker/render?network=denied&fallback=source&sanitize=svg-css-font&theme=semantic"
tags:
    - mermaid
    - worker
    - security
relatedSamples:
    - "samples/reader/markdown-rendering-showcase"
---

# Diagram Worker and Sanitization Boundary

Mermaid enhancement must remain isolated from Markdown parsing and from other diagrams in the same document.

```mermaid
flowchart TD
    Input["Diagram source"] --> Worker["Lazy rendering worker"]
    Worker --> Policy{"Valid and allowed?"}
    Policy -->|Yes| Safe["Sanitized SVG"]
    Policy -->|No| Fallback["Readable source fallback"]
```

The full rich-content pressure document is [[samples/reader/markdown-rendering-showcase]].
