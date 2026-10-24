---
schemaVersion: 1
kind: release
title: "Forma v0.1.39"
summary: "Markdown navigation and callouts, consistent Mermaid and Graph inspection, native editor compatibility, and browser regressions."
scope: project
type: release
status: draft
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

Draft coordinated Public Preview candidate following [[releases/forma-v0.1.38]]. Preparation does not authorize commits, pushes, tags or publication. The released baseline remains v0.1.38.

## Included Changes

- Add labelled footnotes and readable heading aliases to the WebApp and static site while retaining historical anchors and authored links.
- Support NOTE, TIP, IMPORTANT, WARNING and CAUTION callouts, case-insensitive markers, custom/default titles, title-only content and native disclosure defaults. Keep ambiguous inline boundaries as ordinary quotes. Reveal folded content for heading and footnote navigation, and constrain long content without clipping focus or disclosure controls.
- Align Mermaid and Graph inspection controls, safe content lanes, modifier-wheel gestures and focus restoration. Preserve Graph selection and native interaction. Images use ordinary Markdown rendering with authored links and no Forma image viewer.
- Retain VS Code native Markdown semantics, Frontmatter folding, reference navigation and configured Views. Fix scope-inspection and preview-refresh races without adding rendering takeover.
- Add shared fixtures and isolated Chromium/WebKit browser regressions covering enhanced and no-script static hosts, interaction, layout, failures and process cleanup.
- Refresh managed toolchains and dependencies. Keep the editor floor at 1.123.2 with API declarations no newer than that floor.

## Validation

Local preparation on macOS arm64 covers version alignment, `CI=true mise run check`, the extension-specific test entrypoint, peer dependencies, repository content/health checks, shared validation fixtures and the getting-started workspace.

Chromium and WebKit passed the real WebApp, enhanced static and scripts-disabled static browser matrices. Native trusted Extension Host tests passed on VS Code 1.123.2 and the official stable 1.143.1; restricted-mode tests passed at the minimum. The same locally packaged `choral-io.forma@0.1.39` VSIX passed disposable installation, activation and functional smoke tests on both editor versions. Its engine remains `^1.123.2`, and compilation uses `@types/vscode ~1.120.0`.

Preparation also corrected the native Markdown contract test's fixture lookup to resolve relative to its source file, so the extension-specific test command works independently of the caller's working directory.

No candidate commit or publication has been created. Exact candidate main CI, cross-platform release builds, immutable release artifacts, Marketplace publication and post-release executable verification remain pending and must not be inferred from local checks.

## Rollout Plan

Review the dependency, editor-correctness, feature and release-preparation scopes separately. After maintainer confirmation, commit and push the fixed candidate, require its exact main CI, then dispatch the protected release workflow for 0.1.39. Do not move or overwrite any released tag.

## Known Boundaries

The browser gate is separate from daily check and CI. Physical gesture devices, screen readers, Windows native host behavior and packaged remote-development contexts require their own evidence. Local macOS validation cannot replace cross-platform release CI.
