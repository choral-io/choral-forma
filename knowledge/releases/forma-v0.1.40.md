---
schemaVersion: 1
kind: release
title: "Forma v0.1.40"
summary: "Markdown formulae, semantic inline syntax, safe native disclosures, resource-link compatibility and regression reliability."
scope: project
type: release
status: released
version: "v0.1.40"
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
    - "releases/forma-v0.1.39"
---

# Forma v0.1.40

## Scope

Coordinated Public Preview release following [[releases/forma-v0.1.39]]. Core, CLI, WebApp, VS Code and the aligned Zed package use version 0.1.40. The immutable source candidate is `e432c56f6d7b64091deb3108b2d10f6653164644`. The release retains the VS Code minimum at 1.123.2 and native Markdown rendering.

## Included Changes

- Support standalone one-line display formulae, math fences, explicit numeric formulae and currency boundaries, one-line highlights, and safe attribute-free mark/sub/sup tags. Preserve strikethrough semantics and readable no-script formula source.
- Support bounded native details/summary disclosures with Markdown bodies, nested content, no-script pointer/keyboard toggling, and heading/footnote-return focus restoration. Reject malformed or unsupported trees and keep attribute, script, comment, declaration and raw-text boundaries inert.
- Preserve raw static resources alongside sidecar entries, retain authored links and fallback aliases, and keep resource collection consistent with resolution.
- Use proseWrap preserve without repository-wide prose reflow. Keep shared samples formatter-compatible and move exact boundary counterexamples into shared test data.
- Validate actual per-case browser coverage for disclosures, reading syntax and callouts. Preserve complete phase journals with atomic replacement, reject interrupted overall success and retain failure causes while cleaning owned processes and temporary workspaces.

## Validation

The exact candidate passed `mise run version:check -- v0.1.40` and `CI=true mise run check` in a clean isolated checkout installed from the committed frozen dependency lockfile. Local acceptance included 793 frontend tests, 87 repository script tests, 558 Rust tests, TypeScript, lint, formatting, builds, and the Zed WASI check. Forma content and workspace-health checks both reported zero errors and warnings.

Chromium and WebKit each completed all six browser phases and 23 check groups. Per-case records cover 96 native-disclosure, 56 P1-reading and 14 exact-callout cases across enhanced WebApp/static and no-script static hosts. Acceptance includes ordinary images and authored links, safe disclosure boundaries, native keyboard/pointer toggling, heading/footnote focus restoration, Mermaid focus restoration and Graph selection. Owned browser/backend processes and temporary workspaces were cleaned after success. Independent failure, SIGINT/SIGTERM and incomplete-coverage injections rejected false success and verified process cleanup; atomic-write tests preserved prior complete journals on write failure and removed interrupted overall-success records.

Native trusted Extension Host tests passed on minimum VS Code 1.123.2 and official stable 1.143.1; restricted-mode checks passed at the minimum. The same locally packaged `choral-io.forma@0.1.40` VSIX passed disposable installation, activation and functional checks on both editor versions. The engine remains `^1.123.2`; API declarations remain `@types/vscode ~1.120.0`.

Exact-source [main CI run 40198105722](https://github.com/choral-io/choral-forma/actions/runs/40198105722) passed for the candidate, including all five CLI platform builds, native editor/package gates and site deployment.

## Publication Evidence

- [Release workflow 40199036193](https://github.com/choral-io/choral-forma/actions/runs/40199036193) passed exact-candidate validation, all five CLI platform builds, VSIX host tests and packaging, source-bound asset assembly, protected promotion, published-release verification and Marketplace publication. Existing protection rules were retained.
- Annotated tag `v0.1.40` is tag object `0e334bd6083ca3776dff1a24af2c5a5b6c2b2b76`, peeling to the exact source candidate above.
- [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.1.40) was published at `2026-10-25T13:59:14Z` with `draft=false`, `prerelease=false` and all 22 expected assets.
- `mise run release:verify -- v0.1.40` passed on macOS arm64. All 11 payloads matched their published SHA-256 files. The downloaded native CLI and a fresh installation through the production managed-install implementation both executed as `forma 0.1.40`; temporary downloads and managed storage were cleaned.
- Native `forma-macos-arm64` SHA-256: `67a38a975e6e4bc8a7649a2a7f05cebad0199b0c85de5a59be3dfbdc18de84d3`.
- Published VSIX: `choral-io.forma@0.1.40`, engine `^1.123.2`, 390,302 bytes, SHA-256 `25e9b4f9d86f9b7a05788615a1b7763b6cef2d49fbbbd49b476df7f0ee3c1372`. The GitHub asset digest matches the downloaded package.
- Marketplace publication succeeded through the protected workflow. Public readback through `vsce show choral-io.forma --json` found 0.1.40 as the latest version, last updated `2026-10-25T14:04:57.460Z`; its `Microsoft.VisualStudio.Services.VsixSha256` matches the GitHub asset and downloaded VSIX.

## Executed Rollout

1. Preserved the existing nine local Markdown/resource-link commits and separated formatter/test maintenance, native disclosures/browser coverage, and version preparation into three further commits.
2. Validated the frozen candidate independently of unrelated local dependency edits, then required successful exact-source main CI before dispatching the release.
3. Published through the normal protected Release and Marketplace approvals without moving an existing tag.
4. Verified published assets, CLI/VSIX identities, managed installation and public Marketplace hash readback.
5. Recorded completed release evidence and the maintained delivery-ledger reference separately from the immutable candidate.

## Known Boundaries

WebApp and enhanced static rendering share semantics. Static HTML remains readable without JavaScript. VS Code keeps host Markdown parsing, Frontmatter folding, reference navigation and configured Views. Definition lists and Markdown shorthand sub/superscripts remain future candidates. Images retain ordinary Markdown rendering and authored links.

Browser regressions are a separate explicit gate. Physical mobile/gesture devices, real screen-reader announcements, native Safari, Remote SSH, Dev Container, WSL, signing, notarization and Zed Registry publication are outside this candidate's established acceptance evidence.

## Rollback Plan

Preserve immutable published tags and assets. Publish a higher coordinated version for corrections.
