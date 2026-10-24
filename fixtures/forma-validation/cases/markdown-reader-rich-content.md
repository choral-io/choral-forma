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
    - "samples/markdown/reader"
    - "samples/markdown/edge-cases"
    - "samples/markdown/review-regressions"
    - "samples/markdown/callouts"
    - "samples/markdown/callout-review"
    - "samples/markdown/callout-compatibility"
    - "samples/markdown/callout-interaction"
    - "samples/markdown/callout-layout"
    - "samples/markdown/images"
    - "samples/markdown/image-links"
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
    - READ-008
    - READ-009
    - READ-010
    - READ-011
    - READ-012
tags:
    - markdown
    - shiki
    - katex
    - overflow
---

# Markdown Reader Rich Content

## Purpose

Validate the current browser-owned Markdown rendering contract using shared deterministic documents with representative rich content and pressure conditions.

## Preconditions

- Open [[samples/reader/markdown-rendering-showcase]] in the Reader.
- Open [[samples/reader/portable-markdown-elements]] for portable syntax coverage.
- Open [[samples/reader/math-and-inline-edge-cases]] for formula parsing boundaries.
- Keep [[samples/reader/reference-target]] available as the internal navigation target.

- Use [[samples/markdown/reader]], [[samples/markdown/edge-cases]], and [[samples/markdown/review-regressions]] for heading and footnote boundaries.
- Use [[samples/markdown/callouts]], [[samples/markdown/callout-review]], and [[samples/markdown/callout-compatibility]] for supported markers, titles, formatter stability, and literal lookalikes. Use [[samples/markdown/callout-interaction]] for native disclosure, rich header links and folded navigation.
- Use [[samples/markdown/images]] and [[samples/markdown/image-links]] for ordinary images and authored links.

## Steps

1. Compare the visible heading hierarchy with the Outline.
2. Follow an internal document link and a fragment link, then return.
3. Inspect fenced code, inline math, block math, the local SVG, and the native disclosure section.
4. Scroll the wide Markdown table horizontally inside its local owner.
5. Inspect the long unbroken token at wide and narrow viewports.
6. Inspect inline formatting, safe HTML, line breaks, nested structures, task items, autolinks, escapes, and formatted table cells.
7. Compare valid formulae with invalid commands, currency, escaped delimiters, code literals, and the long display formula.

8. Follow readable heading aliases and existing reader IDs; inspect repeated headings, deep headings, and omitted leading-title targets.
9. Follow repeated footnote calls and each return link; compare multi-paragraph notes, Unicode labels, and missing definitions with their source.
10. Compare the five case-insensitive types, custom/default titles and title-only callouts with ordinary quotes, supported folding suffixes, escaped/unknown markers, and fenced code. Format the recommended blank-quote-line form and compare its rendering before and after formatting.
11. Click an ordinary image and the authored fragment, page, and external image links. Confirm there is no image viewer wrapper or expand button.
12. Repeat image/link checks in a static export under a non-root deployment path, with JavaScript enabled and disabled. Compare native VS Code Markdown separately without requiring identical host parser output.

## Expected Results

- **READ-001:** Heading ids and Outline links target the corresponding section.
- **READ-002:** Internal links remain inside the workspace while external links retain external navigation semantics.
- **READ-003:** Code highlighting and KaTeX enhance valid input without hiding readable fallback text.
- **READ-004:** The committed SVG loads through the local media policy and `details` remains keyboard operable.
- **READ-005:** Wide content owns local horizontal overflow; the page root does not widen.
- **READ-006:** Portable Markdown and safe inline HTML preserve their intended structure without activating link-like code or escaped syntax.
- **READ-007:** Formula enhancement distinguishes valid math from invalid input, currency, escaped delimiters, and code while containing long display overflow locally.

- **READ-008:** Readable heading aliases and historical IDs coexist without duplicate IDs; existing destinations remain authoritative and deep-heading targets resolve.
- **READ-009:** Footnotes preserve their content, distinct repeated calls and return destinations. Missing definitions stay literal; code and ordinary superscript-like text are not inferred as notes.
- **READ-010:** NOTE, TIP, IMPORTANT, WARNING, and CAUTION render consistently in the WebApp and static HTML, ignoring type-name case. Header-line text is a custom title, not body text; default and title-only forms are supported. Empty quoted lines protect header/body semantics through formatting. Immediate `-` and `+` suffixes produce native initially closed/open disclosures; enhanced fragment navigation reveals folded callout ancestors. Static summaries remain operable without JavaScript. Unknown types, unsupported suffixes, ordinary quotes, escaped text, and code remain literal.
- **READ-011:** Images render as ordinary images with alt/title and resource resolution intact. Forma adds no viewer, generated original-resource anchor, or image gesture handling. Author-supplied image links keep their navigation targets.
- **READ-012:** Static initial HTML retains readable images and authored links without JavaScript, including a deployment root prefix. VS Code retains native image/footnote/heading rendering; its host differences are expected.

## Automation Coverage

Run `mise run test:markdown:browser` from the repository root. It automatically covers image navigation within READ-002, READ-011, and the static-image portion of READ-012 across WebApp, enhanced static, and JavaScript-disabled static contexts. It also covers READ-010 disclosure defaults, pointer/keyboard toggling, rich header links, enhanced heading/footnote/history revelation, and wide/narrow light/dark containment. Use [[samples/markdown/callout-layout]] for long titles, unbroken links, title-only spacing, arrow clearance and keyboard focus outlines. The browser gate does not cover every assertion in this case. Heading, footnote and callout semantics also have Core/WebApp contract tests; VS Code native-output contract tests are separate from packaged-extension acceptance. Keep `automation: partial` until the remaining visual, keyboard and host acceptance is automated.

## Evidence

Capture the Reader at wide and narrow widths and record link destinations, overflow owners, and console diagnostics.

## Known Limitations

The image samples use committed local assets. External image-link navigation is deterministic in the browser gate through request interception; this does not validate remote image hosting, video, or audio. Physical-device, screen-reader and packaged VSIX acceptance remain separate.

## Related Case

Continue with [[cases/mermaid-rendering-and-inspection]].
