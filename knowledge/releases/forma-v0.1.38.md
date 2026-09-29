---
schemaVersion: 1
kind: release
title: "Forma v0.1.38"
summary: "Interactive temporal views across WebApp and VS Code, reliable native preview enhancements, batch View rendering, and dependency updates."
scope: project
type: release
status: candidate
version: "v0.1.38"
date: 2026-09-29
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - calendar
    - gantt
    - vscode
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
sources:
    - "planning/temporal-view-release-plan"
    - "architecture/editor-extension-adapter-contract"
---

# Forma v0.1.38

## Scope

Prepare the coordinated Public Preview update following [[releases/forma-v0.1.37]]. This cutline includes interactive Calendar/Gantt rendering in VS Code using the shared temporal package, native Markdown preview and scope-reconciliation fixes, `forma view render --all`, and the dependency updates committed with the candidate.

## Included Changes

- Share interactive Calendar and Gantt projections across the WebApp and VS Code; update the VS Code view icons and view contracts.
- Fix temporal event navigation and Calendar month jumps in VS Code native Markdown previews. Keep metadata folding synchronous and make Forma-managed enhancements consistent across preview entry paths.
- Reconcile previews as configuration scope changes, discard stale asynchronous results, coalesce unchanged or repeated refreshes, and defer interactive module initialization until matching content is present.
- Add batch rendering for all discovered Views with `forma view render --all`.
- Refresh Wrangler and VS Code language-client dependencies and add the shared temporal package dependencies.

## Candidate Verification

The source candidate passed the local repository gate: TypeScript checks, lint, formatting, workspace builds, 526 JavaScript tests, 532 Rust tests, 78 repository scripts, 19 VS Code tooling scripts, Zed WASI compilation, Forma content checks and workspace health, and Wrangler deployment dry-run. The VS Code extension passed four isolated host integration tests on the local stable editor, including LSP navigation and View previews. Exact minimum-editor, restricted-mode, packaged VSIX installation, exact-source CI, publication, and published-asset checks remain pending.

## Release Notes

> Forma 0.1.38 brings interactive Calendar and Gantt views to VS Code, improves native Markdown preview navigation and enhancement updates, and adds batch rendering for configured Views.

## Rollback Plan

Before publication, remediate the candidate and repeat the exact-source gates. After publication, preserve the immutable tag and assets and publish a higher coordinated version for corrections. Use the official installer as the recovery path.
