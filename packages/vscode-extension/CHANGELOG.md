# Changelog

## Unreleased

## 0.1.0-alpha.20

- Render configured Graph Views in VS Code native Markdown Preview through the same shared Sigma and Graphology runtime used by the WebApp.
- Add taxonomy-driven Graph colors and legends, reference-count node sizing, static directional arrows, one-hop focus, theme-aware labels, and page-contained expansion.
- Preserve native Markdown source navigation, restore Graph selection across Preview refresh and theme changes, and keep ordinary Markdown behavior host-owned.
- Render the original View Markdown around its projection in the WebApp, inserting at `<!-- forma:content -->` or appending when the marker is absent.
- Resolve namespaced space convention fields so configured titles and summaries appear consistently in Graph nodes, links, and other entry projections.
- Keep Explorer icons theme-readable, remove the duplicate Graph node list and source action, and align embedded Graph canvases to a responsive 3:2 presentation.
- Upgrade the coordinated development toolchain to pnpm 11.14.0.

## 0.1.0-alpha.19

- Migrate VS Code navigation, diagnostics, and Preview link analysis to the persistent Forma LSP while retaining the coordinated managed-CLI lifecycle.
- Recover stopped language clients and validate the LSP lifecycle across local and representative remote Extension Host profiles.
- Restore already-open Forma native Markdown Previews after extension activation, window reload, and Preview tab restoration.
- Improve config-driven Kanban cards with a single-row responsive layout, dynamic columns, friendly date and time values, and contained horizontal scrolling.
- Add collapsible Frontmatter for Forma-managed documents with a resource-scoped default-state setting while leaving ordinary Markdown Preview unchanged.
- Unify the Forma Explorer tree on a small, bundled set of theme-aware Lucide icons.

## 0.1.0-alpha.18

- Add the editor-neutral `forma lsp` transport with Core-owned transient document analysis, reusable workspace snapshots, and managed-document scope gating.
- Add a Zed Dev Extension for native Markdown navigation across wikilinks, embeds, aliases, heading fragments, and schema-declared references.
- Keep ordinary Markdown behavior host-owned while adding bounded compatibility projections for Zed heading links and explicit Markdown examples in code regions.
- Align wikilink highlighting with editor themes, preserve cursor position for unfragmented Zed document navigation, and refresh managed scope when Forma configuration changes.
- Require the Zed adapter-controlled CLI found on the worktree `PATH` to match the extension version exactly, while documenting Zed's native binary override as a user-owned escape hatch.
- Add repeatable Forma LSP latency and resource benchmarks and strengthen release-version and published-asset verification.

## 0.1.0-alpha.17

- Require the VS Code extension and Forma CLI to use the same coordinated Alpha release version.
- Add an explicit, checksum-verified managed CLI installation path for local and remote Extension Hosts without modifying user `PATH`.
- Report CLI command and Explorer loading failures without presenting them as a missing Forma workspace.
- Harden managed installation against cancellation races, stale runtime refreshes, interrupted downloads, and Windows executable replacement locks.
- Strengthen Restricted Mode, packaged Preview, Windows launcher, release-matrix, and temporary-file regression coverage.

## 0.1.0-alpha.16

- Scoped Forma workspace discovery and file watching to the selected `.forma.md`, its imports, and configured content includes, with explicit workspace configuration support.
- Removed per-link background CLI fan-out by reusing one document analysis result for Preview links and diagnostics.
- Added bounded, deduplicated extension request scheduling with cancellation, stale-generation protection, and coalesced Explorer refreshes.
- Reused one loaded workspace configuration per Core operation to reduce repeated import and configuration parsing.
- Replaced the VS Code Explorer's full dashboard payload with compact taxonomy and View summaries plus paginated, lazy term entries.
- Added repeatable quick and full performance benchmarks, aligned version automation, and dependency updates.

## 0.1.0-alpha.15

- Enhanced VS Code's native Markdown Preview with list, table, and kanban View projections while keeping View source editable.
- Added the Explorer-hosted Forma tree with configured Taxonomies, Terms, entries, Views, and mode-specific theme-aware icons.
- Added Core-backed frontmatter and wikilink Preview navigation, including title labels, aliases, and fragments without treating ordinary tags as references.
- Improved View theme alignment, horizontal overflow behavior, compact status presentation, and source navigation.
- Kept Graph Preview intentionally deferred for its focused follow-up project.

## 0.1.0-alpha.14

- Corrected reference-token end-boundary handling.
- Enforced the canonical source-backed View mount with a legacy-marker migration diagnostic.
- Strengthened packaged-extension validation for navigation, editable source, and View preview commands.
- Made the default VSIX output filename follow the extension manifest version.

## 0.1.0-alpha.13

- First internally distributed VS Code extension.
- Added Forma workspace discovery and status commands.
- Added source-first reference navigation and list, table, and kanban previews.
- Deferred graph rendering to a focused follow-up release.
