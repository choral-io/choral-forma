---
schemaVersion: 1
kind: release
title: Next Internal Release
summary: Internal prerelease gate for the first installable Choral Forma VS Code extension and aligned Forma release artifacts.
scope: project
type: release
status: planned
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

This is a rolling pre-release checklist for the next internal Forma version. After an internal version is tagged or published, reset this record to the next candidate instead of treating it as a permanent release note.

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
- Latest published tag: `v0.1.0-alpha.12`.
- Candidate cutline: pending implementation and PR merge.
- Local validation: pending.
- PR and merged-main CI: pending.
- Release workflow and artifact verification: pending.
- Release decision: do not tag until all local gates and required CI checks pass.

Validation history:

- `v0.1.0-alpha.8`: repository `config inspect`, `check`, `workspace health`, full `CI=true mise run check`, starter-kit `check`, starter-kit pressure validation, and readiness metric review passed at cutline `0190809 test: align builtin skill wording expectation`; latest previous tag was `v0.1.0-alpha.7`. Vite reported non-blocking chunk-size warnings.

Task-board alignment:

- This release record being `planned` does not imply that every related task has been moved to `done`.
- Use `cargo run -q -p forma-cli -- view render .forma/views/task-board --json` as the source of truth for current task status.
- Reviewing or doing tasks must still be closed through explicit task-board review before any final release publish action.

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

> Forma `v0.1.0-alpha.13` adds the first internally testable Choral Forma VS Code extension. It discovers configured Markdown workspaces through a separately installed Forma binary, provides Forma-aware reference navigation, and previews source-backed list, table, and kanban views directly inside VS Code. Binary archives and the VSIX now share one release version and are produced by the GitHub Release workflow.

## Rollback Plan

No runtime rollback is required for an internal knowledge release. If validation fails, keep the release in `planned` status, record the blocker, and create or update follow-up tasks.

## Post-Release Follow-Up

- Collect internal installation, discovery, navigation, preview, theme, and remote-workspace feedback.
- Execute [[tasks/design-editor-graph-view-renderer]] as a separate focused project.
- Reassess Zed, backlinks, unsaved-buffer analysis, and writable view interactions after VS Code dogfooding.
