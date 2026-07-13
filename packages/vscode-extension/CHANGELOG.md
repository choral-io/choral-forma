# Changelog

## Unreleased

- Require the VS Code extension and Forma CLI to use the same coordinated Alpha release version.
- Add an explicit, checksum-verified managed CLI installation path for local and remote Extension Hosts without modifying user `PATH`.
- Report CLI command and Explorer loading failures without presenting them as a missing Forma workspace.

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
