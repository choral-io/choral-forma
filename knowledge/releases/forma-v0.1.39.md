---
schemaVersion: 1
kind: release
title: "Forma v0.1.39"
summary: "Markdown navigation and callouts, consistent Mermaid and Graph inspection, native editor compatibility, and browser regressions."
scope: project
type: release
status: released
version: "v0.1.39"
date: 2026-10-25
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
sources:
    - "releases/forma-v0.1.38"
---

# Forma v0.1.39

## Scope

Coordinated Public Preview release following [[releases/forma-v0.1.38]]. Core, CLI, shared projections, WebApp, VS Code and the aligned Zed package use version 0.1.39. The immutable source candidate is `a96962b150cf982298c70a8240cc1b3a7a18f148`.

## Included Changes

- Add labelled footnotes and readable heading aliases to the WebApp and static site while retaining historical anchors and authored links.
- Support NOTE, TIP, IMPORTANT, WARNING and CAUTION callouts, case-insensitive markers, custom/default titles, title-only content and native disclosure defaults. Keep ambiguous inline boundaries as ordinary quotes. Reveal folded content for heading and footnote navigation, and constrain long content without clipping focus or disclosure controls.
- Align Mermaid and Graph inspection controls, safe content lanes, modifier-wheel gestures and focus restoration. Preserve Graph selection and native interaction. Images use ordinary Markdown rendering with authored links and no Forma image viewer.
- Retain VS Code native Markdown semantics, Frontmatter folding, reference navigation and configured Views. Fix scope-inspection and preview-refresh races, recover discovery reads superseded by a scope change, and retain both assertion and cleanup failures without adding rendering takeover.
- Add shared fixtures and isolated Chromium/WebKit browser regressions covering enhanced and no-script static hosts, interaction, layout, failures and process cleanup.
- Refresh managed toolchains and dependencies. Keep the editor floor at 1.123.2 with API declarations no newer than that floor.

## Validation

The exact source candidate passed `mise run version:check -- v0.1.39` and `CI=true mise run check` on macOS arm64: 589 JavaScript tests across 87 files, 548 Rust tests, repository scripts, TypeScript, lint, formatting, builds and Zed WASI checking. The extension-specific test entrypoint, peer-dependency checks, repository content/health checks, shared validation fixtures and the getting-started workspace passed.

Chromium and WebKit passed the real WebApp, enhanced static and scripts-disabled static browser matrices. Coverage includes ordinary images and authored links, no-script behavior, Mermaid focus restoration, Graph selection, callout navigation/layout, effective failure assertions and owned-process cleanup after success, failure and interruption. These browser regressions remain a separate explicit gate.

Native trusted Extension Host tests passed on VS Code 1.123.2 and the official stable 1.143.1; restricted-mode tests passed at the minimum. The same locally packaged `choral-io.forma@0.1.39` VSIX passed disposable installation, activation and functional smoke tests on both editor versions. Its engine remains `^1.123.2`, and compilation uses `@types/vscode ~1.120.0`.

Candidate CI exposed asynchronous scope-restoration and cancelled preview-discovery reads. Focused regressions reproduced the redundant configuration write and superseded-read failure before the fixes. The final complete local gate and both native editor/package gates passed after remediation. The native Markdown contract test also resolves its fixture relative to its source file, allowing the extension-specific command to run independently of the caller's working directory.

Exact-source [main CI run 40117226090](https://github.com/choral-io/choral-forma/actions/runs/40117226090) passed for `a96962b150cf982298c70a8240cc1b3a7a18f148`, including all five CLI platform builds and the VS Code extension gate.

## Publication Evidence

- [Release workflow 40118762665](https://github.com/choral-io/choral-forma/actions/runs/40118762665) passed candidate validation, all five CLI platform builds, VSIX host tests and packaging, source-bound assembly, protected promotion, published-release verification and Marketplace publication.
- Annotated tag `v0.1.39` is tag object `117be122399bbb0d0f355aeeaf9702b913140726`, peeling to the exact source candidate above.
- [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.1.39) was published at `2026-10-24T18:26:07Z` (2026-10-25 in Asia/Kuala_Lumpur) with `draft=false`, `prerelease=false` and all 22 expected assets.
- `mise run release:verify -- v0.1.39` passed on macOS arm64. All 11 payloads matched their published SHA-256 files. The downloaded native CLI and a fresh installation through the production managed-install implementation both executed as `forma 0.1.39`; temporary verification files were cleaned.
- Native `forma-macos-arm64` SHA-256: `0dc09a5d21da18dd9d0a1610fd6f44211b1fa308451b902479837baf1df33430`.
- Published VSIX: `choral-io.forma@0.1.39`, engine `^1.123.2`, 390,046 bytes, SHA-256 `294fbaca2b20a7fca5921e2216bb2c9826c7b8ab8f9dfb7f16d6bf6e812a55da`. The GitHub asset digest matches the downloaded package.
- Marketplace publication succeeded at `2026-10-24T18:27:50Z`. Public readback through `vsce show choral-io.forma --json` found version `0.1.39`, last updated `2026-10-24T18:32:01.280Z`; its `Microsoft.VisualStudio.Services.VsixSha256` matches the GitHub asset and downloaded VSIX.

## Executed Rollout

1. Separated dependency, editor-correctness, Markdown/viewer and version-preparation changes into scoped commits.
2. Remediated the native preview failures exposed by candidate CI, repeated the complete local gates and required exact-source main CI before dispatch.
3. Dispatched the protected Release workflow with `0.1.39`; GitHub Release promotion, published-asset verification and Marketplace publication completed through their normal protected approvals.
4. Ran `mise run release:verify -- v0.1.39` and recorded the published assets, hashes, CLI/VSIX identity and managed-install result.
5. Read back the public Marketplace version and matching VSIX hash, then added the completed record to the delivery ledger as a separate post-release evidence change.

## Known Boundaries

The browser gate is separate from daily check and CI. Safari, physical gesture/mobile devices, real screen-reader announcements, Windows native host behavior, Remote SSH, Dev Container, WSL, signing, notarization and Zed Registry publication were not established by this release verification. Local macOS validation does not replace the recorded cross-platform CI evidence. Arcadia was not modified.

## Rollback Plan

Preserve the immutable tag and published assets. Publish a higher coordinated version for corrections and use the official installer as the recovery path.
