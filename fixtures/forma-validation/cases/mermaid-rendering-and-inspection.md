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
    - "samples/markdown/viewers"
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
    - MMD-006
    - MMD-007
    - MMD-008
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

- Open [[samples/markdown/viewers]] for wide/tall diagrams and ordinary images beside the viewer.

## Steps

1. Wait for the valid flowchart and sequence diagram to render.
2. Inspect the intentionally invalid diagram and its source fallback.
3. Switch between light and dark themes.
4. Use Ctrl/Command-wheel or trackpad pinch, plus/minus keys, drag or arrow keys, Fit, and expand/collapse controls. There are no zoom-in or zoom-out toolbar buttons.
5. Use an ordinary wheel gesture outside explicit zoom interaction.

6. Fit the wide and tall diagrams before and after resize; compare their bounds with the right-side control rail.
7. Expand a diagram and close it with Escape, then repeat using Close. Check opener focus, page scroll restoration, and source disclosure.
8. Open the exported static page with JavaScript disabled and inspect the Mermaid source blocks.

## Expected Results

- **MMD-001:** Each valid diagram renders independently through the lazy worker path.
- **MMD-002:** Invalid source produces a local fallback without breaking other diagrams or the Reader.
- **MMD-003:** Rendered SVG remains sanitized and does not request external fonts or assets.
- **MMD-004:** Theme changes preserve readable diagram text and semantic colors.
- **MMD-005:** Explicit zoom gestures and keyboard shortcuts affect only the diagram viewer; ordinary wheel scrolling remains available. The toolbar offers Fit and expand/collapse, without zoom-in/zoom-out buttons.

- **MMD-006:** Fit contains wide and tall diagrams inside both viewport axes and reserves the measured right-side control lane. Reset restores this overview after resize.
- **MMD-007:** Escape and Close dismiss expanded inspection, restore focus to its opener and release the page scroll lock. Source and accessible diagram descriptions remain available.
- **MMD-008:** Static initial HTML keeps the Mermaid source readable without JavaScript; no unusable viewer controls appear. Adjacent images remain ordinary images.

## Automation Coverage

`mise run test:markdown:browser` exercises Mermaid expand/Escape focus and scroll-lock restoration within MMD-007 for WebApp and enhanced static, plus source fallback within MMD-008 for JavaScript-disabled static. Close-button dismissal, theme, safe-area geometry, physical gestures and the remaining diagram failure/grammar cases still require their focused tests or manual acceptance; `automation: partial` remains accurate.

## Evidence

Record worker or render diagnostics, diagram fallback text, theme states, zoom state, and console output.

## Known Limitations

This case does not attempt exhaustive coverage of the Mermaid grammar.

## Related Case

Continue with [[cases/table-overflow-and-sticky-header]].
