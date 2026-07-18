---
scope: project
type: execution-plan
title: Taxonomy Term Presentation And Graph Color Execution Plan
summary: Add taxonomy-neutral icon and color metadata, expose generic Page memberships, and reuse the presentation consistently in Explorer and Graph surfaces.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - planning
    - taxonomy
    - terms
    - graph
    - vscode
    - webapp
    - presentation
sources:
    - "decisions/use-settings-driven-taxonomy-and-navigation-model"
    - "architecture/forma-core-technical-direction"
    - "architecture/editor-extension-adapter-contract"
    - "discovery/editor-graph-view-technical-research-2026-07-17"
    - "tasks/generalize-taxonomy-neutral-page-model"
    - "tasks/design-editor-graph-view-renderer"
    - "tasks/implement-shared-graph-view-runtime"
    - "tasks/migrate-webapp-to-shared-graph-view"
    - "tasks/integrate-shared-graph-view-vscode-preview"
    - "tasks/validate-shared-graph-view-cross-host-parity"
---

# Taxonomy Term Presentation And Graph Color Execution Plan

## Objective

Let workspace authors give configured taxonomies and terms a portable icon and main color, then use the same metadata in the VS Code Forma Panel, WebApp navigation, Graph legends, and Graph nodes without introducing a built-in taxonomy or a special path for any taxonomy id.

The implementation must first expose generic Page membership. It must not color Graph nodes from the compatibility `GraphRenderNode.space` field or treat a taxonomy named `spaces` as a default, fallback, primary product concept, or privileged partition.

## Confirmed Decisions

- Forma has no built-in taxonomy. `spaces`, `areas`, `topics`, and similar values are ordinary author-defined taxonomy ids.
- All configured taxonomies use the same Core, RPC, Explorer, View, and presentation contracts.
- `display.icon` and `display.color` are reusable presentation metadata, not Graph-only settings.
- Term presentation may be reused by the VS Code Forma Panel, WebApp navigation, Graph nodes, legends, filters, Quick Open, and later Host surfaces.
- Graph coloring is opt-in through the Graph View definition. No taxonomy is selected implicitly.
- Selection does not replace a node's classification color. Selection uses non-color signals such as outline, halo, size, z-index, and connecting-edge emphasis.
- A Page matching several terms in a `mode: multiple` taxonomy has no implicit first or preferred term.
- The first icon implementation uses a finite Forma icon registry backed by a deliberately selected Lucide subset. It does not bundle all Lucide icons or execute workspace-provided SVG.
- The first color implementation accepts one portable main color. Hosts derive secondary states and may replace the configured color in high-contrast or inaccessible contexts.
- WebApp and editor extensions consume the same semantic projection and presentation rules. Host adapters only resolve concrete theme tokens, icon assets, navigation, storage, and lifecycle behavior.

## Current Baseline

- Core, shared TypeScript, RPC, and WebApp `DisplayOptions` currently expose only `order`.
- Taxonomy and term Explorer results already carry `display`, so extending that existing contract is sufficient; a parallel icon or color configuration path is unnecessary.
- VS Code currently assigns `tags` to every taxonomy and `folder` to every healthy term. Failed terms use `triangle-alert`.
- The shared Graph runtime accepts `id`, `path`, `title`, `kind`, and semantic edges. It intentionally ignores `GraphRenderNode.space`.
- Core can load generic taxonomy and term definitions, but generic Page membership does not yet flow through Index, View rendering, RPC, and Graph projection.
- The WebApp now consumes `packages/graph-view` through a thin Host adapter, so classification styling belongs in the shared package rather than the React route.

## Proposed Configuration Contract

Presentation metadata belongs on any displayable configuration node. The first consumer cutline is taxonomy and term definitions.

```yaml
---
schemaVersion: 1
kind: taxonomy
id: areas
title: Areas
mode: primary
display:
    order: 10
    icon: panels-top-left
    color: "#64748b"
---
```

```yaml
---
schemaVersion: 1
kind: term
taxonomy: areas
title: Tasks
display:
    order: 70
    icon: list-checks
    color: "#4f7cac"
include:
    - tasks/**/*.md
---
```

First-cut validation rules:

- `icon` is an optional Forma icon id from the documented registry.
- The registry is provider-neutral even when its first assets are selected from Lucide.
- Unknown icon ids produce a configuration diagnostic and fall back to the Host's generic taxonomy or term icon.
- `color` is an optional canonical `#RRGGBB` value.
- CSS names, CSS variables, URLs, gradients, alpha values, and arbitrary SVG are not accepted in the first cut.
- Invalid decorative values do not prevent Page discovery. They produce a diagnostic and use a safe fallback.
- A later contract may add explicit light and dark variants only if real Host validation shows that one main color is insufficient.

## Taxonomy-Neutral Page Facets

Graph and other consumers require a generic membership projection rather than a renamed `space` field. The target shape is conceptually:

```ts
type PageFacets = {
    taxonomies: Readonly<Record<string, readonly string[]>>;
};
```

The exact Rust and RPC representation may differ, but it must preserve these semantics:

- keys are configured taxonomy ids;
- values are configured term ids matched by the Page;
- `mode: primary` validates at most one matching term within that taxonomy;
- `mode: multiple` preserves every matching term without hidden ordering or precedence;
- a Page can belong to terms in several taxonomies;
- an equivalent taxonomy with a different id produces equivalent behavior;
- discovery and membership do not infer meaning from directory names or a taxonomy id;
- membership is computed once in Core from compiled include matchers and reused by downstream projections.

This slice is owned by [[tasks/generalize-taxonomy-neutral-page-model]]. Graph integration must wait for this facet contract rather than extending the compatibility `space` projection.

## Graph View Contract

The first taxonomy-driven color mapping is explicit and renderer-neutral:

```yaml
graph:
    presentation:
        nodes:
            colorBy:
                taxonomy: areas
```

Rules:

- `taxonomy` may name any configured taxonomy.
- Omitting `colorBy` preserves neutral node colors.
- A missing taxonomy is a View configuration diagnostic, not an implicit fallback.
- A Page with one matching term uses that term's configured main color.
- A term without a configured color uses its taxonomy's configured main color, then falls back to the Host-neutral node color. Forma does not synthesize a rainbow palette.
- A Page without a matching term uses a neutral `Unclassified` role represented in the legend.
- For `mode: multiple`, the first cut uses a neutral multi-membership role unless the View defines explicit ordered groups. It never chooses the first term silently.
- Explicit future View groups override Term presentation because View-local analytical meaning is narrower than workspace-wide Term identity.

The shared Graph runtime owns normalized color-role selection, legend items, selection overlays, muted opacity, and accessible summaries. WebApp and VS Code adapters map Host colors into the shared semantic palette but do not implement their own classification reducers.

## VS Code Forma Panel Behavior

Taxonomy and term nodes consume their configured presentation through the existing Explorer result:

```text
error or warning status
-> configured display.icon and display.color
-> Host generic icon and theme color
```

- Taxonomy nodes use their configured icon and color when valid.
- Healthy Term nodes use their configured icon and color when valid.
- Failed Term nodes keep the diagnostic icon and status treatment so decorative metadata cannot hide an error.
- Entry nodes remain normal Markdown source entries. They do not inherit one Term icon because a Page can belong to several taxonomies and terms.
- View nodes retain their kind-based icons in this cutline; configured View presentation is a separate consumer decision.
- High-contrast themes may replace configured colors with a theme-safe monochrome icon while preserving the configured icon shape.
- Unknown icons and invalid colors fall back without preventing the tree from loading.

VS Code does not allow an arbitrary runtime hex value to become a dynamic contributed `ThemeColor`. The adapter therefore uses sanitized SVG assets from the finite icon registry and caches colorized variants in Extension Host storage. The cache key includes icon id, normalized color, and presentation mode. Remote Extension Hosts write through VS Code storage URIs and never assume a local-machine path.

## Delivery Sequence

### Iteration 0: Freeze Contracts And Fixtures

- Add contract tests proving that differently named but equivalent taxonomies produce equivalent config, Explorer, membership, and presentation output.
- Add primary, multiple, unclassified, invalid-color, unknown-icon, light, dark, and high-contrast fixtures.
- Finalize the portable icon registry and the first `#RRGGBB` color grammar.
- Record the exact Page facet and `graph.presentation.nodes.colorBy.taxonomy` schema before changing consumers.

Exit criteria:

- No fixture or expected result requires a taxonomy id named `spaces`.
- Invalid presentation values have explicit diagnostic and fallback behavior.
- The schema leaves room for query-defined groups without making them part of this cutline.

### Iteration 1: Extend Generic Display Metadata

- Add `icon` and `color` to Core `DisplayOptions` and its empty-state logic.
- Propagate them through config inspection, dashboard, Explorer, shared TypeScript, RPC, and WebApp data contracts.
- Add validation and serialization tests.
- Update product documentation with the icon registry, color grammar, fallback behavior, and examples using neutral taxonomy ids.
- Update example taxonomy and term definitions only after the contract tests pass.

Quick evaluation:

- Compare config-inspect and Explorer output before and after on the project workspace and the software-product R&D example.
- Confirm the payload delta is bounded to two optional scalar fields per displayed definition.
- Confirm workspaces without the new fields serialize and render unchanged.

### Iteration 2: Apply Presentation In Forma Panels

- Make the VS Code Forma Panel resolve configured taxonomy and term icons from the finite registry.
- Generate and cache sanitized colorized icon variants without bundling all Lucide assets.
- Preserve diagnostic icon precedence, high-contrast fallback, Remote storage behavior, and cleanup.
- Apply the same taxonomy and term presentation to WebApp navigation where the surface supports icons or color indicators.
- Keep entry nodes and View kind icons unchanged.

Quick evaluation:

- Verify local and Remote-style storage URIs.
- Verify reload, theme switch, high contrast, invalid metadata, missing cache, and extension disposal.
- Record VSIX and WebApp bundle deltas; unexplained growth requires review.

### Iteration 3: Deliver Taxonomy-Neutral Page Membership

- Execute the focused Page-membership slice of [[tasks/generalize-taxonomy-neutral-page-model]].
- Discover Pages and memberships from generic taxonomy term definitions.
- Replace or supersede `IndexEntry.space` and `GraphRenderNode.space` with taxonomy-neutral facets.
- Propagate facets through CLI, RPC, shared TypeScript, WebApp, and editor adapters.
- Preserve `primary` and `multiple` validation without naming or selecting a globally primary taxonomy.
- Remove consumer branches that inspect a configured taxonomy id for product behavior.

Quick evaluation:

- Run equivalence fixtures with renamed taxonomies.
- Measure discovery and projection cost at 100, 1,000, and 5,000 Pages.
- Confirm membership uses compiled matchers and does not add per-render file scans.

Stop condition:

- Do not ship a partial Graph-only facet computed from `space`. If generic discovery or membership semantics remain unresolved, stop before Graph coloring.

### Iteration 4: Add Shared Graph Coloring And Legend

- Parse and validate `graph.presentation.nodes.colorBy.taxonomy` in Core.
- Include the selected taxonomy definition, term presentation, and Page facets in the Graph projection.
- Extend `packages/graph-view` with normalized classification roles and deterministic legend items.
- Keep Term fill colors during selection; express selection and one-hop focus with outline, halo, size, opacity, z-index, and edge emphasis.
- Keep the Graph runtime, camera, and selected node alive across Light, Dark, System, and Host theme changes; theme updates must not tear down the renderer.
- Derive default, muted, neighbor, selected, edge, label, hover-surface, and focus-ring roles from Host theme tokens through the shared runtime contract.
- Replace Sigma's fixed white hover-label surface with the shared `surface`, `label`, `border`, and `focusRing` roles.
- When a node is selected, animate only its one-hop edges to reinforce reference direction: one-way edges flow from source to target and bidirectional edges flow both ways. Static arrowheads remain authoritative. Reduced-motion disables the animation, dense selections above the supported edge limit skip it, and a short finite pulse replaces an indefinite animation loop.
- Render the same legend, unclassified role, and accessible text summary in WebApp and VS Code Preview.
- Preserve neutral rendering for Graph Views without `colorBy`.

Quick evaluation:

- Validate the software-product R&D example using an explicitly configured taxonomy.
- Compare light, dark, high contrast, selected, neighbor, muted, unclassified, and multiple-membership states.
- Switch repeatedly between Light and Dark with a node selected; the Graph, selection, labels, and camera remain visible and stable.
- Confirm Dark mode selected labels meet readable foreground/background contrast and muted nodes and edges remain visible without competing with the selected neighborhood.
- Confirm selected-edge direction animation agrees with static arrowheads, stops after selection clears, and is absent under reduced motion.
- Confirm the custom animation Canvas uses the same logical CSS dimensions and DPR-scaled backing dimensions as Sigma's native edge Canvas so particles remain aligned at non-1x display scaling.
- Confirm Graph search and the accessible companion list expose the same Term labels as the visual legend.

### Iteration 5: Cross-Host Validation And Cleanup

- Run the shared 25-, 500-, and 5,000-node Graph fixtures in WebApp and packaged VSIX Preview.
- Validate taxonomy rename equivalence, theme changes, Preview reload, extension restart, Remote assets, reduced motion, and runtime disposal.
- Measure projection bytes, first meaningful render, layout settle time, interaction responsiveness, bundle delta, VSIX delta, retained memory, and idle CPU.
- Remove remaining Host-local classification logic and compatibility fields made obsolete by the facet migration.
- Record final evidence in the relevant tasks and [[tasks/validate-shared-graph-view-cross-host-parity]].

## Accessibility And Theme Rules

- Color is never the only signal for selection, errors, relationship direction, or multi-membership.
- Every Graph color has a text legend entry and appears in the accessible companion surface.
- Configured colors do not alter editor text color in the VS Code tree.
- High-contrast Host modes may override configured color while keeping icon shape and text identity.
- Unknown or inaccessible presentation values fall back predictably and remain inspectable through diagnostics.
- Term identity colors remain stable across refreshes when configuration and Host theme are unchanged.

## Performance And Packaging Rules

- Compute Page membership in Core once per discovery snapshot; do not re-evaluate taxonomy globs in every Host or Graph render.
- Send compact taxonomy and term ids rather than duplicating full definitions on every node.
- Resolve term presentation through a projection-level dictionary.
- Use static icon registry imports or assets so WebApp tree shaking and VSIX packaging include only the supported subset.
- Bound generated VS Code icon variants by content-addressed cache keys and reuse them across refreshes.
- Run no continuous work after Graph layout settling or Panel rendering.
- Treat a material regression in discovery, Graph projection size, WebApp chunk size, VSIX size, retained memory, or idle CPU as a stop-and-review condition.

## Suggested Task And Commit Boundaries

The execution can reuse existing Graph and taxonomy tasks, but implementation should be split at these reviewable boundaries:

1. Contract slice under [[tasks/generalize-taxonomy-neutral-page-model]]: generic display metadata and Page facet design.
2. Core/RPC slice: `feat: add taxonomy-neutral display metadata`.
3. Documentation and fixtures: `docs: define taxonomy and term presentation`.
4. VS Code Panel slice: `feat: apply configured taxonomy presentation in vscode`.
5. WebApp navigation slice: `feat: apply configured taxonomy presentation in webapp`.
6. Page-membership slice: `refactor: expose taxonomy-neutral page facets`.
7. Graph contract slice: `feat: add taxonomy-driven graph coloring`.
8. Cross-Host validation: `test: validate taxonomy presentation across hosts`.
9. Compatibility cleanup: `refactor: remove space-specific presentation paths`.

Do not combine the Page-model migration, Panel presentation, Graph behavior, and compatibility cleanup into one unreviewable repository-wide change.

## Execution Status 2026-07-18

- Iterations 0-2 are complete for the first taxonomy and term `display.icon/color` cut: Core validation and diagnostics, RPC and CLI contracts, shared TypeScript definitions, example fixtures, and VS Code Forma Panel presentation are covered.
- The VS Code icon implementation packages only the finite registry, caches generated color variants through Remote-safe storage URIs, bounds both memory and disk caches, and preserves diagnostic and high-contrast precedence.
- The shared Graph runtime now derives theme roles from Host tokens, preserves the renderer, camera, and selection across theme changes, and uses themed hover and selected-node surfaces.
- Selected-edge direction uses one finite 1.8-second eased Canvas pulse with staggered particles, skips selections above 64 emphasized edges, respects reduced motion, and runs no continuous idle loop. Static arrowheads use enlarged native Sigma proportions for persistent direction readability. The animation Canvas is explicitly synchronized with Sigma's CSS and DPR dimensions; this was verified at 2x DPR against the real WebApp.
- Iteration 3 remains intentionally bounded because [[tasks/generalize-taxonomy-neutral-page-model]] is still `needs-refinement`. Graph nodes are not colored from the compatibility `space` field, and no taxonomy id is treated as primary.
- A focused generic membership facet is now computed once for every currently indexed Page from all configured taxonomy term include patterns. View taxonomy filters and Graph coloring consume this facet without inspecting a taxonomy id. Full taxonomy-neutral Page discovery, schema composition, create identity, and compatibility-field removal remain in [[tasks/generalize-taxonomy-neutral-page-model]].
- Taxonomy-driven Graph coloring now uses explicit `graph.presentation.nodes.colorBy.taxonomy`, carries a projection legend, preserves configured fill during selection, and falls back from Term color to Taxonomy color to Host neutral. Unclassified and multi-term Pages remain neutral.
- Shared node sizing now uses incoming and outgoing semantic reference count rather than only unique adjacency, with a stronger bounded logarithmic scale. One-hop focus continues to use unique adjacent Pages.
- The 2026-07-18 quick performance gate reports a 1,000-entry `view.render` median of 71.8 ms and p95 of 72.6 ms after generic membership was added. The WebApp Graph chunk is 204.42 kB / 51.31 kB gzip, a bounded increase of 1.89 kB / 0.49 kB gzip from the previous Graph milestone.
- Iteration 5 cross-Host scale validation remains follow-up work; VS Code Graph Preview is still deferred in the current extension surface.

## Complete Local Validation Gate

- `mise run check:rust`
- `mise run test:rust`
- `mise run check:pnpm`
- `mise run test:pnpm`
- `mise run build:pnpm`
- focused config, Explorer, Graph runtime, WebApp adapter, and VS Code Panel tests
- packaged VSIX smoke with local and Remote-style asset resolution
- real WebApp and installed VS Code visual validation in light, dark, and high contrast
- taxonomy rename equivalence fixtures
- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`

## Stop Conditions

Stop and revise the affected iteration when:

- any implementation branches on `taxonomy == "spaces"` or treats `space` as a fallback membership;
- a Page in several terms receives an arbitrary first-term color or icon;
- Graph coloring is implemented in a Host adapter rather than `packages/graph-view`;
- workspace-provided SVG, URL, CSS, or executable content reaches an icon renderer;
- configured color hides a diagnostic or becomes the only selection signal;
- high-contrast mode becomes unreadable;
- a theme change removes the Graph canvas, loses selection, or makes labels, muted nodes, or muted edges indistinguishable from the background;
- selected-edge animation disagrees with edge direction, runs while no node is active, or ignores reduced-motion;
- icon support requires bundling the complete Lucide package;
- Remote VS Code resolves an icon through a local-machine-only path;
- a Graph View without `colorBy` changes visual meaning unexpectedly;
- membership or presentation adds repeated scans, unbounded cache growth, continuous idle work, or an unexplained package-size regression.

## Completion Evidence

- Equivalent taxonomies behave identically regardless of id.
- Taxonomy and Term `display.icon/color` survive config, RPC, Explorer, and Host adapters.
- VS Code Forma Panel and WebApp navigation show configured presentation with safe fallbacks.
- Graph Views opt into an arbitrary configured taxonomy and display stable Term colors plus an accessible legend.
- Selection and one-hop emphasis remain legible without replacing classification colors.
- `mode: multiple`, unclassified, invalid metadata, theme, high-contrast, Remote, reload, and disposal behavior are covered.
- Performance and package deltas are recorded against the same fixtures and candidate commit.
- No production behavior reserves or privileges a taxonomy named `spaces`.
