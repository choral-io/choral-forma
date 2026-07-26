---
schemaVersion: 1
kind: validation-sample
title: Reader Theme Adaptation
summary: High-contrast content sample for checking semantic tokens across light, dark, and system theme modes.
stage: done
priority: P1
area: projections
owner: "Samira Okafor"
reviewer: "Jordan Rivera"
longValue: "theme://light-dark-system/reader-code-math-diagram-graph-selection"
tags:
    - theme
    - contrast
    - reader
relatedSamples:
    - "samples/reader/markdown-rendering-showcase"
    - "samples/projections/graph-reference-density"
---

# Reader Theme Adaptation

Semantic foreground, muted text, borders, code surfaces, and selection states should remain distinguishable in every supported theme.

## Contrast Targets

- ordinary body text;
- muted metadata;
- inline and fenced code;
- diagram labels;
- selected and one-hop Graph nodes.

Review [[samples/reader/markdown-rendering-showcase]] and [[samples/projections/graph-reference-density]] in the same theme session.
