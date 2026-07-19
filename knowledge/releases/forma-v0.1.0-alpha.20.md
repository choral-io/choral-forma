---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.20
summary: Internal alpha for shared WebApp and VS Code Graph rendering with taxonomy-driven presentation.
scope: project
type: release
status: planned
version: v0.1.0-alpha.20
date: 2026-07-19
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - graph
    - vscode
    - webapp
    - taxonomy
    - preview
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedTasks:
    - "tasks/implement-shared-graph-view-runtime"
    - "tasks/migrate-webapp-to-shared-graph-view"
    - "tasks/integrate-shared-graph-view-vscode-preview"
    - "tasks/validate-shared-graph-view-cross-host-parity"
---

# Forma v0.1.0-alpha.20

## Purpose

Publish the first shared Graph View milestone after [[releases/forma-v0.1.0-alpha.19]]. This release replaces divergent Host-local Graph behavior with one reusable runtime, makes configured taxonomy presentation visible in Graphs, and adds Graph hydration to VS Code's native Markdown Preview without introducing a second preview surface.

## Scope

- Use `packages/graph-view` as the shared owner of Graphology construction, layout, Sigma rendering, selection, one-hop emphasis, directional edges, node sizing, labels, and runtime disposal.
- Render configured Graph Views in both the WebApp and VS Code native Markdown Preview through thin Host adapters.
- Apply explicitly configured `graph.presentation.nodes.colorBy.taxonomy` values through Term color, Taxonomy color, and Host-neutral fallbacks without treating any taxonomy id as special.
- Size nodes from bounded semantic reference counts while keeping node size stable across hover, selection, and one-hop focus.
- Preserve configured node fill and communicate hover or selection through Host-themed rings, label surfaces, opacity, z-index, and static direction arrows.
- Preserve selection and rendering across light or dark theme changes, native Preview content refresh, and VS Code reload recovery.
- Add page-contained Graph expansion and a responsive 3:2 embedded canvas in both Hosts.
- Delegate View and node source navigation to native Markdown Preview links and the native `Open Source File` action instead of duplicating an editable-source control.
- Render the original View Markdown around the projection in the WebApp, using the Core-provided UTF-16 mount mapping and appending the projection when no explicit mount exists.
- Resolve namespaced space convention fields consistently so configured titles and summaries appear in indexes, resolved references, and Graph projections.
- Keep configured term colors limited to Graph nodes; VS Code Explorer icons remain theme-readable.

## Release Gates

1. `mise run version:check -- v0.1.0-alpha.20` passes.
2. `CI=true mise run check` passes from the exact aligned candidate.
3. Forma config and content checks pass; workspace health has no release-blocking diagnostics.
4. `mise run perf:quick` records no material Core or View-render regression.
5. A local `forma-0.1.0-alpha.20.vsix` packages and passes the packaged-extension smoke test with the supported production VS Code installation.
6. The complete candidate is committed and pushed before main CI is evaluated.
7. Main CI passes for the exact candidate commit before the annotated tag is created.
8. The tag-triggered Release workflow publishes the expected archives, standalone binaries, VSIX, and sibling SHA-256 files.
9. `mise run release:verify -- v0.1.0-alpha.20` validates the published release, current-host CLI, VSIX identity, and production VS Code managed-install path.

## Known Boundaries

- The planned 25/500/5,000-node cross-Host matrix, long-running retained-memory and idle-CPU profiling, a real Remote Extension Host session, and live high-contrast and reduced-motion sessions remain open under [[tasks/validate-shared-graph-view-cross-host-parity]].
- The Alpha includes no selected-edge animation. Static arrowheads remain the authoritative reference-direction signal until a separate interaction study demonstrates that motion improves comprehension without adding excessive cost.
- Frontmatter-defined Graph groups and filters, a production 3D renderer, and editable graph relationships remain out of scope.
- Full taxonomy-neutral Page discovery, multi-taxonomy composition, schema composition, create identity, and compatibility-field removal remain under [[tasks/generalize-taxonomy-neutral-page-model]]. No taxonomy definition, including `spaces`, receives special Graph behavior.
- The Graph canvas exposes a text legend and selected-node summary but intentionally does not duplicate the complete node collection as a searchable card list.
- The Zed extension remains an internal Dev Extension and still requires a matching preinstalled CLI on the worktree `PATH`.

## Validation

Aligned local candidate validation on 2026-07-19 established the release baseline:

- `mise run version:check -- v0.1.0-alpha.20` and `CI=true mise run check` passed with 34 Vitest files and 200 tests, 23 Node tooling tests, the complete Rust workspace tests, formatting, linting, TypeScript checks, production builds, and the Zed `wasm32-wasip1` check.
- `mise run perf:quick` measured the generated 1,000-entry `view.render` at 68.2 ms median and 74.0 ms p95, with no material regression from the previous recorded 71.8 ms median and 72.6 ms p95.
- The WebApp Graph chunk measured 203.41 kB, or 51.15 kB gzip.
- `forma-0.1.0-alpha.20.vsix` packaged 56 files at 199.68 KB. An isolated profile of the production VS Code installation verified `choral-io.forma@0.1.0-alpha.20` installation and activation, with 62.9 ms activation, 41.1 ms cold Definition, 10.3 ms warm Definition p95, 2.2 ms cold Document Link, and 1.8 ms warm Document Link p95.
- A WebApp RPC-adapter regression test verifies View Markdown before and after an explicit content mount and the no-mount append contract. Browser validation against the running example workspace confirms the source sentence appears before the Release Scope table projection.
- Forma config inspection and `forma check --json` passed without diagnostics. Workspace health reported only five no-backlink warnings, including this planned release record.

The exact-candidate main CI, Release workflow, and published-release verification remain open. The complete local gate will be rerun after this evidence-only update before the candidate is pushed.

## Rollout Plan

1. Commit the reviewed implementation slices and align task, plan, changelog, and release records.
2. Align all coordinated release versions at `0.1.0-alpha.20`.
3. Run the complete local candidate gate, quick performance gate, VSIX package inspection, and packaged smoke validation.
4. Commit and push the exact candidate once, then wait for main CI to pass.
5. Create annotated tag `v0.1.0-alpha.20` only on the verified candidate commit.
6. Observe the tag-triggered Release workflow and run the executable published-release verification gate.
7. Record immutable release evidence in a separate post-release commit before internal distribution.

## Migration Or Operations Notes

- VS Code users should install the Alpha 20 VSIX from the matching GitHub prerelease and allow the extension to install or select the coordinated Forma CLI.
- Existing explicit and managed CLI settings remain valid; the extension and CLI version must remain equal.
- Existing Graph View sources remain editable Markdown. A missing `<!-- forma:content -->` mount appends the projection at the end of the document.
- `graph.presentation.nodes.colorBy.taxonomy` opts a Graph into configured taxonomy colors; Graph Views without it keep Host-neutral colors.

## Release Notes

> Forma `v0.1.0-alpha.20` brings the same configurable Graph View to the WebApp and VS Code native Markdown Preview, with taxonomy-driven colors, reference-aware node sizing, theme-adaptive focus, static direction cues, responsive expansion, native source navigation, and original View Markdown preserved around each projection.

## Rollback Plan

Do not move or overwrite the Alpha 20 tag after publication. If internal testing finds a blocker, stop distributing Alpha 20, record the failure, and publish a new aligned prerelease after remediation.

## Post-Release Follow-Up

- Complete the cross-Host scale, Remote, high-contrast, reduced-motion, retained-memory, and idle-CPU validation matrix.
- Define configurable Graph grouping and filtering semantics from frontmatter without introducing Host-local query behavior.
- Revisit reference-direction animation only through a focused interaction and performance study.
- Resolve multi-taxonomy Page composition across Forma Core and both editor adapters as a separate product-wide task.
