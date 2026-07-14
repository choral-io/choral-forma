---
schemaVersion: 1
kind: release
title: Forma v0.1.0-alpha.18
summary: Internal alpha for editor-neutral Forma language intelligence and native Zed link navigation.
scope: project
type: release
status: planned
version: v0.1.0-alpha.18
date: 2026-07-14
owners:
    - "members/tiscs"
tags:
    - release
    - internal
    - lsp
    - zed
    - navigation
    - performance
    - validation
relatedTestCases:
    - "test-cases/forma-starter-kit"
relatedTasks:
    - "tasks/implement-forma-lsp-foundation"
    - "tasks/validate-zed-link-navigation"
    - "tasks/refine-zed-link-navigation-and-highlighting"
---

# Forma v0.1.0-alpha.18

## Purpose

Publish the first editor-neutral Forma language-intelligence transport and the validated Zed navigation slice completed after [[releases/forma-v0.1.0-alpha.17]]. This release keeps repository Markdown and Forma Core semantics authoritative while adding native editor navigation without replacing Zed's built-in Markdown grammar or ordinary Markdown behavior.

## Scope

- Add Core-owned transient document analysis with exact Markdown, wikilink, embed, heading-fragment, and schema-declared reference ranges.
- Add a reusable workspace snapshot and managed-document lifecycle that recomputes controlled scope when `.forma.md`, imports, taxonomies, terms, Views, or include patterns change.
- Add the `forma-lsp` crate and expose its stdio server as `forma --workspace <root> lsp` from the coordinated CLI binary.
- Add a Rust/WASM Zed Dev Extension that maps Core resolution into native Definition, DocumentLink, and semantic-token behavior.
- Keep plain Markdown navigation editor-owned while providing bounded Zed compatibility for managed heading links and explicit Markdown syntax inside inline code and `md` or `markdown` fences.
- Make wikilink targets and displayed aliases navigate consistently, resolve heading fragments precisely, and preserve the existing cursor position when opening an unfragmented document in Zed.
- Restrict Forma LSP overlays, requests, analysis, and snapshot rebuilds to configured Pages and Views without giving any taxonomy id special treatment.
- Validate the adapter-controlled worktree `PATH` CLI against the Zed extension version before starting the server.
- Add repeatable quick and baseline LSP benchmarks plus stronger release-version and published-asset verification.
- Keep parallel pnpm validation tasks read-only with respect to `node_modules`, so version metadata changes cannot trigger concurrent dependency reinstalls.

## Release Gates

1. `mise run version:check -- v0.1.0-alpha.18` passes.
2. `CI=true mise run check` passes from the exact aligned candidate.
3. Forma config, content checks, workspace health, and the quick LSP performance gate pass.
4. A local `forma-0.1.0-alpha.18.vsix` packages, installs, and passes the existing packaged-extension smoke test even though this release's new product slice targets Zed.
5. The Zed extension builds for `wasm32-wasip1`, rejects a mismatched adapter-controlled PATH CLI, and starts the matching CLI with `--workspace <root> lsp` in the real editor host.
6. The complete candidate is committed and pushed before main CI is evaluated.
7. Main CI passes for the exact candidate commit before the annotated tag is created.
8. The tag-triggered Release workflow publishes the exact expected archives, standalone binaries, VSIX, and sibling SHA-256 files.
9. `mise run release:verify -- v0.1.0-alpha.18` validates the published release, current-host CLI, VSIX identity, and production VS Code managed-install path.

## Known Boundaries

- The Zed extension remains an internal Dev Extension and is not published to the Zed extension registry.
- Zed CLI acquisition, checksum-managed storage, and update UX remain follow-up work; Alpha 18 requires a matching preinstalled CLI on the worktree `PATH`.
- Zed's native `lsp.forma.binary` setting is a host-level user escape hatch that bypasses the extension's command construction and version check.
- Zed Preview, Explorer panels, workspace status UI, completion, backlinks, and write operations remain outside this slice.
- The managed-document predicate is taxonomy-neutral, but this release still assumes one Page matches at most one taxonomy term; multi-taxonomy composition remains deferred.
- Zed remote-workspace URI behavior, registry packaging, Marketplace publication, signing, notarization, and Linux musl remain unverified or out of scope.
- Graph rendering remains a separate focused project.

## Validation

Local candidate validation passed on 2026-07-14:

- `mise run version:check -- v0.1.0-alpha.18` confirmed every coordinated manifest, lock entry, release record, and current-version document is aligned at `0.1.0-alpha.18`.
- `CI=true mise run check` passed after the release-aligned edits, including 22 Vitest files with 129 tests, Node release/tooling tests, the complete Rust workspace tests, formatting, linting, TypeScript checks, production builds, and the Zed `wasm32-wasip1` check.
- `mise run perf:lsp:quick` passed: the repository project measured 894.1 ms initialization, 121.1 ms cold navigation, and 0.2 ms warm p95; the generated 1,000-entry workspace measured 4.3 ms initialization, 37.0 ms cold navigation, and 0.1 ms warm p95.
- `forma-0.1.0-alpha.18.vsix` packaged 21 files and installed as `choral-io.forma@0.1.0-alpha.18` in disposable VS Code 1.110.0. The smoke test verified activation, native Markdown Document Links, Forma wikilink and semantic-reference Definitions, editable View sources, and native Markdown Preview opening.
- A real Zed host accepted the locally built `forma 0.1.0-alpha.18` through the adapter-controlled worktree `PATH`, started it from the expected resolved path with `--workspace <getting-started-workspace> lsp`, and kept the process running while the managed navigation fixture was open. The preinstalled Alpha 17 binary was restored afterward with its original SHA-256 (`1c05c318c5f1fa1c1fa49d56d98f10771eb9ce3a393653398dc663721f72301f`) and executable version verified.
- The smoke gate initially exposed a stale assertion that expected ordinary Markdown links from Forma's Definition provider. The corrected gate explicitly activates VS Code's built-in Markdown extension and verifies its resolved Document Link, preserving the non-invasive editor-enhancement boundary.
- The release-preparation gate also reproduced pnpm 11.11.0's automatic dependency verification racing across parallel `check`, `test`, and `build` tasks after version metadata changed. `verifyDepsBeforeRun: false` keeps installs explicit, and a regression assertion now protects that setting.

Exact candidate commit, main CI, Release workflow, published assets, checksums, current-host CLI, VSIX identity, and managed-install evidence remain pending and will be recorded before this release moves to `released`.

## Rollout Plan

1. Align all coordinated release versions and create this planned release record.
2. Run the complete local candidate gate, performance probe, VSIX package inspection, and packaged smoke validation.
3. Commit and push the exact candidate, then wait for main CI to pass.
4. Create annotated tag `v0.1.0-alpha.18` only on the verified candidate commit.
5. Observe the tag-triggered Release workflow and run the executable published-release verification gate.
6. Record immutable release evidence in a separate post-release commit before internal distribution.

## Migration Or Operations Notes

- Zed internal testers must place `forma 0.1.0-alpha.18` on the PATH visible to the Zed worktree and restart the Forma language server after upgrading.
- Do not configure `lsp.forma.binary` for the normal checked path; Zed applies that override before the extension callback.
- VS Code users may continue using the explicit or managed CLI lifecycle introduced in Alpha 17; coordinated versions must remain equal.

## Release Notes

> Forma `v0.1.0-alpha.18` adds editor-neutral language intelligence and the first validated Zed integration. It keeps Markdown behavior native, resolves Forma references through Core, limits work to configured content, aligns wikilink navigation and highlighting with the host editor, and preserves the coordinated CLI and extension version boundary.

## Rollback Plan

Do not move or overwrite the Alpha 18 tag after publication. If internal testing finds a blocker, stop distributing Alpha 18, record the failure, and publish a new aligned prerelease after remediation.

## Post-Release Follow-Up

- Implement user-initiated, checksum-verified Zed CLI acquisition against an already published matching release.
- Refine the remaining Zed workspace lifecycle, diagnostics, View, and project-UI scope before calling the Zed extension an MVP.
- Validate Zed remote workspace URI and binary-placement behavior when a representative environment is available.
- Resolve multi-taxonomy Page composition across Forma Core and both editor adapters as a separate product-wide task.
