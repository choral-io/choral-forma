---
schemaVersion: 1
kind: plan
title: Editor Extension Alpha 13 Goal Execution Plan
summary: One-Goal execution plan for delivering and releasing the first installable Choral Forma VS Code extension with aligned Forma versioning.
scope: project
type: execution-plan
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - vscode
    - editor-extension
    - goal
    - release
    - alpha-13
sources:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/editor-extension-adapter-contract"
    - "design/editor-extension-mvp-design"
    - "planning/editor-extension-mvp-roadmap"
    - "releases/next-internal-release"
---

# Editor Extension Alpha 13 Goal Execution Plan

## Objective

Deliver `v0.1.0-alpha.13` as the first internally testable Forma release that includes an installable Choral Forma VS Code extension. The same release version must identify the Forma binary, Cargo workspace packages, VS Code extension manifest, Git tag, release record, and GitHub Release artifacts.

The extension must discover preinstalled Forma, navigate repository-backed references, and preview Markdown-backed list, table, and kanban views while keeping source Markdown directly editable. Graph preview is explicitly deferred to a later focused project.

## Confirmed Product Choices

- The first release target is VS Code Desktop with a Node-based workspace extension.
- The extension id is `choral-io.choral-forma`; the display name is `Choral Forma`.
- Users install the Forma binary separately. The extension does not bundle or automatically download it.
- The extension discovers `forma` through an explicit user setting and `PATH`, then verifies compatibility.
- The minimum VS Code version is selected from the APIs actually used. Do not pin to the newest release and do not add compatibility work for versions below that feature floor.
- The extension should be remote-compatible at low incremental cost by running as `extensionKind: ["workspace"]`. Local workspaces are the release gate; one feasible remote smoke is desirable, but a full Remote SSH, Dev Containers, and WSL matrix is not a release blocker.
- View source opens as ordinary Markdown. Preview is a derived, read-only surface.
- Alpha 13 includes list, table, and kanban preview. Graph view definitions receive a clear deferred/unsupported preview state rather than the current fixed-circle renderer.
- The distributable `.vsix` is built by GitHub Actions and attached to the GitHub prerelease together with the binary archives.
- The release uses a branch and PR. When required checks pass and no required human review blocks it, the Goal may merge the PR, push `v0.1.0-alpha.13`, monitor the Release workflow, and verify the published artifacts.

## Preconditions

Before starting the Goal:

1. Commit the current pnpm and Cargo dependency updates plus existing TypeScript and CSS cleanup separately from editor-extension work.
2. Commit this accepted product, architecture, design, planning, and task preparation.
3. Confirm `main` is synchronized with `origin/main` and the working tree is clean.
4. Confirm GitHub authentication can push a `codex/` branch, create and merge a PR, inspect Actions, and push a tag.
5. Expect network approval for dependency installation, VS Code Extension Host downloads, GitHub operations, and CI/release monitoring.

The Goal must not reset, overwrite, or fold unrelated pre-Goal changes into editor-extension commits.

## Goal Objective Text

Use this objective when starting Goal mode:

> Implement and release Choral Forma `v0.1.0-alpha.13` according to `knowledge/planning/editor-extension-alpha-13-execution-plan.md`. Complete the linked task chain in dependency order, update task and release evidence as work progresses, create reviewable commits on `codex/vscode-extension-alpha13`, push a PR, repair CI until it passes, merge when no required human review blocks it, tag `v0.1.0-alpha.13`, wait for the Release workflow, and verify the binary archives and VSIX in the GitHub prerelease. Preserve unrelated work and stop only on a genuine authorization, required-review, or external-service blocker.

## Task Chain

| Order | Task | Outcome |
| --- | --- | --- |
| 1 | [[tasks/scaffold-vscode-extension-package]] | Buildable and testable workspace-extension package |
| 2 | [[tasks/implement-editor-extension-forma-command-client]] | Preinstalled binary discovery and structured process client |
| 3 | [[tasks/implement-vscode-forma-workspace-foundation]] | Workspace discovery, trust, remote-compatible lifecycle, status and commands |
| 4 | [[tasks/implement-forma-reference-resolve-operation]] | Shared Core/RPC/CLI reference resolution contract |
| 5 | [[tasks/implement-vscode-reference-navigation]] | Markdown, wikilink, embed and semantic-reference navigation |
| 6 | [[tasks/extend-view-render-for-editor-preview]] | View body and mount source mapping in shared results |
| 7 | [[tasks/implement-vscode-view-preview]] | Source-first themed list, table and kanban previews |
| 8 | [[tasks/align-forma-release-versioning]] | One validated version across all release artifacts |
| 9 | [[tasks/package-vscode-extension-vsix]] | Reproducible VSIX package and local install smoke |
| 10 | [[tasks/integrate-vsix-ci-release-artifact]] | CI and Release workflows build, test and publish VSIX |
| 11 | [[tasks/validate-and-release-forma-alpha-13]] | Local validation, PR CI, merge, tag, release and artifact verification |

[[tasks/design-editor-graph-view-renderer]] is a follow-up and is not part of this Goal.

## Implementation Boundaries

### Extension Package

Create `packages/vscode-extension` as `@choral-forma/vscode-extension`. It is a Node extension with a `main` entrypoint, `extensionKind: ["workspace"]`, limited untrusted-workspace support, and no browser entrypoint. Use esbuild for the runtime bundle and TypeScript for type checking. The `vscode` module remains external.

Pure modules use the repository's Vitest baseline. Extension Host integration uses the current official `@vscode/test-cli` and `@vscode/test-electron` path. The selected `engines.vscode` floor must be justified by an API inventory and validated against both that minimum and current stable when feasible.

### Forma Process Boundary

The extension uses a preinstalled binary. Lookup order is:

1. An explicit user-level `forma.path` setting.
2. `forma` from the extension host's `PATH`.

Workspace-provided binary paths and untrusted workspace configuration must not trigger execution. The process client owns cancellation, timeouts, bounded output, structured JSON parsing, exit handling, and operation schema compatibility. It runs where the workspace extension host runs, which keeps local and remote paths aligned.

### Reference Navigation

Core owns target resolution. The extension may recognize the token under the cursor, but it must call `reference.resolve` for canonical path, fragment, ambiguity, and diagnostics. The release covers ordinary Markdown links, wikilinks, aliases, heading fragments, embeds, and schema-declared semantic references. Automatic rename or reference rewriting is excluded.

### View Preview

The normal Markdown editor remains the default source surface. The extension provides Preview and Preview to the Side, renders Markdown around the Forma content mount, follows VS Code theme and font tokens, refreshes on save, and opens source entries from rendered items.

The release supports list, table, and kanban modes. A graph view renders an intentional deferred state with a link back to source and diagnostics when applicable. Do not port the current WebApp graph renderer or select a new graph engine in this Goal.

### Release And Versioning

Use `0.1.0-alpha.13` without the leading `v` inside Cargo and package manifests. Use `v0.1.0-alpha.13` for the Git tag and release record. Add a machine check that fails when the Cargo workspace version, extension version, expected release version, or tag disagree.

GitHub Actions must build the VSIX. Pull-request CI should check, build, test, package, and upload a short-lived VSIX workflow artifact. The tag-triggered Release workflow should rebuild the VSIX, generate a checksum, and add both files to the GitHub prerelease alongside the existing platform binary archives.

## Validation Matrix

### Local Before Push

- `forma check --json`
- `forma workspace health --json`
- package-specific extension type check, unit tests, bundle build and package-content check;
- Core, RPC, CLI and shared-contract focused tests for new operations;
- Extension Host tests using a controlled fixture and preinstalled development Forma binary;
- local VSIX packaging to a disposable path and install/activation smoke in an isolated VS Code profile;
- `CI=true mise run check`;
- `git diff --check`;
- manual source/preview smoke for workspace state, links, list, table, kanban, theme switching and Graph deferred state.

### PR CI

- Knowledge formatting;
- web/shared/extension checks and builds;
- extension unit and Extension Host tests;
- Rust formatting, checks and tests;
- version-consistency check;
- VSIX packaging and workflow-artifact upload.

### Release Verification

- PR checks pass and the merged `main` CI run passes;
- tag is `v0.1.0-alpha.13` at the intended merge commit;
- Release workflow succeeds for all binary targets and the extension package;
- GitHub prerelease contains every expected archive, checksum, `.vsix`, and VSIX checksum;
- released binary reports `forma 0.1.0-alpha.13`;
- VSIX manifest reports `0.1.0-alpha.13` and extension id `choral-io.choral-forma`;
- installation from the downloaded GitHub Release VSIX succeeds in an isolated VS Code profile;
- release record and task states reflect verified evidence rather than planned claims.

## Commit Plan

Use reviewable commits such as:

1. `feat: add VS Code extension foundation`
2. `feat: add Forma reference resolution`
3. `feat: add VS Code reference navigation`
4. `feat: add editor view preview`
5. `ci: package VS Code extension release artifact`
6. `docs: prepare Forma alpha 13 release`

Adjust boundaries when implementation evidence warrants it, but do not mix unrelated dependency cleanup into these commits.

## Stop Conditions

The Goal should continue through ordinary test failures, CI failures, packaging defects, and implementation rework. Stop only when:

- required human review or branch protection prevents merge;
- credentials or permissions cannot push, create a PR, merge, tag, or read Actions;
- an external service remains unavailable after reasonable retries;
- completing the release would require broadening product scope beyond this plan;
- a destructive or security-sensitive action requires new authorization.

## External References

- [VS Code Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [VS Code Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)
- [VS Code Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [VS Code Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust)
- [VS Code Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)
