---
scope: project
type: execution-plan
title: Forma Static Site Generation And Official Site Plan
summary: Deliver a productized `forma site build` path that publishes a Forma workspace as crawlable static HTML with optional browser enhancement, then use the Choral Forma project workspace as the content source for forma.choral.io.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - planning
    - static-site
    - publishing
    - webapp
    - cli
    - dogfooding
    - official-site
sources:
    - "product/product-direction"
    - "product/choral-forma"
    - "decisions/forma-p0-core-architecture"
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/webapp-v2-read-model-contract"
    - "architecture/webapp-v2-package-architecture"
    - "design/webapp-review-surface-design"
---

# Forma Static Site Generation And Official Site Plan

## Status And Authorization Boundary

This document is an implementation plan. It records the proposed product boundary, delivery sequence, AI Coding budget, verification gates, and deployment path.

It does not by itself authorize:

- implementation changes;
- task creation or task-board moves;
- `.forma` schema or configuration changes;
- dependency additions;
- DNS changes;
- deployment credential changes;
- production deployment to `forma.choral.io`;
- a Forma release.

Each of those actions remains subject to its normal review and approval boundary.

## Objective

Add a static-site build target to Forma and use the Choral Forma repository's own Forma-managed workspace as the canonical content source for `https://forma.choral.io`.

The final output should be a statically hosted multi-page site with optional client-side enhancement:

- every exported entry has a standalone HTML route;
- titles, summaries, navigation, and entry bodies are present in generated HTML;
- the generated site requires no Forma server, RPC endpoint, database, or server-side application runtime;
- JavaScript may enhance navigation, search, Mermaid, syntax highlighting, math, Graph, themes, and other interactive behavior;
- entry content and ordinary links remain readable when JavaScript is unavailable;
- the existing repository Markdown and Forma configuration remain the source of truth;
- the official site does not introduce a second copy of canonical product documentation.

This is a static publishing target for the shared Forma capability layer. It does not reverse [[decisions/editor-extension-primary-product-surface]] or make the WebApp the primary authoring surface again.

## Product Position

The feature should make this relationship explicit:

```text
repository Markdown + Forma configuration
-> Forma Core analysis and projections
-> static site artifact
-> forma.choral.io
```

The Choral Forma official site is the first dogfooding workspace, not a hard-coded product template. Product-facing implementation must continue to use neutral workspace, page, taxonomy, term, view, entry, and site language rather than treating this repository's `knowledge/`, Task, Member, or project-development conventions as Forma built-ins.

## Confirmed Direction

- The default official-site projection includes all shared entries managed by the current Forma workspace.
- Public project, architecture, decision, planning, task, release, test, and member records are valid official-site content for this open-source project.
- Information hierarchy controls prominence; it is not a confidentiality allowlist.
- Local-only and machine-local state must not enter the artifact.
- The source workspace remains editable and maintainable through ordinary Markdown, CLI, and editor workflows.
- The generated artifact is disposable and must never become a round-trip source of truth.
- The final target is not a single-shell SPA. It is a multi-page static site with one crawlable HTML output per public route.
- The final target is not a zero-JavaScript site. Browser enhancement remains available where it adds real value.
- Astro or another general-purpose SSG should not be introduced in the first slice. Forma already owns workspace discovery, references, Markdown analysis, view projections, routing metadata, a semantic HTML output mode, and a reusable WebApp.

## Current Verified Baseline

Baseline captured on 2026-07-27:

| Evidence                    | Current result             |
| --------------------------- | -------------------------- |
| `config inspect`            | Passed with no diagnostics |
| `workspace health`          | Passed with no findings    |
| Configured spaces           | 17                         |
| Managed entries             | 185                        |
| Configured views            | 2                          |
| Configured taxonomies       | 1                          |
| Localized entry variants    | 0                          |
| Task entries                | 80                         |
| Current WebApp build output | Approximately 4.8 MB       |

Relevant implementation seams already exist:

- `forma-core` supports `file.render` with `markdown`, `html`, and `source` output modes.
- HTML output is semantic GFM HTML generated from the same parsed document and reference-fallback pipeline.
- `workspace.dashboard` provides workspace, taxonomy, space, entry, route, and View summaries.
- `file.references` provides outgoing references and backlinks.
- `view.render` provides structured list, table, kanban, and graph projections.
- `packages/webapp` consumes workspace data through a three-method `WorkspaceClient` boundary.
- `forma-cli` already embeds the built WebApp distribution for `forma serve`.
- Vite already emits relative asset URLs through `base: "./"`.

The missing capability is an explicit batch export and artifact-generation path. The project does not need a new Markdown model, second knowledge index, or second application UI.

## Output Contract

### Proposed CLI

The first productized command should be:

```sh
forma site build \
  --out dist/site \
  --base-url https://forma.choral.io \
  --home knowledge/product/choral-forma.md
```

Proposed initial arguments:

| Argument              | Behavior                                                      |
| --------------------- | ------------------------------------------------------------- |
| `--out <path>`        | Required output directory for the disposable artifact         |
| `--base-url <url>`    | Canonical origin used for absolute metadata and sitemap URLs  |
| `--home <entry-path>` | Optional managed entry used as the official landing-page body |
| `--root-path <path>`  | Optional deployment subpath; defaults to `/`                  |
| `--json`              | Emit a structured build result and diagnostics                |

The first slice should prefer explicit CLI arguments over adding a new `.forma` site schema. A file-backed site definition can be proposed later if repeated use proves that title, navigation, metadata, theme, or multiple-target configuration needs a durable product model.

### Proposed Artifact

```text
dist/site/
  index.html
  404.html
  robots.txt
  sitemap.xml
  assets/
    app-<hash>.js
    app-<hash>.css
    ...
  data/
    dashboard.json
    entries/
      <stable-entry-id>.json
    views/
      <stable-view-id>.json
  raw/
    <referenced-workspace-assets>
  pages/
    <stable-entry-route>/
      index.html
  views/
    <stable-view-route>/
      index.html
  <taxonomy-route>/
    index.html
    <term-route>/
      index.html
```

The exact filename encoding may change during implementation, but URLs and data identifiers must remain deterministic and derive from existing Forma route identities rather than absolute source paths.

### Static Hosting Semantics

The artifact must:

- work when served by a generic static file server;
- support direct loading of every generated route;
- contain no runtime request to `/rpc`;
- preserve ordinary browser navigation without requiring an SPA fallback rule;
- keep client-side navigation as an enhancement, not a hosting requirement;
- avoid embedding absolute host filesystem paths;
- avoid embedding runtime identity, local overrides, ignored local files, diagnostics that are not intentionally presented, or build-machine metadata;
- produce the same content and stable filenames from the same source commit and tool version, excluding explicitly documented hash changes from WebApp assets.

## Publication Boundary

The site builder should use Forma's shared workspace load path and configured managed entries:

```text
LoadMode::SharedOnly
-> configured managed entries
-> referenced public resources
-> generated site artifact
```

The first slice should not infer publication semantics from `.gitignore`. It should also not copy the entire repository or expose the existing raw-file server behavior.

Rules:

- Export all entries returned by the shared workspace projection.
- Export all configured taxonomy and View routes that can be rendered successfully.
- Copy only workspace resources intentionally referenced by exported content or configured workspace presentation.
- Do not copy `.forma.md`, `.forma/` configuration nodes, `.agents/`, skills, Git data, build output, local workspaces, caches, or arbitrary ignored files.
- Do not make an allowlist of Product, Architecture, or other project-specific spaces part of the generic feature.
- Treat future `exclude`, `draft`, or `noindex` behavior as a separate product decision. Do not invent built-in publication fields from this repository's current metadata.

## Rendering Strategy

### Entry HTML

Use the existing Core HTML renderer as the crawlable and no-JavaScript baseline:

```text
source Markdown
-> Markdown AST
-> Forma reference fallback
-> semantic HTML
-> static page template
```

The browser WebApp may then replace or enhance that baseline with the existing richer renderer:

- Shiki syntax highlighting;
- KaTeX;
- Mermaid;
- responsive Table behavior;
- reference-aware navigation;
- themes;
- document outline and context;
- Quick Open and client-side search.

The implementation must avoid a visible blank or skeleton-only first render. If React enhancement replaces the static body, it should preserve the title, scroll target, entry identity, and route without a content flash that materially degrades reading.

### Views

Generate static route HTML for configured Views:

- list: semantic list of rendered items;
- table: semantic table with configured columns;
- kanban: ordered column sections and cards;
- graph: a crawlable node/link summary plus optional browser-enhanced interactive Graph.

The structured `view.render` result remains canonical. Static templates must not re-query frontmatter or recreate View semantics outside Core.

### Homepage

The dogfood build should use `knowledge/product/choral-forma.md` as the initial landing-page body and compose it with configured workspace navigation.

This is a deployment choice for the Choral Forma project, not a built-in assumption that future workspaces have a `product` space or `knowledge/product/choral-forma.md` entry.

The homepage should:

- explain Forma before exposing workspace structure;
- provide direct links to installation, product direction, documentation, releases, and source;
- expose the complete workspace through normal navigation;
- distinguish primary product/documentation links from public project-development records through hierarchy and labels;
- avoid copying product prose into a separate site-only source.

## Architecture Slices

### Core Static Snapshot

Add a batch-oriented Core path that produces the complete static-site input from one workspace load and one discovery/index pass.

It should include:

- workspace summary;
- taxonomy and term summaries;
- entry summaries and stable routes;
- entry Markdown and/or semantic HTML;
- headings;
- reference edges and backlinks;
- View definitions and rendered projections;
- referenced resource paths;
- structured diagnostics and build summary.

Do not implement the build by calling the current standalone `render_file` path 185 times if each call reloads and rediscovers the workspace. The site build should share a loaded workspace and discovery result so build cost scales with content rather than repeated setup.

### CLI Artifact Writer

Add the `site build` command to:

- validate arguments and normalized output paths;
- refuse unsafe output targets;
- build the static snapshot;
- copy embedded WebApp assets;
- write deterministic JSON data files;
- write per-route HTML files;
- copy referenced workspace resources;
- write SEO and hosting support files;
- return a structured result containing route, page, view, asset, warning, and byte counts.

The command writes only to the requested output directory. It must never rewrite workspace sources.

### Static WebApp Adapter

Add a `StaticWorkspaceClient` implementation behind the existing `WorkspaceClient` contract.

It should:

- read generated local data instead of calling Forma RPC;
- preserve the existing dashboard, entry, references, taxonomy, and View route behavior;
- reuse extracted RPC mapping functions where the input shape is the same;
- fail with a clear static-artifact diagnostic when a required data file is absent;
- avoid shipping RPC fallback behavior in a static build.

The RPC client remains the normal `forma serve` adapter. Adapter selection must be explicit at build time and testable.

### Static Page Template

Add a small presentation-neutral page shell that owns:

- document title;
- meta description from configured summary data;
- canonical URL;
- Open Graph and Twitter metadata;
- stylesheet and module entrypoints;
- static body container;
- structured bootstrap identity for optional enhancement.

Do not create a second design system or duplicate the WebApp layout component tree in a templating layer. The static shell should be the smallest valid document that supports crawlability and enhancement.

## AI Coding Delivery Budget

The budget is measured in active AI Coding execution hours, including code generation, focused tests, repository checks, artifact inspection, and browser verification. It is not a traditional role-based person-day estimate.

It excludes waiting for:

- user review;
- DNS propagation;
- hosting-provider approval;
- external secret provisioning;
- CI queue time;
- release approval.

| Phase | Outcome | Target AI Coding hours |
| --- | --- | --: |
| 0. Contract and fixture | Freeze command, artifact, route, and acceptance contracts against a small fixture and this workspace | 1.5 |
| 1. Core static snapshot | One-pass batch export for workspace, entries, references, Views, and resource paths | 4.0 |
| 2. CLI and static data adapter | `forma site build`, deterministic JSON, embedded assets, `StaticWorkspaceClient`, no RPC | 4.0 |
| 3. Multi-page HTML and resources | Per-route HTML, static View fallbacks, raw asset copy/rewrite, direct-route support | 4.0 |
| 4. SEO and official-site composition | Homepage, canonical metadata, Open Graph, sitemap, robots, 404 | 2.5 |
| 5. CI deployment slice | Build artifact workflow, production deployment gate, same-commit evidence | 1.5 |
| 6. Validation, docs, and hardening | Automated tests, browser matrix, artifact audit, CLI docs, final checks | 2.5 |
| **Target total** | Productized static-site build and verified official-site artifact | **20.0** |
| **Contingency** | Renderer mismatch, asset edge cases, route collisions, hosting integration | **6.0** |
| **Maximum before re-plan** | Stop and review scope or architecture | **26.0** |

Expected checkpoints:

- after approximately 8 AI Coding hours: a static artifact can be generated and opened without a Forma server;
- after approximately 12 AI Coding hours: managed pages and Views have direct static routes;
- after approximately 16 AI Coding hours: the artifact is suitable for a first `forma.choral.io` preview;
- after approximately 20 AI Coding hours: productized command, tests, documentation, and deployment evidence are complete.

If the work reaches 26 active AI Coding hours without satisfying the Definition Of Done, stop and produce a variance report rather than silently extending the estimate.

## Delivery Phases

### Phase 0: Freeze The Contract

Work:

- create a compact static-site fixture with entries, references, one image, one taxonomy, one table View, one Graph View, and one unresolved-link diagnostic;
- record the expected output tree and stable routes;
- confirm the proposed CLI argument names;
- define the JSON build result;
- define which diagnostics fail the build and which remain warnings;
- record the existing current-workspace page and View counts as scale evidence.

Exit criteria:

- command and artifact contracts are reviewable;
- the fixture covers direct routes, resources, references, and Views;
- no `.forma` schema change or new dependency is required for the first slice.

### Phase 1: Build One Static Snapshot

Work:

- introduce a reusable Core site-snapshot module;
- load shared workspace state once;
- reuse discovery, index, reference, and View rendering results;
- render entry Markdown and semantic HTML without repeated workspace discovery;
- collect referenced resources without copying arbitrary files;
- serialize deterministic, versioned output types;
- add focused Core tests.

Exit criteria:

- the fixture snapshot is stable across two builds;
- this repository's 185 entries and 2 Views export successfully;
- local-only files and absolute paths do not appear in serialized output;
- build diagnostics identify the source route or entry involved.

### Phase 2: Generate A Serverless Static Artifact

Work:

- add `forma site build`;
- validate output paths and prevent unsafe broad writes;
- copy embedded WebApp assets to the output directory;
- write dashboard, entry, and View data;
- add and select `StaticWorkspaceClient`;
- keep `RpcWorkspaceClient` unchanged for `forma serve`;
- add CLI and TypeScript adapter tests.

Exit criteria:

- the artifact opens through a generic static server;
- browser network inspection shows no `/rpc` request;
- dashboard, taxonomy, entry, reference, search, and View data load from static files;
- a missing static data file produces a clear error;
- the source workspace remains unchanged.

### Phase 3: Generate Multi-Page HTML

Work:

- generate an `index.html` for every entry, taxonomy, term, and View route;
- include semantic entry HTML in the initial response;
- generate semantic list, table, kanban, and Graph fallbacks for View routes;
- make the WebApp enhance or replace the static body without breaking no-JavaScript reading;
- preserve heading ids, anchors, internal links, and direct-route refresh;
- copy referenced resources to stable `/raw/...` equivalents;
- generate a real 404 page.

Exit criteria:

- direct loading of representative deep routes returns the correct entry HTML;
- disabling JavaScript leaves entry bodies and ordinary navigation readable;
- enabling JavaScript restores enhanced rendering and client navigation;
- internal links, heading fragments, images, and configured logo assets resolve;
- no SPA redirect rule is required for a generated route.

### Phase 4: Add Official-Site Metadata And Composition

Work:

- use the configured `--home` entry as the homepage body;
- generate page titles and descriptions from workspace and entry summaries;
- generate canonical, Open Graph, and Twitter metadata;
- generate `sitemap.xml` from exported canonical routes;
- generate `robots.txt`;
- preserve the complete workspace in Browse, taxonomy, View, and Quick Open surfaces;
- verify that primary site navigation leads with Forma product and documentation context while project records remain reachable.

Exit criteria:

- homepage content comes from the managed Forma entry;
- every canonical content route has distinct title, description, and canonical URL;
- sitemap routes resolve in the generated artifact;
- source, installation, release, product, and documentation paths are discoverable from the homepage;
- no duplicate site-only product copy becomes a competing source of truth.

### Phase 5: Add CI And Production Deployment

Work:

- add a dedicated site build workflow or a clearly isolated site job;
- build from a clean checkout with locked dependencies;
- run Forma check and workspace health before static generation;
- build and inspect the static artifact;
- upload the artifact for review;
- deploy only the artifact built from the reviewed commit;
- verify the production URL and representative routes from the same commit;
- keep release publication and site deployment as separate gates unless a later decision intentionally couples them.

Exit criteria:

- CI fails on Forma errors, site-build errors, missing artifact files, or broken verification probes;
- production deployment records the source commit;
- homepage and representative direct routes return expected HTML;
- deployment does not require a long-running Forma process;
- DNS and hosting changes are reported as external state with explicit evidence.

### Phase 6: Productize And Close

Work:

- add product-facing CLI documentation;
- document static hosting behavior and JavaScript enhancement semantics;
- add a small non-project example workspace test;
- run the repository's Rust, pnpm, and Forma gates;
- validate light and dark themes and representative responsive widths;
- record artifact size, route count, build duration, and known limitations;
- decide whether a durable site-definition file is justified by observed use;
- create follow-up tasks only for accepted deferred scope.

Exit criteria:

- the command works for both the Choral Forma workspace and a neutral fixture;
- CLI and artifact contracts are documented;
- focused tests and required repository checks pass;
- browser console output is clean on representative routes;
- the generated artifact is reproducible and reviewable;
- no unapproved dependency, config schema, release, or task-board change is hidden in the implementation.

## Validation Matrix

### Core And CLI

- snapshot serialization is deterministic;
- route ids and output paths are normalized and collision-checked;
- unsafe output directories are rejected;
- repeated build behavior is defined and tested;
- shared-only loading excludes machine-local state;
- entry, reference, taxonomy, View, and resource counts are reported;
- build errors include structured diagnostics;
- generated output contains no absolute workspace paths;
- the workspace source tree is unchanged after build.

Suggested focused gates:

```sh
cargo test -p forma-core site_
cargo test -p forma-cli site_
pnpm exec vitest run packages/webapp/src/data
cargo run -q -p forma-cli -- check --json
cargo run -q -p forma-cli -- workspace health --json
```

Final gate:

```sh
mise run check
```

### Artifact

- home route;
- global page list;
- representative Product, Architecture, Task, Release, and Member entries;
- taxonomy index and term route;
- list/table/kanban View where configured;
- Graph View static fallback and interactive enhancement;
- internal Markdown link;
- wikilink fallback;
- heading fragment;
- backlink;
- image or media resource;
- source-code block;
- Mermaid;
- KaTeX;
- long table;
- 404 route;
- no-JavaScript content reading;
- no `/rpc` network call.

### Browser

Validate at approximately:

- 1440 px;
- 1024 px;
- 768 px;
- 390 px.

Validate both:

- `choral-light`;
- `choral-dark`.

Check:

- initial static content before enhancement;
- direct deep-link load;
- client navigation;
- browser back and forward;
- heading anchors;
- Quick Open;
- long titles and paths;
- local component overflow;
- page-root overflow;
- focus order and visible focus;
- console errors and warnings;
- reduced motion where applicable.

### Production

- `https://forma.choral.io/`;
- at least one deep entry route;
- at least one taxonomy route;
- at least one View route;
- `sitemap.xml`;
- `robots.txt`;
- `404.html`;
- canonical URL;
- Open Graph metadata;
- referenced static asset;
- source commit identity in deployment evidence.

## Commit And Review Checkpoints

Keep implementation reviewable around capability boundaries:

1. `feat: add static workspace site snapshot`
2. `feat: build static Forma site artifacts`
3. `feat: render crawlable static site routes`
4. `docs: document Forma static site builds`
5. `ci: deploy the Forma official site`

The exact split may change to preserve compilable commits, but dependency, generated-output, documentation, and deployment changes should not be mixed into one opaque commit.

Do not commit generated site output unless a later hosting decision explicitly requires repository-published artifacts. Prefer CI artifacts and deployment-provider storage.

## Risks And Controls

| Risk | Impact | Control |
| --- | --- | --- |
| Repeated `render_file` discovery for every entry | Slow or quadratic builds | Add a one-pass batch snapshot over one loaded workspace |
| Existing WebApp loads data in effects | Empty or skeleton-only generated HTML | Seed semantic Core HTML in every route before client enhancement |
| Rich browser renderer differs from Core HTML | Content flash or duplicate DOM | Define one enhancement boundary and validate before/after DOM |
| `/raw/...` assumes a live server | Broken images and workspace logo | Collect, copy, rewrite, and verify referenced resources |
| Browser router assumes SPA fallback | Direct routes fail on static hosts | Generate route directories with their own `index.html` |
| Site generator copies ignored or local files | Machine-local data enters artifact | Use shared managed entries and referenced-resource collection, not repository copy |
| All public records dominate navigation | Official site feels like an internal dashboard | Use hierarchy, homepage composition, labels, taxonomy ordering, and search rather than content hiding |
| Graph cannot be represented without JavaScript | Empty no-JavaScript View page | Generate a semantic node/link summary and hydrate the interactive Graph |
| New SSG dependency duplicates Forma semantics | Larger maintenance surface | Use Core HTML, existing WebApp assets, and small templates; do not add Astro in P0 |
| Deployment changes become coupled to releases | Site updates wait for binary releases | Keep site deployment as a separate same-commit gate |
| Scope expands into theming or CMS features | AI Coding budget loses meaning | Stop at the agreed feature contract and move deferred needs to follow-up proposals |

## Contingency Triggers

Use the six-hour contingency only for:

- Core HTML and browser-renderer compatibility defects;
- unresolved route collisions;
- resource discovery or path-rewrite edge cases;
- static Graph fallback complexity;
- hosting-provider integration differences;
- test fixture gaps discovered by the full current workspace.

Stop and re-plan instead of consuming contingency when the requested change becomes:

- a zero-JavaScript product requirement;
- a general theme marketplace;
- multiple independently configured sites from one workspace;
- versioned documentation;
- localized route negotiation;
- incremental or distributed builds;
- authenticated or partially private publication;
- a new content workflow or CMS;
- a change to editor-extension priority;
- a release or Marketplace publication.

## Deferred Scope

- multiple site targets;
- site themes or third-party themes;
- arbitrary template plugins;
- versioned documentation;
- RSS or Atom feeds;
- localized route negotiation;
- incremental builds;
- remote content loaders;
- authenticated content;
- draft workflow or publication approvals;
- user-defined `exclude`, `draft`, or `noindex` fields;
- deployment-provider-specific product APIs;
- a hosted editing or CMS surface;
- analytics;
- comments;
- server-side search.

The existing client-side Quick Open can provide initial search over the static dashboard data. A dedicated static search index should be added only if the 185-entry dogfood site demonstrates a measurable need.

## Definition Of Done

The feature is complete when:

- `forma site build` produces a deterministic static artifact from a neutral Forma workspace;
- the Choral Forma workspace exports all 185 current managed entries and configured Views without a live server;
- every exported canonical route has standalone crawlable HTML;
- entry content and ordinary navigation remain readable without JavaScript;
- enhanced Markdown, Mermaid, math, Graph, themes, search, and client navigation work with JavaScript;
- no browser request reaches `/rpc`;
- referenced resources resolve from the artifact;
- local-only files, absolute paths, credentials, caches, and arbitrary repository files are absent;
- homepage content is sourced from managed Forma knowledge;
- metadata, sitemap, robots, and 404 outputs are present and verified;
- focused tests and required repository gates pass;
- a clean CI checkout produces and verifies the artifact;
- `forma.choral.io` serves the reviewed artifact from the recorded source commit;
- documentation explains the command, hosting model, static HTML behavior, and enhancement boundary;
- actual active AI Coding time is reported against the 20-hour target and 26-hour re-plan ceiling;
- remaining limitations are explicit follow-up candidates rather than hidden incomplete work.

## Related Content

- [[product/product-direction]]
- [[product/choral-forma]]
- [[decisions/forma-p0-core-architecture]]
- [[decisions/editor-extension-primary-product-surface]]
- [[architecture/webapp-v2-read-model-contract]]
- [[architecture/webapp-v2-package-architecture]]
- [[design/webapp-review-surface-design]]
