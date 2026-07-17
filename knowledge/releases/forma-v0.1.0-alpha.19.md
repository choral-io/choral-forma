---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.19
summary: Internal alpha for persistent VS Code language intelligence and resilient native View Preview.
scope: project
type: release
status: released
version: v0.1.0-alpha.19
date: 2026-07-17
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - vscode
    - lsp
    - preview
    - kanban
    - validation
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedTasks:
    - "tasks/add-vscode-forma-lsp-lifecycle"
    - "tasks/migrate-vscode-navigation-to-forma-lsp"
    - "tasks/validate-vscode-lsp-remote-and-performance"
    - "tasks/implement-vscode-view-preview"
---

# Forma v0.1.0-alpha.19

## Purpose

Publish the persistent VS Code language-intelligence migration and the native Preview reliability and layout refinements completed after [[releases/forma-v0.1.0-alpha.18]]. This release keeps the Forma CLI and LSP authoritative, preserves VS Code's native Markdown behavior, and makes the first internally distributed editor extension more stable during daily workspace use.

## Scope

- Start and supervise the coordinated `forma lsp` process from the VS Code Extension Host.
- Migrate managed-document navigation, diagnostics, and Preview link analysis from repeated CLI requests to the persistent LSP connection.
- Recover stopped language clients and validate local and representative remote Extension Host profiles without changing the managed CLI installation contract.
- Restore projections in already-open native Markdown Preview tabs after activation, window reload, and Preview tab restoration.
- Carry configured Kanban card fields through the Core render contract and render dynamic columns as one horizontally scrollable, responsive row.
- Format date and timestamp card fields for the editor locale while retaining the source value in semantic HTML.
- Wrap native Frontmatter tables in a disclosure for Forma-managed documents, defaulting to collapsed through the resource-scoped `forma.preview.frontmatterDefaultState` setting.
- Use one theme-aware Lucide icon family across Taxonomies, Terms, entries, Views, View modes, and pagination while bundling only the required SVG files.

## Release Gates

1. `mise run version:check -- v0.1.0-alpha.19` passes.
2. `CI=true mise run check` passes from the exact aligned candidate.
3. Forma config, content checks, and workspace health pass, and the quick persistent LSP performance gate remains within the recorded baseline.
4. A local `forma-0.1.0-alpha.19.vsix` packages, installs, and passes the packaged-extension smoke test on the supported VS Code boundary.
5. The complete candidate is committed and pushed before main CI is evaluated.
6. Main CI passes for the exact candidate commit before the annotated tag is created.
7. The tag-triggered Release workflow publishes the expected archives, standalone binaries, VSIX, and sibling SHA-256 files.
8. `mise run release:verify -- v0.1.0-alpha.19` validates the published release, current-host CLI, VSIX identity, and production VS Code managed-install path.

## Known Boundaries

- Graph rendering remains deferred to the focused renderer research and implementation project that starts after this release.
- The Zed extension remains an internal Dev Extension and still requires a matching preinstalled CLI on the worktree `PATH`.
- The Frontmatter disclosure applies only to Forma-managed documents; ordinary Markdown Preview remains host-owned and unchanged.
- Classic restored Preview tabs do not expose a source URI through the stable VS Code API, so Forma uses a bounded View-filename match only for configured Views.
- The managed-document predicate is taxonomy-neutral, but the current product still assumes one Page matches at most one taxonomy term; multi-taxonomy composition remains deferred.

## Validation

Local candidate validation passed on 2026-07-17:

- `mise run version:check -- v0.1.0-alpha.19` confirmed every coordinated manifest, lock entry, release record, and current-version document is aligned at `0.1.0-alpha.19`.
- `CI=true mise run check` passed after the release-aligned edits, including 26 Vitest files with 153 tests, 23 Node release and tooling tests, the complete Rust workspace tests, formatting, linting, TypeScript checks, production builds, and the Zed `wasm32-wasip1` check.
- Forma configuration inspection and `forma check --json` passed without diagnostics. Workspace health reported only the expected no-backlink warnings for Alpha 15, Alpha 16, and this newly planned Alpha 19 release record.
- `mise run perf:lsp:quick` passed: the repository project measured 922.1 ms initialization, 135.4 ms cold navigation, and 0.2 ms warm p95; the generated 1,000-entry workspace measured 4.3 ms initialization, 39.3 ms cold navigation, and 0.1 ms warm p95.
- `forma-0.1.0-alpha.19.vsix` packaged 31 files and installed as `choral-io.forma@0.1.0-alpha.19` in an isolated profile of the production VS Code 1.129.0 installation. The packaged smoke test verified activation, navigation, native Markdown Preview, and persistent-LSP behavior; measured activation was 48.4 ms, cold Definition 27.5 ms, warm Definition p95 14.8 ms, cold Document Link 2.0 ms, and warm Document Link p95 1.4 ms.

Published release evidence:

- Annotated tag `v0.1.0-alpha.19` points to exact candidate commit `5915a881cbfd16be6b7636075bda094aab120e7e`.
- [Main CI run 29583911194](https://github.com/choral-io/choral-forma/actions/runs/29583911194) completed successfully for that exact commit, including Knowledge, Web, Rust, Zed `wasm32-wasip1`, VS Code Extension Host, packaging, and VSIX smoke validation.
- [Release workflow run 29584127908](https://github.com/choral-io/choral-forma/actions/runs/29584127908) completed successfully for the same commit across all CLI platform targets, the VS Code extension, and final publication.
- [GitHub Release `v0.1.0-alpha.19`](https://github.com/choral-io/choral-forma/releases/tag/v0.1.0-alpha.19) was published as a prerelease on 2026-07-17 with 22 expected assets.
- `mise run release:verify -- v0.1.0-alpha.19` passed. The current-host CLI identified as `forma 0.1.0-alpha.19` with SHA-256 `6fe9b3bf5f9168741868cdbcce1dd46bdbe8f4cc9abeed331a8342a452a9621a`; the VSIX identified as `choral-io.forma@0.1.0-alpha.19`, declared engine `^1.110.0`, and matched SHA-256 `494c1d78cb38124e8051ed471689f7bfc4e3af34b9e21c59807ec6052e836a95`.
- The verification gate installed the published `forma-macos-arm64` asset through the production VS Code managed-install path and confirmed `forma 0.1.0-alpha.19`.

## Rollout Plan

1. Align all coordinated release versions and create this planned release record.
2. Run the complete local candidate gate, VSIX package inspection, and packaged smoke validation.
3. Commit and push the exact candidate, then wait for main CI to pass.
4. Create annotated tag `v0.1.0-alpha.19` only on the verified candidate commit.
5. Observe the tag-triggered Release workflow and run the executable published-release verification gate.
6. Record immutable release evidence in a separate post-release commit before internal distribution.

## Migration Or Operations Notes

- VS Code users should install the Alpha 19 VSIX from the matching GitHub prerelease and allow the extension to install or select the coordinated Forma CLI.
- Existing explicit and managed CLI settings remain valid; the extension and CLI version must remain equal.
- `forma.preview.frontmatterDefaultState` can be set to `expanded` per resource scope when the native Frontmatter table should start open.

## Release Notes

> Forma `v0.1.0-alpha.19` moves VS Code language intelligence onto the persistent Forma LSP, restores native View Preview after reload, and refines Kanban layout, card metadata, Frontmatter disclosure, and Explorer icon consistency while keeping ordinary Markdown behavior native.

## Rollback Plan

Do not move or overwrite the Alpha 19 tag after publication. If internal testing finds a blocker, stop distributing Alpha 19, record the failure, and publish a new aligned prerelease after remediation.

## Post-Release Follow-Up

- Research the Graph renderer against explicit functionality, extensibility, configuration, theme, performance, and accessibility criteria, using Foam and Obsidian as product references.
- Implement user-initiated, checksum-verified Zed CLI acquisition against an already published matching release.
- Resolve multi-taxonomy Page composition across Forma Core and both editor adapters as a separate product-wide task.
