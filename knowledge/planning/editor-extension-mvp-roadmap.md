---
scope: project
type: roadmap
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - p1
    - editor-extension
    - vscode
    - roadmap
sources:
    - "decisions/editor-extension-primary-product-surface"
    - "architecture/editor-extension-adapter-contract"
    - "design/editor-extension-mvp-design"
    - "architecture/forma-p0-operation-api-spec"
---

# Editor Extension MVP Roadmap

## Goal

Deliver a VS Code-first Forma extension that proves workspace discovery, reference navigation, and Markdown-backed view preview while keeping repository files and shared Core operations authoritative.

## Delivery Strategy

Build vertical slices in dependency order. Each slice should be usable and testable before the next preview capability is added. Do not begin by porting the WebApp shell.

## Phase 1: Extension Foundation

- Add the VS Code extension package and focused build, type-check, and test commands.
- Locate a compatible Forma binary without executing workspace-provided code in untrusted workspaces.
- Discover `.forma.md` roots for workspace folders and active documents.
- Support multi-root workspace selection.
- Invoke `config.inspect`, `workspace.health`, and `check` through structured JSON.
- Add status bar states, commands, cancellation, timeout behavior, and a Forma output channel.
- Define the operation schema compatibility check.

Exit evidence: a configured workspace reports accurate ready and error states, and no WebView is required.

## Phase 2: Reference Resolution And Navigation

- Add the shared read-only `reference.resolve` operation and its CLI/RPC/TypeScript result contract.
- Provide definition navigation for ordinary Markdown links and wikilinks.
- Add wikilink alias, fragment, and embed handling.
- Add schema-declared frontmatter reference navigation.
- Map unresolved and ambiguous results to diagnostics and candidate selection.
- Add focused Core, contract, and extension mapping tests.

Exit evidence: supported saved references navigate through Core-owned semantics without extension-side workspace parsing.

## Phase 3: View Document Preview Foundation

- Extend `view.render` with view body and mount source mapping, or introduce an equivalent shared read-only document projection.
- Add `Open View Preview`, `Open View Preview to the Side`, CodeLens, and `Open Source`.
- Render Markdown before and after the content mount.
- Establish the editor-theme-to-Forma-token bridge.
- Add save-driven refresh, cancellation, error, invalid-view, and empty states.

Exit evidence: a view remains normally editable Markdown and can display a theme-correct list or table projection beside its source.

## Phase 4: Kanban Preview

- Render configured columns, cards, subtitles, badges, icons, and empty columns.
- Add keyboard navigation and source opening.
- Validate horizontal overflow, narrow editor groups, high contrast, and theme switching.
- Keep all interactions read-only.

Exit evidence: the repository task board fixture is usable beside its Markdown source without implying write support.

## Phase 5: Packaging And CI

- Add publishable VS Code extension metadata and reproducible VSIX packaging.
- Align Cargo, binary, extension, release, and tag versions.
- Add extension checks, tests, packaging, and VSIX artifact upload to CI.
- Add the VSIX and checksum to the tag-triggered GitHub Release workflow.
- Keep Graph preview explicitly deferred rather than porting the current renderer.

Exit evidence: CI produces an installable VSIX whose manifest version matches the Forma release version.

## Phase 6: MVP Hardening And Release

- Validate extension activation, reload, multi-root behavior, missing/incompatible binary, malformed output, cancellation, and timeouts.
- Run extension-host integration tests for commands, definitions, diagnostics, source navigation, preview refresh, and theme changes.
- Document local development, packaging, installation, and manual smoke steps.
- Confirm the WebApp remains buildable and embedded serving behavior has not regressed when shared packages change.
- Validate locally, through PR CI, on merged `main`, and through the tag-triggered Release workflow.
- Verify the released binary archives and VSIX from GitHub Release.

Exit evidence: `v0.1.0-alpha.13` is published with aligned binary and VSIX artifacts and is ready for internal dogfooding.

## Cut Line

The MVP includes discovery, reference navigation, source-first view previews, editor theme integration, and read-only list/table/kanban modes. Graph is recognized but its editor renderer is deferred.

The MVP does not require unsaved-buffer semantic analysis, backlinks panels, search, write operations, AI Chat, a persistent language server, Zed support, or marketplace publishing.

## Next Executable Task

Use [[planning/editor-extension-alpha-13-execution-plan]] and its linked task chain as the executable Goal plan. [[tasks/implement-vscode-extension-mvp]] remains the umbrella task and should not compete with the first child task on the Ready board.

## Follow-Up

After VS Code internal dogfooding:

1. Review which logic is truly adapter-neutral.
2. Extract only proven shared adapter or renderer modules.
3. Reassess [[tasks/implement-zed-extension-mvp]] against actual Zed extension APIs.
4. Decide whether latency or unsaved-buffer needs justify stdio RPC, a daemon, or a language-server boundary.
5. Execute [[tasks/design-editor-graph-view-renderer]] as a separate focused project.
