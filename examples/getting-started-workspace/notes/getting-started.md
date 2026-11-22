---
title: "Getting Started"
summary: "Explore the getting-started workspace locally and publish a static copy."
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

## Publish a Static Site

With Forma installed, run this command from the repository root. Replace `https://example.test` with the origin of your static host.

```sh
forma --workspace examples/getting-started-workspace site build \
  --out dist/getting-started-preview \
  --base-url https://example.test \
  --root-path /preview
```

Upload the complete contents of `dist/getting-started-preview` to the `/preview` path on your static host. The host should serve `index.html` for directory paths. To publish at the root of an origin, omit `--root-path` and serve the output at `/`.

Try these addresses on your host after publishing.

| Path                                          | What opens                                             |
| --------------------------------------------- | ------------------------------------------------------ |
| `/preview/notes#start-here`                   | The Notes directory, with its introduction and listing |
| `/preview/notes/index.md#exact-document-path` | An ordinary Markdown document in the Notes listing     |
| `/preview/notes/markdown-reader.md#image`     | The image section in the Markdown Reader guide         |
| `/preview/~/spaces/notes`                     | The Notes collection                                   |
| `/preview/-/views/guide`                      | The saved guide view                                   |

The [Notes directory](./#start-here) gets its title, summary, and Markdown body from `notes/.index.md`. The standalone comment `<!-- forma:content -->` places the child folders and pages between the introduction and its closing line. Leave the comment out to put the list after the Markdown. The directory listing and its links also work with JavaScript disabled. Open [Index Files and Directory Pages](./index.md) to try the independent document route.

When updating an older bookmark such as `/preview/pages/notes/markdown-reader#image`, use `/preview/notes/markdown-reader.md#image`. Keep the deployment prefix and any query parameters or heading fragment that still apply to the destination.

## How It Works

Forma reads `.forma.md`, follows its imports, scans the configured Markdown files, and builds the read model for pages, taxonomies, views, references, diagnostics, and WebApp navigation context.

The getting-started workspace does not use a committed persistent index. When the local server starts, it can rebuild the read model from repository files.

## Language Variants

The getting-started workspace declares `en` and `zh-Hans` in `.forma.md`. Files such as `notes/getting-started.zh-hans.md` are language variants of their canonical pages, not separate guide pages.

## Workspace Health

The WebApp can surface diagnostics from the read model. Health checks should help readers notice configuration, parsing, reference, and view issues without requiring them to inspect every file manually.

## What To Edit First

Read [[guidelines/workspace-operations|Workspace Operations]] first, then try changing the summary of [[notes/welcome-to-choral-forma|Welcome to Choral Forma]]. Restart the local server and refresh the WebApp to see the update.
