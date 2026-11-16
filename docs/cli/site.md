---
id: cli.site
title: forma site build
summary: Build a disposable static site artifact from a Forma workspace.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma site build
order: 60
---

# forma site build

## Overview

`forma site build` exports the configured workspace projection as a static, multi-page HTML artifact. It does not start a server, create a second content store, or change workspace sources. Serve the completed output with an ordinary static-file host; every generated route has its own HTML file, including `404.html`, `sitemap.xml`, and `robots.txt`.

Content owns the root of the URL space: a page is served at its source path without the Markdown extension, so `notes/welcome.md` is `/notes/welcome`, and `notes/index.md` is `/notes`. The root page is `.forma.md` and also lists the root folders. Each other directory that holds an indexed page has its own page at its path listing its folders and pages, unless a page is served at that route already, such as the directory's `index.md` or a same-named page beside it. Everything Forma adds is under the reserved `-` segment: collections at `/-/browse/<taxonomy>/<term>`, Views at `/-/views/<view>`, and the artifact's data, assets, and resources.

The initial HTML contains readable entry bodies and ordinary links, with directory lists below the documents that represent folders. The static Health page at `/-/health` shows the recorded export check status. Opening `/-/` leads to Home, including when JavaScript is disabled. JavaScript is progressive enhancement: it adds richer Markdown rendering, navigation, themes, Graphs, and Quick Open. The static WebApp reads `-/data/dashboard.json` plus entry and View JSON files from the artifact; it does not call Forma RPC. Quick Open searches the loaded dashboard's paths, titles, spaces, entries, and Views. It is not server-side or full-text search.

### Route Conflicts

`forma check` reports content that cannot be served at its route, and `site build` refuses to write an artifact while any of these remain, listing each one:

- `route.reserved`: a document whose top-level name is `-`, the segment reserved for Forma.
- `route.invalidSegment`: a generated document route segment, taxonomy id, or term id that is empty, `.`, or `..`.
- `route.collision`: two sources at one route, such as `x.md` beside `x/index.md`.
- `route.staticOutputConflict`: routes a static artifact cannot hold apart, such as paths that differ only in case, a page named `index.html`, or a root page named after one of the artifact's root files. A local server still serves these, so `forma check` reports them as warnings; `site build` treats them as errors.

Rename or exclude one of the sources to resolve a conflict.

## CLI Help

```sh
forma site build \
  --out <directory> \
  --base-url <http-or-https-origin> \
  [--root-path <deployment-subpath>] \
  [--json]
```

`--out` and `--base-url` are required. `--base-url` is an HTTP(S) origin only: it cannot contain a path, query, fragment, or user information. `--root-path` defaults to `/`; use it when hosting beneath a path, for example `--base-url https://example.test --root-path /preview`. Forma combines the origin and root path for canonical URLs, `sitemap.xml`, static resource URLs, and browser routing.

The root page always renders the Markdown body of `.forma.md`. Its frontmatter remains workspace configuration, while its body is the read-only workspace introduction. This makes the root document the same source for local and static readers; it is not a managed entry and cannot be replaced by a build flag. `--json` emits a structured `site.build` result with output location, normalized URL settings, diagnostics, and route, page, View, resource, asset, warning, and byte counts.

## Artifact Ownership And Hosting

The output directory is disposable and owned by Forma. A new output is written through a staging directory. An existing output can be replaced only when it contains the `.forma-site-artifact` marker, preventing accidental replacement of an unrelated directory. A successful build replaces the complete artifact tree, including stale files. If staging fails, the previous artifact remains untouched; if activation fails after the old artifact was moved aside, Forma attempts to restore it. After a successful activation, no automatic rollback copy is retained: host operators should retain the prior artifact or rebuild from a known source commit for rollback.

The artifact contains static HTML, hashed WebApp assets, dashboard and route data, copied referenced resources under `-/raw/`, and hosting support files. Only `index.html`, `404.html`, `sitemap.xml`, `robots.txt`, `_headers`, and the ownership marker sit at its root beside the content directories; everything else is under `-/`. It needs no SPA fallback rule, long-running Forma process, database, or RPC endpoint. Its `_headers` file supplies a restrictive response-header baseline, including a CSP that permits same-origin scripts but no executable inline script. Static hosts differ in whether they apply `_headers`; configure equivalent headers when yours does not. Building an artifact is separate from any hosting or publication operation.

## Publication And Resource Boundary

The builder exports the effective workspace projection and configured routes, not a repository copy. Every valid configured import participates regardless of directory name or `.gitignore`; neither creates privacy or publication semantics. Keep material that requires a privacy guarantee outside configured workspace inputs.

Only resources referenced by exported content or declared workspace presentation are copied, under `-/raw/`. Forma rejects path traversal, symlinks, non-regular resource files, hidden path components, and configuration-source documents; it does not copy arbitrary workspace or repository files. Names suggesting private or local content do not exclude otherwise eligible referenced resources.

### Trusted-Author Publication Boundary

Referenced SVG files are copied as bytes after path-safety checks; they are not sanitized. This does not make untrusted SVG or workspace content an accepted input class. Static artifacts must be built and published by trusted authors, and untrusted artifacts must not receive production credentials or be served from a production origin.

Before accepting untrusted authors, add a security boundary such as SVG sanitization or rasterization, or place active assets on an independent no-credentials origin, together with an appropriate CSP and `Content-Disposition` policy. Do not treat static hosting alone as a safe boundary for active same-origin resources.

## Deliberately Omitted

`site build` is a static export, not an interactive publishing service. It does not provide authentication, hosted editing, server-side features, deployment-provider management, or per-entry publication filtering and authorization policy.
