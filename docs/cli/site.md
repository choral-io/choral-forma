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

`forma site build` exports the shared, managed content of a Forma workspace as a static, multi-page HTML artifact. It does not start a server, create a second content store, or change workspace sources. Serve the completed output with an ordinary static-file host; every generated route has its own HTML file, including `404.html`, `sitemap.xml`, and `robots.txt`.

The initial HTML contains readable entry bodies and ordinary links. JavaScript is progressive enhancement: it adds richer Markdown rendering, navigation, themes, Graphs, and Quick Open. The static WebApp reads `data/dashboard.json` plus entry and View JSON files from the artifact; it does not call Forma RPC. Quick Open searches the loaded dashboard's paths, titles, spaces, entries, and Views. It is not server-side or full-text search.

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

The artifact contains static HTML, hashed WebApp assets, dashboard and route data, copied referenced resources under `raw/`, and hosting support files. It needs no SPA fallback rule, long-running Forma process, database, or `/rpc` endpoint. Its `_headers` file provides a strict Cloudflare Static Assets baseline, including a CSP that permits same-origin scripts but no executable inline script. Hosts that do not recognize `_headers` ignore it; configure equivalent headers there. Deployment, DNS, custom-domain changes, provider credentials, and production publication are separate approval gates; producing or uploading a CI artifact does not publish a site.

## Publication And Resource Boundary

The builder exports the effective workspace projection and configured routes, not a repository copy. Every valid configured import participates, including paths whose directory happens to be named `local`; Forma does not assign privacy or publication semantics to path names or `.gitignore`. In this open-source repository, project, release, member, task, and other configured workspace records are eligible to be public because the repository itself is public. Authors who need to keep material out of an artifact must leave it outside the configured workspace inputs.

Only resources referenced by exported content or declared workspace presentation are copied, under `raw/`. Forma rejects path traversal, symlinks, non-regular resource files, hidden path components, and configuration-source documents; it does not copy arbitrary workspace or repository files. A directory component named `local` is an ordinary path component and is copied when referenced by exported content.

### Trusted-Author Publication Boundary

Referenced SVG files are currently copied as bytes after path-safety checks. They are not sanitized. The official Cloudflare Worker disables `workers.dev` and generated preview URLs, serves only the reviewed Custom Domain, and applies a restrictive response-header baseline. This reduces exposure, but it does not turn untrusted SVG or untrusted workspace content into an accepted input class. The site remains limited to artifacts published by trusted maintainers. An untrusted pull-request preview must not be deployed to the production origin or receive production credentials.

Before accepting untrusted authors, add a security boundary such as SVG sanitization or rasterization, or place active assets on an independent no-credentials origin, together with an appropriate CSP and `Content-Disposition` policy. Do not treat static hosting alone as a safe boundary for active same-origin resources.

## Deliberately Omitted

The first static target does not provide authenticated or partially private content, a CMS or hosted editing surface, server-side search, comments, analytics, deployment-provider APIs, DNS management, custom-domain management, draft approvals, user-defined publication fields, multiple independently configured site targets, versioned documentation, or localized-route negotiation.
