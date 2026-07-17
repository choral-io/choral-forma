---
scope: project
type: technical-assessment
title: Editor Graph View Technical Research — 2026-07-17
summary: Compares Foam, Obsidian, Sigma, and alternative renderer approaches and proposes an extensible, configurable, editor-native Graph View direction for Forma.
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

Forma should keep Graph as a normal configured View and implement it as an enhancement of the editor's native Markdown Preview. The first renderer spike should compare these two approaches over identical data, interaction, theme, and accessibility fixtures:

1. Sigma.js with Graphology and a ForceAtlas2 Web Worker;
2. the `force-graph` approach used by Foam.

The provisional production direction is Sigma.js plus Graphology if the spike confirms that a relationship-driven layout fixes the current experience. Forma already carries these libraries in the WebApp, Sigma provides a WebGL path for larger graphs, and Graphology supplies worker-based ForceAtlas2. The present WebApp's fixed-circle layout is the primary visual limitation; it is not evidence that Sigma itself is unsuitable.

Do not share the current React route component. Extract a host-neutral graph component only after the spike establishes its boundary. That component should consume a renderer-independent projection, semantic `--forma-*` theme tokens, and callbacks for selection and navigation. It must not import VS Code, React Router, or the WebApp theme context.

Production integration is sequenced behind the taxonomy-neutral Page contract. The current `GraphRenderNode.space` field and space-color hash contradict the accepted rule that every configured taxonomy is equal. A spike may translate the current fixture at its boundary, but it must not add another production dependency on `space` or reserve any taxonomy id.

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
| Sigma.js + Graphology + ForceAtlas2 worker | Existing Forma dependency and experience; WebGL renderer; Graphology algorithms and metrics; worker layout; good headroom for thousands of elements | custom rendering is harder; canvas/WebGL needs a parallel accessible surface; layout and state must be designed explicitly | Primary candidate |
| `force-graph` + D3 force | Proven by Foam; fast route to an organic graph; force and interaction controls are straightforward; framework-neutral | live simulation can move excessively; stable refresh needs coordinate reuse and bounded settling; canvas still needs accessible companions | Required comparison candidate |
| Cytoscape.js plus layout extensions | Rich renderer-independent layout ecosystem, including force and hierarchical layouts; strong selector and interaction model | larger conceptual and dependency surface; layout extensions add maintenance; no current Forma reuse | Reserve candidate if the first two cannot meet hierarchical or interaction requirements |
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
        arrows: focused
        sizeBy: degree
        groups:
            - id: active-work
              label: Active work
              query:
                  field: fields.status
                  op: in
                  value: [ready, active]
              color: accent
```

Group queries must reuse Forma's query model and may target any configured taxonomy or Page field. No default may assume a taxonomy named `spaces`, and one taxonomy must not receive a privileged color or filter path.

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
- persistent single selection and one-hop emphasis;
- open source from node activation and from the details surface;
- temporary filter and group controls based on generic Page facets;
- local depth from the current selection;
- adaptive labels and focused edge labels;
- empty, invalid, and unresolved-target states;
- a reset action for temporary graph state.

Multi-selection, time-lapse animation, user-defined force presets, arbitrary context actions, and editable relationships can follow later evidence. They should not block the first useful release.

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

The spike uses identical deterministic fixtures for both candidates:

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

1. Finalize user journeys and configuration boundaries with the maintainer's Graph ideas.
2. Resolve the taxonomy-neutral node-facet dependency; do not expand `GraphRenderNode.space`.
3. Add deterministic shared fixtures and a host-neutral spike interface.
4. Prototype Sigma plus ForceAtlas2 worker with stable seeding and refresh reuse.
5. Prototype `force-graph` with the same controls, state, fixtures, and navigation surface.
6. Compare evidence and record the accepted renderer and rejected alternative.
7. Implement the native Markdown Preview script lifecycle and accessible companion surface.
8. Add package, Extension Host, theme, reload, performance, and real-editor validation.

## Questions For Product Refinement

The technical direction can proceed without answering every visual preference, but these choices materially shape the first interaction model:

- Should selecting a node open its source immediately, or should single click select and double click or Enter open it?
- Should Graph follow the active editor by default, or only after the user enables a local-focus mode?
- Which default visual grouping is most useful: none, a configured taxonomy, document kind, or an explicit View group list?
- Should directed arrows be always visible, visible only for selected relationships, or disabled by default?
- Which controls deserve the always-visible toolbar, and which belong in a collapsible settings panel?
- What specific qualities of the existing WebApp graph feel wrong beyond the fixed circle: density, color, labels, motion, node appearance, interaction, or lack of meaning?

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
