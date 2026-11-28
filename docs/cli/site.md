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

Document URLs use the exact workspace-relative path, including the Markdown extension. For example, `notes/welcome.md` is `/notes/welcome.md`. The directory `/notes` lists indexed children and can use `notes/.index.md` from the configured content scope for its optional `title`, `summary`, and Markdown body. Put a single standalone `<!-- forma:content -->` comment where you want the list. By default the list follows the body.

Forma reserves `.index.md` and `.forma.md` from content, guideline, and configuration import patterns. The workspace root uses `.forma.md` directly at `/`. A directory introduction contributes only to its directory page. Files named `index.md` or `index.mdx` are regular documents with their own URLs.

Collections are at `/~`, with taxonomies at `/~/<taxonomy>` and terms at `/~/<taxonomy>/<term>`. Views are at `/-/views/<public-id>`. If several Views share the same basename, all members of that collision group receive a stable digest suffix based on their full configuration ID. Use the projected View URL or sitemap when updating bookmarks. The top-level segments `~` and `-` are reserved.

Older bookmarks to extensionless entries should use the full source path. When upgrading from 0.2.0, move the introduction from `index.md` or `index.mdx` to `.index.md` and use the directory URL for links and bookmarks to the introduction. Keep the regular file if its exact URL should continue to open a standalone document. Rename any existing `.index.md` that should remain a standalone document to an ordinary document filename and update its links. Replace `/-/browse` with `/~` for collection links and preserve any query or fragment needed by the destination. An old URL that matches a current directory opens that directory.

The export includes readable entry bodies, directory listings, navigation, and Health without JavaScript. Opening `/-/` leads to Home. Interactive enhancement adds richer Markdown rendering, navigation, themes, Graphs, and Quick Open. It reads the manifest and explicit detail paths under `/-/data/<artifactId>/` and activates only after validating the document's target against data from the same build. An enhancement failure preserves the initial HTML. Deploy the complete output of one build together so its HTML, scripts, and directory data use the same format.

### Route Conflicts

`forma check` reports conflicting owners together. `forma serve` runs route preflight before binding its port, and `site build` runs route and static output preflight before writing the artifact.

- `route.reserved` identifies documents under a reserved top-level segment.
- `route.invalidSegment` identifies invalid URL path segments in documents and classification IDs.
- `route.collision` identifies multiple owners of the same canonical route.
- `route.staticOutputConflict` identifies conflicts in the static output tree, including case-only differences and clashes with fixed artifact files. It is a warning for workspace checks and an error for static builds.
- `route.preflightIncomplete` indicates that input errors prevented a complete route check.

`site build` also checks whether the destination filesystem treats distinct output names as equivalent, including Unicode normalization and non-ASCII case differences. It reports the conflicting owners before writing the artifact. This destination check preserves the original classification IDs and RPC routes. Run it on the intended output filesystem to verify whether a particular set of routes can be exported there.

Rename or exclude a conflicting source, or repair invalid configuration before repeating preflight.

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

The artifact contains static HTML, hashed WebApp assets, dashboard and route data, copied referenced resources under `-/raw/`, and hosting support files. Only `index.html`, `404.html`, `sitemap.xml`, `robots.txt`, `_headers`, and the ownership marker sit at its root beside the content and collection directories. Assets, copied resources and build-specific data are under `-/`. It needs no SPA fallback rule, long-running Forma process, database, or RPC endpoint. Its `_headers` file supplies a restrictive response-header baseline, including a CSP that permits same-origin scripts but no executable inline script. Static hosts differ in whether they apply `_headers`; configure equivalent headers when yours does not. Building an artifact is separate from any hosting or publication operation.

## Publication And Resource Boundary

The builder exports the effective workspace projection and configured routes, not a repository copy. Every valid configured import participates regardless of directory name or `.gitignore`; neither creates privacy or publication semantics. Keep material that requires a privacy guarantee outside configured workspace inputs.

Only resources referenced by exported content or declared workspace presentation are copied, under `-/raw/`. Forma rejects path traversal, symlinks, non-regular resource files, hidden path components, and configuration-source documents; it does not copy arbitrary workspace or repository files. Names suggesting private or local content do not exclude otherwise eligible referenced resources.

To publish a JSON original, link to its `/-/raw/` URL from an exported Markdown page. For example, `[Download JSON](/-/raw/reports/report.json)` publishes the regular file `reports/report.json`. The link works with `forma serve`, and the static builder adds the deployment root path to the URL.

An included description such as `reports/report.json.md` keeps its Markdown URL. Ordinary links such as `./report.json` retain document resolution, including the existing description alias. Use the explicit raw link to include the JSON bytes in the static artifact.

When upgrading an existing workspace, check explicit JSON links that previously relied on `forma serve`. Static builds now include the referenced original and fail if it is missing or unsafe.

### Trusted-Author Publication Boundary

Referenced SVG files are copied as bytes after path-safety checks; they are not sanitized. This does not make untrusted SVG or workspace content an accepted input class. Static artifacts must be built and published by trusted authors, and untrusted artifacts must not receive production credentials or be served from a production origin.

Before accepting untrusted authors, add a security boundary such as SVG sanitization or rasterization, or place active assets on an independent no-credentials origin, together with an appropriate CSP and `Content-Disposition` policy. Do not treat static hosting alone as a safe boundary for active same-origin resources.

## Deliberately Omitted

`site build` is a static export, not an interactive publishing service. It does not provide authentication, hosted editing, server-side features, deployment-provider management, or per-entry publication filtering and authorization policy.
