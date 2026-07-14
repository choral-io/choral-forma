---
schemaVersion: 1
scope: project
type: task
title: Validate VS Code LSP Remote And Performance
summary: Validate the VS Code LSP migration in the installed editor, active-root and remote scenarios, failure recovery, packaging, and performance before any release decision.
priority: P1
value: H
module: app
effort: M
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - lsp
    - remote
    - performance
    - validation
blockedBy:
    - "tasks/migrate-vscode-navigation-to-forma-lsp"
relatedTo:
    - "planning/vscode-lsp-navigation-migration-plan"
    - "architecture/forma-performance-engineering"
    - "discovery/forma-lsp-zed-navigation-validation-2026-07-13"
    - "discovery/vscode-lsp-navigation-validation-2026-07-14"
    - "tasks/manage-vscode-forma-cli-lifecycle"
severity:
sprint:
reportedBy:
affectedArea: VS Code installed-extension navigation, remote URI behavior, process recovery, packaging, and performance
---

# Validate VS Code LSP Remote And Performance

## Goal

Prove that the completed navigation cutover is correct, bounded, recoverable, packageable, and structurally remote-compatible before selecting it for a Forma release.

## Sources

- [[planning/vscode-lsp-navigation-migration-plan]]
- [[architecture/forma-performance-engineering]]
- [[discovery/forma-lsp-zed-navigation-validation-2026-07-13]]
- [[tasks/manage-vscode-forma-cli-lifecycle]]

## In Scope

- Validate current source navigation, native Markdown ownership, Hover, Diagnostics, Preview, Explorer, and CLI recovery in the maintainer's installed VS Code and normal configuration.
- Do not download or retain additional local Code.app copies for manual validation.
- Exercise one, two, and five discovered Forma roots while asserting that only the active root owns one running LSP process.
- Verify root switching, workspace-folder removal, trust changes, configuration changes, extension deactivation, and full VS Code restart.
- Validate local and `vscode-remote` URI conversion with automated round-trip and workspace-boundary tests.
- Run one feasible Remote SSH, Dev Container, or WSL smoke when an environment is available; name every untested host explicitly.
- Terminate the server and verify bounded restart, actionable output, recovery of navigation, and absence of orphan processes or restart storms.
- Record extension activation, cold and warm Definition, DocumentLink, connected RSS, idle CPU, child-process count, analysis count, snapshot rebuild count, bundle size, VSIX size, and navigation correctness.
- Run the project, 1,000-entry, and 5,000-entry LSP performance baselines when evaluating release readiness.
- Remove remaining navigation-only duplication and record durable validation evidence against the exact candidate commit.

## Out Of Scope

- Publishing a release, tag, GitHub Release, VSIX, or Marketplace package.
- Claiming untested Remote SSH, Dev Container, WSL, Codespaces, or virtual-workspace environments.
- LSP Hover, Diagnostics, Completion, References, Rename, or write operations.
- Multiple concurrently running Forma roots.
- Persisted indexes, daemonization, or general RPC migration.

## Completion Evidence

- Exact code-and-test candidate: `b8f028dc07125d8f054fa22c08737bd6b07ef094`.
- Durable correctness, lifecycle, remote-boundary, performance, resource, package, skipped-host, and residual-risk evidence is recorded in [[discovery/vscode-lsp-navigation-validation-2026-07-14]].
- The installed-VSIX smoke passed on the existing official VS Code `1.128.0` without downloading another Code.app. It covers managed link forms, native Markdown ownership, unsaved buffers, ambiguity, unresolved targets, source opening, and all current View preview types.
- Restricted Mode kept the LSP stopped and neither executed nor downloaded a CLI.
- One-, two-, and five-root discovery and lifecycle tests keep at most one active client; root removal, managed-scope configuration changes, cancellation, disposal, and stopped-client replacement are covered.
- A real process exit restarted once with navigation available. Rapid repeated exits stopped inside the bounded policy and produced an actionable Forma Output diagnostic without a restart storm. The same-root explicit-refresh gap found during validation is fixed by `afca7ed` and covered by regression tests.
- SSH-, Dev Container-, and WSL-shaped `vscode-remote` URI round trips and escape rejection pass. No live remote host was available, so Remote SSH, Dev Container, WSL, Codespaces, and virtual-workspace behavior remain explicitly unclaimed where stated in the validation record.
- Five independent installed-VSIX launches measured 93.208 ms activation p95, 86.388 ms cold Definition p95, 17.637 ms as the highest per-run warm Definition p95, 1.727 ms cold DocumentLink p95, and 3.420 ms as the highest per-run warm DocumentLink p95.
- The release LSP baseline passed for the project, 1,000 entries, and 5,000 entries. The 5,000-entry cold Definition was 175.419 ms, warm Definition p95 was 0.102 ms, connected RSS was 35.98 MiB, and idle CPU was 0%.
- The package contains 21 files, a 502,879-byte production bundle, and a 131,969-byte VSIX. `mise run check`, focused extension tests, Restricted Mode, installed-VSIX smoke, package inspection, and the full LSP baseline passed.
- No release, tag, GitHub Release, or Marketplace publication was performed.

## Acceptance Criteria

- Installed VS Code navigation passes for every accepted Forma link form, unsaved buffers, ambiguity, unresolved targets, and ordinary Markdown ownership.
- At most one Forma LSP process runs while switching among multiple discovered roots, and no stale process or provider remains after a switch.
- Remote URI conversion never opens a local-machine path, escapes the active root, or leaks a host-specific URI into Core semantics.
- Unexpected server exit recovers within the bounded restart policy and repeated failure stops with an actionable diagnostic.
- Cold navigation p95 is no more than 250 ms and warm navigation p95 is no more than 100 ms.
- One document version performs at most one Core analysis; warm navigation does not rebuild the workspace; unmanaged Markdown performs no Forma analysis.
- Connected RSS, idle CPU, process count, bundle size, and VSIX size are recorded and reviewed against the prior baseline.
- Preview, Explorer, Hover, Diagnostics, CLI installation, Workspace Trust, and native Markdown behavior show no material regression.
- `mise run check`, focused benchmarks, Extension Host validation, package inspection, and VSIX smoke pass.
- The validation record states the exact commit, editor version, CLI version, local/remote environment, checks run, checks skipped, and residual risks.
