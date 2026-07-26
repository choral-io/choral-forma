---
schemaVersion: 1
kind: validation-sample
title: Portable Markdown Elements
summary: Deterministic coverage for inline formatting, safe HTML, line breaks, lists, task items, blockquotes, autolinks, escapes, and formatted table cells.
stage: review
priority: P1
area: reader
owner: "Morgan Lee"
reviewer: "Avery Chen"
longValue: "reader/portable-markdown-elements::inline-html-breaks-lists-tasks-quotes-autolinks-escapes-table-cells"
tags:
    - commonmark
    - gfm
    - portable
relatedSamples:
    - "samples/reader/markdown-rendering-showcase"
    - "samples/reader/math-and-inline-edge-cases"
---

# Portable Markdown Elements

This sample concentrates ordinary portable Markdown and safe inline HTML that should remain readable in every supported theme.

## Inline Formatting and Escapes

A paragraph can contain **strong text**, _emphasized text_, **_strong emphasis_**, ~~strikethrough~~, `inline code`, and escaped syntax such as \*literal asterisks\* or \[literal brackets\].

Safe inline HTML remains useful for H<sub>2</sub>O, x<sup>2</sup>, <mark>highlighted text</mark>, and <kbd>⌘</kbd> + <kbd>K</kbd>.

Reserved characters remain readable as text: `&`, `<`, `>`, `"quotes"`, `'apostrophes'`, `{braces}`, `[brackets]`, and `(parentheses)`.

## Line Breaks

This is a soft line break inside one paragraph. The sentence remains part of the same paragraph under CommonMark rules.

This line ends with a backslash for a hard break.\
This sentence starts on a new rendered line.

## Links

- Internal link: [[samples/reader/reference-target]].
- Internal fragment: [[samples/reader/reference-target#Second Fragment]].
- External labelled link: [CommonMark](https://commonmark.org/).
- External autolink: <https://github.github.com/gfm/>.

Inline code keeps link-looking text inert: `[Example](reference-target.md)`, `[[samples/reader/reference-target]]`, and `https://example.com/not-a-link`.

## Lists and Tasks

- Unordered item with a short sentence.
- Unordered item with nested content:
    - second-level item;
    - another second-level item:
        - third-level item with `inline code`.

1. First ordered step.
2. Second ordered step.
    1. Nested ordered step.
    2. Another nested step.

3. An ordered list can intentionally start at five.
4. Its numbering should continue from there.

- [x] Render a completed task.
- [ ] Render an incomplete task.
- [ ] Preserve **formatting** and [[samples/reader/math-and-inline-edge-cases|links]] inside task labels.

## Blockquotes

> Repository Markdown remains the source of truth.
>
> A quote can contain multiple paragraphs, **inline formatting**, and a list:
>
> - a quoted item;
> - another quoted item.
>
> > Nested quotes remain visually distinct without becoming oversized.

## Formatting Inside Table Cells

| Plain | Emphasis | Code | Link | Escaped |
| --- | --- | --- | --- | --- |
| Ordinary text | **Strong** and _emphasis_ | `stage: review` | [Reference target](reference-target.md) | \| literal pipe |
| Inline math | $x^2 + y^2 = z^2$ | `$x$` | [Math edges](math-and-inline-edge-cases.md) | \$5 |

## Related Coverage

Continue with [[samples/reader/math-and-inline-edge-cases]] or return to [[samples/reader/markdown-rendering-showcase]].
