---
schemaVersion: 1
kind: validation-case
title: Markdown Reader Rich Content
summary: Validates headings, anchors, links, code highlighting, math, local media, native disclosure, wide content, and long-token containment.
status: active
priority: P0
area: reader
surfaces:
    - Reader
    - Outline
automation: partial
sampleRefs:
    - "samples/reader/markdown-rendering-showcase"
    - "samples/reader/portable-markdown-elements"
    - "samples/reader/math-and-inline-edge-cases"
    - "samples/reader/reference-target"
    - "samples/reader/multilingual-long-title"
viewPaths: []
operations:
    - inspect
    - serve
assertionIds:
    - READ-001
    - READ-002
    - READ-003
    - READ-004
    - READ-005
    - READ-006
    - READ-007
tags:
    - markdown
    - shiki
    - katex
    - overflow
---

# Markdown Reader Rich Content

## Purpose

Validate the current browser-owned Markdown rendering contract using one deterministic document with representative rich content and pressure conditions.

## Preconditions

- Open [[samples/reader/markdown-rendering-showcase]] in the Reader.
- Open [[samples/reader/portable-markdown-elements]] for portable syntax coverage.
- Open [[samples/reader/math-and-inline-edge-cases]] for formula parsing boundaries.
- Keep [[samples/reader/reference-target]] available as the internal navigation target.

## Steps

1. Compare the visible heading hierarchy with the Outline.
2. Follow an internal document link and a fragment link, then return.
3. Inspect fenced code, inline math, block math, the local SVG, and the native disclosure section.
4. Scroll the wide Markdown table horizontally inside its local owner.
5. Inspect the long unbroken token at wide and narrow viewports.
6. Inspect inline formatting, safe HTML, line breaks, nested structures, task items, autolinks, escapes, and formatted table cells.
7. Compare valid formulae with invalid commands, currency, escaped delimiters, code literals, and the long display formula.

## Expected Results

- **READ-001:** Heading ids and Outline links target the corresponding section.
- **READ-002:** Internal links remain inside the workspace while external links retain external navigation semantics.
- **READ-003:** Code highlighting and KaTeX enhance valid input without hiding readable fallback text.
- **READ-004:** The committed SVG loads through the local media policy and `details` remains keyboard operable.
- **READ-005:** Wide content owns local horizontal overflow; the page root does not widen.
- **READ-006:** Portable Markdown and safe inline HTML preserve their intended structure without activating link-like code or escaped syntax.
- **READ-007:** Formula enhancement distinguishes valid math from invalid input, currency, escaped delimiters, and code while containing long display overflow locally.

## Evidence

Capture the Reader at wide and narrow widths and record link destinations, overflow owners, and console diagnostics.

## Known Limitations

This batch uses one local SVG and does not cover video, audio, or remote media.

## Related Case

Continue with [[cases/mermaid-rendering-and-inspection]].
