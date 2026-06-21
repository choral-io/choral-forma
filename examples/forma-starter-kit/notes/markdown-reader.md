---
kind: note
title: "Markdown Reader"
summary: "A compact demonstration of Markdown rendering in the read-only WebApp."
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Markdown Reader

The reader renders ordinary Markdown. Choral Forma does not require proprietary page syntax for the common cases shown here. For a page that leans more heavily on internal references, compare [[notes/connect-pages|Connect Pages]].

## Inline Text

Paragraphs can include **strong text**, _emphasized text_, `inline code`, ~~strikethrough text~~, and external links such as [CommonMark](https://commonmark.org/).

Long inline values should wrap naturally, including paths such as `examples/forma-starter-kit/notes/markdown-reader.md`.

## Lists

- Keep notes short and scannable.
- Link related pages when the relationship matters.
  - Nested lists are useful for examples and checklists.
  - Inline code such as `.forma.yml` should remain readable.

1. Edit Markdown files in your normal editor.
2. Run the local Forma server.
3. Refresh the WebApp.

- [x] Read the starter guide
- [ ] Try it on a small local workspace

## Blockquote

> Repository Markdown remains the source of truth. The WebApp should explain it without creating hidden application state.

## Code Blocks

```sh
cargo run -p forma-cli -- --workspace examples/forma-starter-kit serve
```

```ts
const workspaceMode = "read-only";
const sourceOfTruth = "repository-markdown";
```

## Table

| Markdown feature | Reader behavior                 | Example use            |
| ---------------- | ------------------------------- | ---------------------- |
| Links            | Clickable page navigation       | Connect related notes  |
| Code             | Syntax-highlighted code blocks  | Commands and snippets  |
| Tables           | Horizontally scrollable if wide | Compact comparisons    |
| Images           | Kept inside the reader column   | Product or guide media |

## Image

Images can live beside the Markdown files and be referenced with ordinary relative paths.

![Choral Forma knowledge workspace hero](../assets/markdown-hero.png)

When you are done here, jump back to [[notes/welcome-to-choral-forma|Welcome to Choral Forma]] or continue to [[notes/saved-views|Saved Views]].
