---
scope: project
type: technical-assessment
title: Editor Graph View Technical Research — 2026-07-17
summary: Assesses 2D and 3D graph references and defines an extensible, configurable, editor-native Graph View direction for Forma.
owners:
    - "members/tiscs"
tags:
    - discovery
    - graph
    - vscode
    - views
    - performance
    - accessibility
sources:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-view-query-model"
    - "design/editor-extension-mvp-design"
    - "tasks/design-editor-graph-view-renderer"
    - "tasks/generalize-taxonomy-neutral-page-model"
---

# Editor Graph View Technical Research — 2026-07-17

## Outcome

Forma should keep Graph as a normal configured View and implement it as an enhancement of the editor's native Markdown Preview. Sigma.js plus Graphology is the accepted 2D production direction. The implementation spike should now concentrate on interaction, relationship-driven layout, styling, refresh stability, theme integration, accessibility, and performance instead of building a second full renderer prototype by default.

Forma already carries Sigma and Graphology in the WebApp, Sigma provides a WebGL path for larger graphs, and Graphology supplies worker-based ForceAtlas2. The present WebApp's fixed-circle layout is the primary visual limitation; it is not evidence that Sigma itself is unsuitable. Foam's `force-graph` approach remains a reference and fallback only if the Sigma spike fails an accepted requirement.

The first production Graph remains 2D. A 3D Graph is technically feasible and may later become an opt-in, lazily loaded renderer over the same projection and interaction state, but it should not block or inflate the first useful editor Graph.

Do not share the current React route component. Extract a host-neutral graph component only after the spike establishes its boundary. That component should consume a renderer-independent projection, semantic `--forma-*` theme tokens, and callbacks for selection and navigation. It must not import VS Code, React Router, or the WebApp theme context.

Production integration is sequenced behind the taxonomy-neutral Page contract. The current `GraphRenderNode.space` field and space-color hash contradict the accepted rule that every configured taxonomy is equal. A spike may translate the current fixture at its boundary, but it must not add another production dependency on `space` or reserve any taxonomy id.

## Accepted Product Decisions — 2026-07-17

- Single click selects a node; it does not immediately navigate away.
- Selection persists and emphasizes the selected node, its directly connected nodes, and their connecting edges. Unrelated elements are de-emphasized without disappearing.
- The Graph follows the active managed document by selecting and centering its node when that node belongs to the View projection.
- If there is no applicable active managed document, the initial fallback is no selection plus automatic fit-to-graph. This assumption should be changed if product validation identifies a better automatic anchor.
- Source opening remains a separate activation, such as double click, Enter, or the details surface.
- Directed edges use arrows. A single reference shows one direction; reciprocal references must visibly show both directions, using two curved edges or an equally unambiguous bidirectional treatment.
- Node appearance must support meaningful variation in size, fill color, outline, icon or shape, and label density. These are semantic, renderer-neutral style channels, not hard-coded taxonomies.
- Groups and filters will be defined by the Graph View's frontmatter and reuse Forma's query model. They are important but may follow the selection, active-document, direction, and styling baseline.

## Current Forma Baseline

The existing implementation already proves several useful contracts:

- `view.render` derives nodes and configured edges in Forma Core.
- body links, embeds, and schema-declared field references can become labeled edges.
- clients receive paths, titles, edge intent, source, field, semantic type, and fragments without rescanning Markdown.
- the WebApp keeps Sigma.js and Graphology behind a client renderer boundary.
- the VS Code extension enhances native Markdown Preview for list, table, and kanban Views.

The current WebApp renderer is intentionally not the editor baseline:

- every graph is placed on a fixed circle regardless of topology;
- color is derived from the legacy singular `space` field;
- focus exists only while hovering, so context disappears when the pointer leaves;
- search, filters, local depth, and stable user selection are absent;
- the canvas has a companion list, but no complete graph-oriented keyboard and details workflow;
- position stability is accidental because placement follows node order rather than a persisted or incrementally settled layout.

These are layout, state-model, contract, and interaction problems. Replacing the drawing library alone would not solve them.

## Product Reference Findings

### Foam

Foam's current Graph implementation is a useful architecture reference:

- Graph is extracted as `@foam/graph-view`, a Lit Web Component bundled into the VS Code extension WebView.
- the extension host and renderer communicate through a VS Code-free protocol.
- `force-graph` and `d3-force` provide the force-directed canvas.
- selection can persist, multiple nodes can be selected, and the graph can center on the active note.
- full and depth-limited scopes use the same renderer.
- controls expose labels, node and link size, link animation, collision, repulsion, link force, velocity decay, neighbor depth, centering, and zoom behavior.
- groups can match type, path, tags, title, or custom properties; named views provide saved defaults.

The pieces worth adopting are the host-neutral component boundary, explicit protocol, persistent selection, depth-limited focus, and layered configuration. Forma should not copy Foam's built-in node types or directory/type coloring as product primitives because Forma classification is configuration-driven.

### Obsidian

Obsidian is a product-behavior reference rather than an implementation reference because its Graph implementation is not open source. Its official behavior demonstrates a compact and learnable control model:

- filters control search results, tags, attachments, missing targets, and orphans;
- query-based groups assign colors;
- display controls cover arrows, label fade, node size, link thickness, and animation;
- force controls cover center, repel, link force, and link distance;
- the local graph reuses the same settings and adds a depth control;
- nodes support hover focus, opening, context actions, zoom, pan, and keyboard viewport movement.

Forma should adopt the separation between Filters, Groups, Display, and Forces. It should model global and local graph as two scopes over the same configured View, not as separate built-in product surfaces. A View whose source includes all managed Pages is the global case; local depth is a temporary exploration state anchored to a selected or active Page.

## Editor Host Integration

VS Code officially supports `markdown.previewScripts` for advanced behavior inside the built-in Markdown Preview, and reloads contributed scripts on every content change. This gives Forma a route to an interactive Graph without creating a second preview command or a separate custom-editor surface.

The proposed preview pipeline is:

```text
Graph View Markdown
  -> Forma Core view.render projection
  -> Markdown-it emits graph mount, inert projection data, and accessible fallback links
  -> extension-bundled markdown.previewScripts hydrates the mount
  -> host-neutral graph component renders and interacts
  -> node activation delegates to the corresponding native preview link
```

The preview script must be idempotent. Each reload disposes the previous renderer, observers, workers, and event listeners before hydrating the new projection. It must execute only extension-bundled code, never evaluate workspace content, and treat all titles, labels, paths, and fields as data.

Node navigation should reuse native Markdown Preview link behavior through companion links rather than introducing another file-opening protocol. Source mode remains the normal Markdown editor, and Preview remains the normal editor Preview command.

## Renderer Comparison

| Approach | Strengths | Risks | Spike decision |
| --- | --- | --- | --- |
| Sigma.js + Graphology + ForceAtlas2 worker | Existing Forma dependency and experience; WebGL renderer; Graphology algorithms and metrics; worker layout; good headroom for thousands of elements | custom rendering is harder; canvas/WebGL needs a parallel accessible surface; layout and state must be designed explicitly | Accepted 2D direction |
| `force-graph` + D3 force | Proven by Foam; fast route to an organic graph; force and interaction controls are straightforward; framework-neutral | live simulation can move excessively; stable refresh needs coordinate reuse and bounded settling; canvas still needs accessible companions | Reference and fallback; do not build a full comparison unless Sigma misses a requirement |
| Cytoscape.js plus layout extensions | Rich renderer-independent layout ecosystem, including force and hierarchical layouts; strong selector and interaction model | larger conceptual and dependency surface; layout extensions add maintenance; no current Forma reuse | Reserve candidate if the first two cannot meet hierarchical or interaction requirements |
| `3d-force-graph` plus Three.js | Established WebGL 3D implementation; directional arrows and particles; focus, highlighting, custom node geometry, and dynamic data examples | separate dependency and camera model; label occlusion; higher GPU, memory, accessibility, testing, and bundle costs | Later opt-in 3D experiment, never the first-release default |
| Custom D3 SVG or Canvas | Maximum visual control; SVG can expose more DOM semantics for small graphs | highest implementation and maintenance cost; SVG density ceiling; repeats interaction, spatial index, and rendering work | Reject for first production implementation |

The renderer is not the layout. The spike must keep layout, graph state, and host integration behind interfaces so a renderer change does not alter the View or RPC contract.

## Recommended Component Boundary

After the spike, create a small host-neutral package only if both VS Code and the maintenance WebApp can consume the same boundary without adapter leakage. A likely package is `packages/graph-view`, containing:

- renderer-independent graph projection types;
- layout-engine and renderer adapters;
- selection, focus, filtering, and visible-subgraph state;
- semantic theme-token resolution;
- the graph component and accessible details/list surface;
- deterministic fixture and benchmark helpers.

Host adapters remain responsible for:

- obtaining `view.render` output;
- encoding the projection into Preview;
- mapping source-navigation callbacks to native editor links;
- reading and storing editor-local state;
- translating host theme values into `--forma-*` tokens;
- workspace trust, diagnostics, and lifecycle.

The first package should not expose the underlying Sigma, Graphology, or `force-graph` object as its public API. Renderer-specific escape hatches would make later replacement and cross-editor reuse harder.

The renderer boundary should accept the same selection, visible-subgraph, styling, direction, camera, and navigation state whether the implementation is Sigma 2D or a later 3D renderer. This preserves the option to add 3D without turning it into a second Graph product.

## Layout And Refresh Model

The first production layout should be relationship-driven and stable:

1. derive deterministic initial coordinates from stable node ids;
2. reuse cached coordinates for nodes that survived a refresh;
3. seed new nodes near the centroid of known neighbors, or deterministically when isolated;
4. settle in a Web Worker for a bounded iteration or convergence budget;
5. stop motion after settling and immediately stop it when reduced motion is active;
6. retain user-pinned coordinates in editor workspace state, never in Markdown.

ForceAtlas2 supports worker execution and Barnes-Hut optimization. For very small graphs, the spike should also test Graphology's simpler force layout because its documentation notes that it can produce more organic interactive motion for small networks.

The first release does not need a user-selectable layout catalog. The architecture should leave room for a later hierarchical adapter, but shipping force and hierarchy simultaneously would expand configuration and test cost before the primary exploration behavior is validated.

## Configuration And State Ownership

Forma needs three state layers:

| Layer | Examples | Storage |
| --- | --- | --- |
| Shared View meaning | source/query, edge rules, optional group definitions, default presentation policy | View Markdown |
| User/editor preference | default label density, preferred motion behavior beyond OS settings, optional per-host overrides | editor settings or extension storage |
| Exploration state | viewport, temporary filters, selected node, local depth, adjusted or pinned coordinates, force-panel experiments | editor workspace state or transient memory |

The View file should remain readable and avoid mirroring every renderer knob. A future minimal presentation block can follow this shape after the spike validates the names:

```yaml
graph:
    edges:
        - source: body
          intent: link
          label: links to
    presentation:
        layout: force
        labels: adaptive
        arrows: directed
        nodes:
            sizeBy: degree
            colorBy: group
        groups:
            - id: active-work
              label: Active work
              query:
                  field: fields.status
                  op: in
                  value: [ready, active]
              color: accent
        filters:
            - id: active-only
              label: Active only
              query:
                  field: fields.status
                  op: in
                  value: [ready, active]
```

This shape is illustrative rather than a committed schema. Group and filter queries must reuse Forma's query model and may target any configured taxonomy or Page field. Their shared definitions belong in the Graph View frontmatter; temporary enablement remains exploration state. No default may assume a taxonomy named `spaces`, and one taxonomy must not receive a privileged color or filter path.

Node size and color mappings should be configurable independently. The baseline can provide neutral automatic choices such as degree-based size and a theme accent for selection, while explicit View mappings can later target query-defined groups, configured taxonomy memberships, or numeric Page fields. Shape, icon, outline, and text labels must remain available as non-color signals.

Force sliders are initially exploratory UI state. Promote a force parameter to the View schema only after evidence shows that authors need a shared default rather than a personal tuning control.

## Required Graph Contract Change

`GraphRenderNode` currently exposes `space: string`. Before production integration, replace or supersede it with taxonomy-neutral facets derived from the accepted Page model. The renderer needs enough neutral data to support:

- title and source path;
- document kind when it is meaningful;
- configured taxonomy and term memberships;
- selected display fields used by group queries or labels;
- degree or other derived metrics, preferably computed client-side unless Core semantics are required.

The exact facet shape belongs to [[tasks/generalize-taxonomy-neutral-page-model]]. Graph must consume that result rather than designing a parallel Page classification contract.

## Interaction Baseline

The first usable Graph should include:

- pan, zoom, fit, and reset;
- title/path search with a result list;
- persistent single-click selection and one-hop node and edge emphasis;
- active managed-document following, with no-selection fit-to-graph fallback;
- separate source activation from double click, Enter, and the details surface;
- visible directed and reciprocal relationship encoding;
- configurable renderer-neutral node size and color channels;
- local depth from the current selection;
- adaptive labels and focused edge labels;
- empty, invalid, and unresolved-target states;
- a reset action for temporary graph state.

Frontmatter-defined group and filter controls, multi-selection, time-lapse animation, user-defined force presets, arbitrary context actions, and editable relationships can follow later evidence. They should not block the first useful release. The first projection and renderer boundary must nevertheless preserve generic Page facets so adding groups and filters does not require another data-contract rewrite.

## 3D Graph Assessment

3D graph products and implementation libraries are mature enough to make a later Forma experiment credible:

| Reference | Relevant evidence for Forma |
| --- | --- |
| GraphXR | Uses one project workspace for 2D and 3D, with a direct toggle; supports property/category legends, filters, neighbor and directed parent/child selection, property-driven node size, and relationship styling. This is the strongest reference for keeping dimensions, selection, styling, and filtering in one product model. |
| Graphia | Supports interactive layout in 2D or 3D, attribute search and filtering, graph metrics, clustering, and large datasets. It demonstrates that 3D can coexist with analysis rather than being only a visual effect. |
| myReach | Offers a 3D Visualiser as a knowledge-base View for discovering hubs and connected context. It is a close product analogy, although its presentation is more exploratory than editor-navigation focused. |
| `3d-force-graph` | Provides a Three.js/WebGL renderer with directional arrows, node focus, highlighting, custom appearance, dynamic data, fit, and large-graph examples. It establishes implementation feasibility but would be a separate renderer and dependency stack from Sigma. |

The product case is mixed. Research on immersive network visualization found better structural interpretation for larger networks, but 2D performed better for spatial-memory tasks. That supports 3D as an optional exploration mode rather than the default for precise, repetitive document navigation.

If Forma pursues 3D, use these constraints:

- preserve one `GraphProjection`, selection model, group/filter model, style channels, and source-navigation behavior across 2D and 3D;
- lazy-load the 3D renderer and Three.js dependency only after the user selects 3D;
- keep 2D as the default and guaranteed fallback, including for reduced motion, unsupported WebGL, remote environments, and accessibility needs;
- map active-document following and one-hop emphasis identically in both dimensions;
- require an accessible synchronized DOM details/list surface because the 3D canvas itself is not an interaction tree;
- benchmark bundle delta, GPU and CPU use, retained memory, camera usability, label occlusion, and disposal on the same 500- and 5,000-node fixtures;
- do not commit a shared frontmatter setting for 3D until the experiment shows that View authors need a shared default. Begin with an editor-local experimental toggle.

3D should therefore be recorded as a later optional renderer spike after the 2D Sigma baseline is useful and stable. It is not part of the first production Graph acceptance criteria.

## Theme And Accessibility

The graph must consume the same semantic `--forma-*` tokens as other View renderers and respond to light, dark, high-contrast, and live theme changes. Graph groups should use editor chart colors only as defaults; user-defined colors need contrast checks and a non-color indicator.

Canvas or WebGL output is not an accessible interaction tree. The component therefore needs a synchronized DOM surface containing:

- searchable nodes;
- selected-node title, path, facets, and source action;
- incoming and outgoing neighbor lists with edge labels;
- visible focus and keyboard navigation;
- a text summary of active filters and graph size.

Reduced-motion mode renders settled coordinates without an animated simulation. Color must not be the sole distinction between groups, selection, edge direction, or diagnostic states.

## Performance And Validation

The spike uses deterministic fixtures across layout, styling, selection, and refresh variants:

- empty and invalid;
- small: approximately 25 nodes and 50 edges;
- medium: approximately 500 nodes and 1,500 edges;
- large comparison: approximately 5,000 nodes and 15,000 edges.

Measure bundle delta, projection encoding size, first meaningful render, layout settle time, longest main-thread task, interaction responsiveness, refresh movement, and retained memory after disposal. Layout work for medium and large fixtures must not run as an unbounded main-thread simulation.

Visual and behavioral review should compare:

- whether clusters and one-hop relationships are legible;
- whether unchanged nodes remain spatially stable after adding and removing entries;
- whether selection survives a saved View refresh;
- whether filters reduce both the visible graph and accessible companion surface;
- whether theme changes and reduced motion apply without reopening Preview;
- whether every renderer, worker, observer, and listener is released on Preview reload.

## Proposed Small-Step Execution

1. Resolve the taxonomy-neutral node-facet dependency; do not expand `GraphRenderNode.space`.
2. Add deterministic shared fixtures and a host-neutral renderer and state interface.
3. Build the Sigma vertical slice with single selection, one-hop emphasis, active-document following, directed edges, source activation, and richer semantic node styling.
4. Compare ForceAtlas2 worker and the simpler Graphology force layout on small and medium fixtures; add stable seeding and refresh coordinate reuse.
5. Implement the native Markdown Preview script lifecycle and accessible companion surface.
6. Add package, Extension Host, theme, reload, performance, and real-editor validation.
7. Add frontmatter-defined groups and filters as a follow-up over the same generic facet and query model.
8. Run a separate lazy-loaded 3D proof of concept only after the 2D baseline is accepted.

## Remaining Product Refinement

The technical direction can proceed, but these choices still need visual prototyping:

- which exact size scale and minimum/maximum radius remain legible across the fixture sizes;
- which theme-derived palettes and non-color indicators best distinguish explicit groups;
- whether reciprocal references read better as two curved arrows or one bidirectional edge at common densities;
- which controls deserve the always-visible toolbar, and which belong in a collapsible settings panel;
- whether the no-active-document fallback should remain fit-to-graph or choose another automatic anchor after real-editor testing.

## External Sources

- [Foam Graph Visualization](https://docs.foamnotes.com/features/graph-view/)
- [Foam graph-view package](https://github.com/foambubble/foam/tree/main/packages/foam-graph)
- [Foam graph protocol](https://github.com/foambubble/foam/blob/main/packages/foam-graph/src/protocol.ts)
- [Obsidian Graph View](https://obsidian.md/help/plugins/graph)
- [VS Code Markdown extension API](https://code.visualstudio.com/api/extension-guides/markdown-extension)
- [Sigma.js documentation](https://www.sigmajs.org/docs/)
- [Graphology ForceAtlas2](https://graphology.github.io/standard-library/layout-forceatlas2.html)
- [Graphology force layout](https://graphology.github.io/standard-library/layout-force.html)
- [Cytoscape.js layout guidance](https://blog.js.cytoscape.org/2020/05/11/layouts/)
- [GraphXR project workspace](https://helpcenter.kineviz.com/user-guides/v3/g-user/graphxr-start/project-ui.html)
- [Graphia](https://graphia.app/)
- [myReach 3D Visualiser](https://handbook.rea.ch/knowledge-base/views/3d-visualiser/)
- [`3d-force-graph`](https://github.com/vasturiano/3d-force-graph)
- [A Study of Mental Maps in Immersive Network Visualization](https://arxiv.org/abs/2001.06462)
