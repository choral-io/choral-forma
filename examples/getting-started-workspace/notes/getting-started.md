---
title: "Getting Started"
summary: "Run the getting-started workspace with forma serve and explore the WebApp."
createdAt: "2026-06-03T18:00:00Z"
updatedAt: "2026-06-03T18:00:00Z"
---

# Getting Started

This example workspace lives under `examples/getting-started-workspace`. It is shaped around a single `.forma.md` entry plus ordinary Markdown pages.

## Serve The WebApp

```sh
cargo run -p forma-cli -- --workspace examples/getting-started-workspace serve
```

Open the printed local URL in your browser. The WebApp uses the same workspace files that you can inspect in your editor.

## How It Works

Forma reads `.forma.md`, follows its imports, scans the configured Markdown files, and builds the read model for pages, taxonomies, views, references, diagnostics, and WebApp navigation context.

The getting-started workspace does not use a committed persistent index. When the local server starts, it can rebuild the read model from repository files.

## Language Variants

The getting-started workspace declares `en` and `zh-Hans` in `.forma.md`. Files such as `notes/getting-started.zh-hans.md` are language variants of their canonical pages, not separate guide pages.

## Workspace Health

The WebApp can surface diagnostics from the read model. Health checks should help readers notice configuration, parsing, reference, and view issues without requiring them to inspect every file manually.

## What To Edit First

Read [[guidelines/workspace-operations|Workspace Operations]] first, then try changing the summary of [[notes/welcome-to-choral-forma|Welcome to Choral Forma]]. Restart the local server and refresh the WebApp to see the update.
