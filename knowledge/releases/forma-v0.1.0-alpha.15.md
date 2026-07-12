---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.15
summary: First internal test release of the editor-first Forma workspace experience.
scope: project
type: release
status: planned
version: v0.1.0-alpha.15
date: 2026-07-12
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - vscode
    - validation
relatedTestCases:
    - "test-cases/forma-starter-kit"
---

# Forma v0.1.0-alpha.15

## Purpose

Publish the editor-first Forma experience implemented after [[releases/next-internal-release]] as a new immutable prerelease. This release is intended for internal VS Code testing with a separately installed, version-aligned Forma CLI.

## Scope

- Discover configured Forma workspaces and expose concise runtime status and diagnostics.
- Add the Explorer-hosted Forma tree with dynamic Taxonomies, Terms, entries, and Views.
- Open ordinary entries as editable Markdown source and Views in enhanced native Markdown Preview.
- Render list, table, and kanban View projections with VS Code theme variables; keep Graph deliberately deferred.
- Navigate Markdown links, wikilinks, aliases, fragments, embeds, and schema-backed frontmatter references.
- Render resolved wikilinks with explicit aliases or target document titles while leaving ordinary frontmatter strings unchanged.
- Package only the selected Lucide SVG assets and their third-party notices.
- Preserve Workspace Trust boundaries and workspace-extension placement for local and future Remote validation.

## Release Gates

1. `CI=true mise run check` passes locally.
2. Forma config, content checks, and workspace health pass.
3. VS Code 1.110, current stable, and Restricted Mode Extension Host tests pass in CI.
4. The final VSIX is installed and activated by the packaged-artifact smoke test.
5. PR and merged-main CI pass without a PR review merge gate.
6. Tag `v0.1.0-alpha.15` points to the verified merge commit.
7. The Release workflow publishes five CLI archives, the VSIX, and a checksum for every payload.
8. Downloaded release artifacts pass checksum and version verification before internal distribution.

## Known Boundaries

- Graph rendering remains a separate focused project.
- Semantic analysis and View projections refresh from saved Markdown.
- The extension is read-only beyond ordinary Markdown editing; it does not add drag-and-drop, metadata mutation, or generated file rewrites.
- Local workspaces are the release gate. Remote environments remain best-effort until separately validated.

## Rollback Plan

Do not move or overwrite the Alpha 15 tag. If internal testing finds a release blocker, stop distributing Alpha 15, record the failure, and publish a new version after the correction is verified.
