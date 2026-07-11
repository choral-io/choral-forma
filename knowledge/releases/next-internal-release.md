---
schemaVersion: 1
kind: release
title: Next Internal Release
summary: Internal prerelease gate for the first installable Forma for VS Code extension and aligned Forma release artifacts.
scope: project
type: release
status: released
version: v0.1.0-alpha.13
date: 2026-07-11
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - validation
relatedTasks:
    - "tasks/implement-vscode-extension-mvp"
    - "tasks/validate-and-release-forma-alpha-13"
    - "tasks/integrate-vsix-ci-release-artifact"
    - "tasks/add-linux-arm64-release-artifact"
relatedTestCases:
    - "test-cases/forma-starter-kit"
    - "test-cases/forma-cli-docs-bootstrap"
relatedExperiments:
    - "experiments/starter-kit-agent-pressure-validation"
relatedMetrics:
    - "metrics/knowledge-workflow-replacement-readiness"
---

# Next Internal Release

## Purpose

This record preserves the cutline and validation evidence for the published Alpha 13 internal prerelease. Start a separate release record for the next candidate so this published evidence remains stable.

## Scope

This release should prove that a user with a separately installed Forma binary can install the Choral Forma VS Code extension, discover a configured Markdown workspace, navigate supported references, and preview list, table, and kanban views without surrendering editable source files.

The release is an internal-testing prerelease distributed through GitHub Release. It includes public binary archives and an installable VSIX, but it does not publish the extension to the VS Code Marketplace. Graph preview, Zed, write-capable view interactions, AI Chat, MCP, and comprehensive write-operation coverage remain outside the cut line.

## Planned Changes

- One aligned `0.1.0-alpha.13` version across Cargo packages, the Forma binary, VSIX manifest, Git tag, release record, and release artifacts.
- A Node-based VS Code workspace extension with a reproducible bundle, tests, VSIX package, and internal installation path.
- Discovery of `.forma.md`, preinstalled Forma binary selection, Workspace Trust handling, remote-compatible extension-host placement, status and commands.
- A shared `reference.resolve` operation and editor navigation for ordinary Markdown links, wikilinks, embeds, fragments, and schema-declared semantic references.
- Source-first Markdown view preview with editor theme integration and list, table, and kanban projections.
- A clear deferred state for graph view preview.
- PR CI and tag-triggered Release workflow coverage for extension tests, VSIX packaging, checksum generation, and GitHub Release upload.

## Validation

Required validation is defined by [[planning/editor-extension-alpha-13-execution-plan]] and owned by [[tasks/validate-and-release-forma-alpha-13]]. It includes local full checks, extension unit and Extension Host tests, disposable VSIX install smoke, PR CI, merged-main CI, tag-triggered release builds, and downloaded-artifact verification.

Current validation result:

- Candidate version: `v0.1.0-alpha.13`.
- Published tag: `v0.1.0-alpha.13`, pointing to merge commit `7eb1d49eb0f621018dfbbcc7852a5ae2020764aa`.
- Cutline: [PR #1](https://github.com/choral-io/choral-forma/pull/1) merged from `codex/vscode-extension-alpha13` after all required checks passed.
- Local validation: passed `CI=true mise run check`; Extension Host tests passed on VS Code 1.110, current stable, and an isolated untrusted 1.110 workspace; `forma check` and workspace health passed.
- VSIX validation: `/tmp/forma-0.1.0-alpha.13.vsix` packaged with SHA-256 `3e3a653c373b3fafac666a47c671f66a31a8bde892cfc0e649e5ab8d2f5bc17c`; isolated installation and activation reported `choral-io.forma@0.1.0-alpha.13`.
- UI validation: source and list preview were inspected side by side in VS Code dark and light themes; source links remained available and no Forma webview error was observed.
- PR CI: Knowledge, Web, Rust, and VS Code Extension passed in [run 29152153465](https://github.com/choral-io/choral-forma/actions/runs/29152153465).
- Merged-main CI: the same four jobs passed on the tagged merge commit in [run 29152228755](https://github.com/choral-io/choral-forma/actions/runs/29152228755).
- Release workflow: version validation, five binary targets, VSIX tests and packaging, checksum generation, and GitHub Release publication passed in [run 29152308411](https://github.com/choral-io/choral-forma/actions/runs/29152308411).
- Release artifact verification: all six downloaded payload checksums passed; the macOS arm64 binary reported `forma 0.1.0-alpha.13`; the published VSIX SHA-256 is `2bbc245e2f40d706afa7628d8f4e7b01baa33d2889067a1201292703ad0e8626` and its manifest reports `choral-io.forma@0.1.0-alpha.13`, `Forma for VS Code`, `https://forma.choral.io`, and VS Code `^1.110.0`.
- Released-package smoke: the downloaded VSIX installed in an isolated profile, activated with the downloaded released Forma binary, reached `Forma: Ready`, and returned configuration JSON through `Forma: Inspect Configuration`.
- Release decision: published as [GitHub prerelease v0.1.0-alpha.13](https://github.com/choral-io/choral-forma/releases/tag/v0.1.0-alpha.13).

Validation history:

- `v0.1.0-alpha.13`: local full checks, VS Code 1.110/current stable/restricted Extension Host tests, dark/light UI smoke, PR CI, merged-main CI, tag-triggered Release workflow, all downloaded checksums, released binary version, and released VSIX installation and activation passed at merge commit `7eb1d49eb0f621018dfbbcc7852a5ae2020764aa`.
- `v0.1.0-alpha.8`: repository `config inspect`, `check`, `workspace health`, full `CI=true mise run check`, starter-kit `check`, starter-kit pressure validation, and readiness metric review passed at cutline `0190809 test: align builtin skill wording expectation`; latest previous tag was `v0.1.0-alpha.7`. Vite reported non-blocking chunk-size warnings.

Task-board alignment:

- This release record is `released`; the Alpha 13 Goal task chain has been moved to `done` from recorded validation evidence.
- Use `cargo run -q -p forma-cli -- view render .forma/views/task-board --json` as the source of truth for current task status.
- Other reviewing or doing tasks on the board are outside the Alpha 13 Goal and retain their independent review state.

## Rollout Plan

1. Implement on `codex/vscode-extension-alpha13` using the accepted Goal execution plan.
2. Merge only after required PR checks pass.
3. Tag the intended merge commit as `v0.1.0-alpha.13` only after merged-main CI passes.
4. Let the Release workflow build and publish binary archives plus the VSIX and checksums.
5. Internally distribute the GitHub Release VSIX and record gaps without widening this release.

## Migration Or Operations Notes

The old `knowledge-workflow` skills are not product runtime requirements. Their useful behavior should be represented by configured guidelines, schemas, checks, tasks, test cases, and release validation records.

## Release Notes

Draft release note:

> Forma `v0.1.0-alpha.13` adds the first internally testable Forma for VS Code extension (`choral-io.forma`). It discovers configured Markdown workspaces through a separately installed Forma binary, provides Forma-aware reference navigation, and previews source-backed list, table, and kanban views directly inside VS Code. Binary archives and the VSIX now share one release version and are produced by the GitHub Release workflow.

## Rollback Plan

If internal testing finds a release-blocking defect, stop distributing this prerelease, record the defect and affected artifact, and publish a new version after validation. Do not move or overwrite the published Alpha 13 tag.

## Post-Release Follow-Up

- Collect internal installation, discovery, navigation, preview, theme, and remote-workspace feedback.
- Execute [[tasks/design-editor-graph-view-renderer]] as a separate focused project.
- Reassess Zed, backlinks, unsaved-buffer analysis, and writable view interactions after VS Code dogfooding.
