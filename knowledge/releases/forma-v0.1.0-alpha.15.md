---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.15
summary: First internal test release of the editor-first Forma workspace experience.
scope: project
type: release
status: released
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

Publish the editor-first Forma experience implemented after [[releases/forma-v0.1.0-alpha.14]] as a new immutable prerelease. This release is intended for internal VS Code testing with a separately installed, version-aligned Forma CLI.

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

## Validation

- `CI=true mise run check`, `forma check --json`, `forma workspace health --json`, and release-version consistency checks passed locally.
- The packaged candidate was installed in the formal VS Code application and exercised against `software-product-rd-workspace`; frontmatter references, ordinary tags, title-backed wikilinks, the dynamic Forma Explorer tree, and native Preview View rendering behaved as expected.
- [PR #6](https://github.com/choral-io/choral-forma/pull/6) merged at `b36a70d5e37deb6fb0f0e0fd9e930af495112110` after Knowledge, Web, Rust, and VS Code Extension passed in [CI run 29190989679](https://github.com/choral-io/choral-forma/actions/runs/29190989679). No PR review or merge gate was required for this release.
- The same four jobs passed for the merged main commit in [CI run 29191074949](https://github.com/choral-io/choral-forma/actions/runs/29191074949), including Extension Host tests, dynamic VSIX packaging, and packaged-artifact installation and activation.
- Annotated tag `v0.1.0-alpha.15` points to the verified merge commit. [Release run 29191148227](https://github.com/choral-io/choral-forma/actions/runs/29191148227) passed version validation, five CLI builds, VS Code Extension tests, VSIX smoke validation, checksum generation, and GitHub Release publication.
- [GitHub prerelease v0.1.0-alpha.15](https://github.com/choral-io/choral-forma/releases/tag/v0.1.0-alpha.15) contains five platform archives, `forma-0.1.0-alpha.15.vsix`, and a sibling checksum for every payload.
- All six downloaded payload checksums passed. The released macOS arm64 binary reports `forma 0.1.0-alpha.15`; the VSIX SHA-256 is `27e05c7da9063d3667453f37275b0e2674bda070604bc8de8ecc7f08e2da73e6`, and its manifest reports `choral-io.forma@0.1.0-alpha.15` with VS Code `^1.110.0`.
- The exact released VSIX was installed into the formal VS Code application and reloaded successfully with `Forma: Ready`, 12 dynamic Spaces, four Views, a rendered Task Board, and no workspace problems.

## Release Notes

> Forma `v0.1.0-alpha.15` is the first editor-first internal release. It enhances VS Code's native Markdown Preview with schema-backed frontmatter links, title-backed wikilinks, and list/table/kanban Views; adds a dynamic Forma panel to Explorer; improves theme alignment and status density; and keeps Graph rendering explicitly deferred for a focused follow-up.

## Rollback Plan

Do not move or overwrite the Alpha 15 tag. If internal testing finds a release blocker, stop distributing Alpha 15, record the failure, and publish a new version after the correction is verified.
