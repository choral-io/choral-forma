---
schemaVersion: 1
kind: release
title: "Forma v0.1.40"
summary: "Markdown formulae, semantic inline syntax, safe native disclosures, resource-link compatibility and regression reliability."
scope: project
type: release
status: planned
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

Coordinated Public Preview release following [[releases/forma-v0.1.39]]. Core, CLI, WebApp, VS Code and the aligned Zed package use version 0.1.40. The release retains the VS Code minimum at 1.123.2 and native Markdown rendering.

## Included Changes

- Support standalone one-line display formulae, math fences, explicit numeric formulae and currency boundaries, one-line highlights, and safe attribute-free mark/sub/sup tags. Preserve strikethrough semantics and readable no-script formula source.
- Support bounded native details/summary disclosures with Markdown bodies, nested content, no-script pointer/keyboard toggling, and heading/footnote-return focus restoration. Reject malformed or unsupported trees and keep attribute, script, comment, declaration and raw-text boundaries inert.
- Preserve raw static resources alongside sidecar entries, retain authored links and fallback aliases, and keep resource collection consistent with resolution.
- Use proseWrap preserve without repository-wide prose reflow. Keep shared samples formatter-compatible and move exact boundary counterexamples into shared test data.
- Validate actual per-case browser coverage for disclosures, reading syntax and callouts. Preserve complete phase journals with atomic replacement, reject interrupted overall success and retain failure causes while cleaning owned processes and temporary workspaces.

## Validation

Candidate validation is pending. Publication requires the aligned final source to pass the complete local gate, Chromium/WebKit enhanced and no-script browser regressions, native editor/packaged VSIX checks and exact-source main CI.

The candidate excludes the unrelated local WebApp dependency refresh. No Arcadia changes are included.

## Rollout Plan

1. Commit the formatter, Markdown/regression and version-preparation slices separately while retaining existing local commits.
2. Validate a clean candidate checkout with its frozen dependency lockfile.
3. Push the exact candidate, require successful main CI, and dispatch the protected Release workflow with version 0.1.40.
4. Verify published assets and production managed CLI installation, read back Marketplace identity and hash, then record completed evidence separately.

## Known Boundaries

WebApp and enhanced static rendering share semantics. Static HTML remains readable without JavaScript. VS Code keeps host Markdown parsing, Frontmatter folding, reference navigation and configured Views. Definition lists and Markdown shorthand sub/superscripts remain future candidates. Images retain ordinary Markdown rendering and authored links.

Browser regressions are a separate explicit gate. Physical mobile/gesture devices, real screen-reader announcements, native Safari, Remote SSH, Dev Container, WSL, signing, notarization and Zed Registry publication are outside this candidate's established acceptance evidence.

## Rollback Plan

Preserve immutable published tags and assets. Publish a higher coordinated version for corrections.
