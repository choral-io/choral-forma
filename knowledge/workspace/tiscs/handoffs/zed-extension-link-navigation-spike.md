---
scope: member
type: handoff
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - workspace
    - handoff
    - forma
    - zed
    - editor-extension
    - lsp
---

# Zed Extension Link Navigation Spike

## Purpose

Hand off a focused reassessment of whether to start the Forma extension for Zed now. The minimum useful result is source-mode link navigation. Markdown Preview enhancement is desirable, but it is not a gate for the first Zed implementation.

This handoff records exploration context and a proposed validation path. It does not change the canonical Zed task, accept a new transport architecture, or authorize implementation.

## Canonical Context

Read these sources before refining or starting the work:

- [Implement Zed Extension MVP](../../../tasks/implement-zed-extension-mvp.md)
- [Editor Extension Adapter Contract](../../../architecture/editor-extension-adapter-contract.md)
- [Forma Performance Engineering](../../../architecture/forma-performance-engineering.md)
- [Forma Performance Optimization Plan](../../../planning/forma-performance-optimization-plan.md)
- [Editor Extension MVP Roadmap](../../../planning/editor-extension-mvp-roadmap.md)
- [Editor Extension Primary Product Surface](../../../decisions/editor-extension-primary-product-surface.md)

Current canonical task state at handoff time:

- `status: backlog`
- `readiness: needs-refinement`
- `effort: M`
- `priority: P2`
- The VS Code MVP baseline is published, so the previous sequencing prerequisite has been met.

## Agreed Exploration Scope

The current product preference is:

1. Source-mode link navigation is the minimum deliverable.
2. Preview enhancement should be investigated, but should not block navigation.
3. CLI acquisition, download, update, and version-management UX can wait for a second stage.
4. The first validation may assume that the user has already installed the matching `forma` CLI version and that `forma` is available through the Zed worktree environment.
5. Other Zed features, including custom panels, workspace status, completion, backlinks, and richer diagnostics, can be reconsidered after the navigation path is proven.

## Zed API Findings

These findings were checked against current public Zed documentation and releases on 2026-07-13:

- Zed extensions can register language servers and locate an installed executable through the worktree environment.
- Zed supports normal LSP definition navigation, including `F12` and `Cmd+Click` or `Ctrl+Click`.
- Zed 1.5.3 added clickable document links supplied by language servers. The behavior is enabled by default and can be disabled with `lsp_document_links`.
- Existing Markdown language-server extensions demonstrate that an extension can attach language intelligence to Zed's built-in Markdown language.
- The public extension API does not currently expose a general Markdown Preview renderer hook, Webview, custom project panel, or arbitrary UI contribution surface comparable to VS Code.

External references:

- [Developing Zed extensions](https://zed.dev/docs/extensions/developing-extensions)
- [Developing Zed language extensions](https://zed.dev/docs/extensions/languages)
- [Zed navigation](https://zed.dev/docs/finding-navigating)
- [Zed 1.5.3 document-link support](https://zed.dev/releases/stable/1.5.3)
- [Markdown Oxide Zed extension](https://zed.dev/extensions/markdown-oxide)
- [Webview via Extensions issue](https://github.com/zed-industries/zed/issues/21208)

## Current Repository Evidence

The repository does not currently contain an LSP server implementation or LSP protocol dependencies. The CLI has no `forma lsp` command.

Useful existing implementation:

- `crates/forma-core/src/markdown.rs` parses Markdown links, wikilinks, embeds, headings, and body reference source spans.
- `crates/forma-core/src/operations.rs` exposes `resolve_reference` using Forma workspace discovery, semantic reference rules, ambiguity candidates, fragments, and target metadata.
- `crates/forma-core/src/index.rs` already resolves schema-aware frontmatter `entryRef` values and distinguishes them from ordinary strings such as tags.
- `packages/vscode-extension/src/navigation.ts` maps reference resolution into VS Code Definition, Hover, DocumentLink, and diagnostics.
- `packages/vscode-extension/src/reference-token.ts` currently performs editor-side token scanning, including frontmatter source ranges.

Important gaps and constraints:

- The current `resolve_reference` operation reloads and discovers the workspace for each call. That is acceptable for a narrow protocol spike only; it should not silently become the final long-running LSP architecture.
- Body references already have source spans in Rust. Schema-aware frontmatter references are resolved by Core, but the LSP still needs exact YAML scalar ranges for values such as multiple owners.
- Unsaved buffers require the LSP to use the text received through `didOpen` and `didChange`, not only the saved file on disk.
- Core semantics must stay in Rust. The Zed extension should not recreate Forma reference or schema rules.

## Proposed Fast Validation

### Phase A: Minimal Forma LSP

Add a provisional `forma lsp` stdio entrypoint. A small dedicated `forma-lsp` crate used by the CLI is preferable to placing protocol handling directly in the CLI module, but this structure remains subject to the architecture review below.

Implement only:

- `initialize` and `initialized`;
- full-text `textDocument/didOpen` and `textDocument/didChange` synchronization;
- `textDocument/definition`;
- `textDocument/documentLink` if it remains low cost;
- `shutdown` and `exit`.

For the first protocol proof:

1. Convert the document URI to a workspace-relative source path.
2. Parse the current buffer text with Forma Core.
3. Find the reference span under the requested position.
4. Resolve it with the existing Forma reference semantics.
5. Return the target file URI and the heading or block fragment location when available.

### Phase B: Minimal Zed Dev Extension

Add a small extension adapter, provisionally under `packages/zed-extension/`:

- register the Forma language server for `Markdown`;
- find `forma` in the Zed worktree environment;
- start `forma lsp`;
- return an actionable error when `forma` is unavailable;
- do not download, install, update, or select CLI versions;
- do not publish to the Zed extension registry during the spike.

Install it locally with Zed's `Install Dev Extension` workflow.

### Phase C: Real Workspace Validation

Use `examples/getting-started-workspace/` and a focused Markdown fixture. Validate source-mode navigation for:

```md
[Sam](members/sam-rivera.md)

[[members/sam-rivera]]

[[members/sam-rivera|Sam Rivera]]

[[members/sam-rivera#Background]]

![[members/sam-rivera]]
```

Validate schema-aware frontmatter navigation:

```yaml
owners:
    - members/sam-rivera
    - members/noah-kim
```

Also verify that ordinary values do not become references:

```yaml
tags:
    - members/sam-rivera
```

Expected source interactions:

- `F12` navigates through `textDocument/definition`.
- `Cmd+Click` or `Ctrl+Click` navigates through definition or document-link support.
- Each owner value has its own source range and target.
- A unique reference opens the canonical Markdown file.
- A fragment opens the target location.
- An unresolved reference does not crash or open an arbitrary file.
- An ambiguous reference returns candidates rather than choosing silently.
- Unsaved source changes are used by navigation.

## Preview Investigation Boundary

Do not build a second custom preview during this spike.

Record only:

- whether ordinary Markdown links remain functional in Zed's native Preview;
- whether wikilinks remain unrendered there;
- whether LSP document links affect only source buffers, as expected;
- whether Zed has added a documented, stable Preview extension point since this handoff was written.

If no stable Preview extension point exists, defer rendering enhancement. A CLI-generated secondary Markdown file may be explored separately, but it should not be accepted as the long-term native Preview integration without product review.

## Architecture Review Required Before Implementation

The existing performance guidance says a persistent stdio RPC process, daemon, or language server should be introduced only when measurement shows that process startup, repeated snapshot construction, remote round trips, or unsaved-buffer analysis justify the lifecycle cost.

Zed creates a new pressure: its public extension surface uses a language server as the standard path for editor-native definition and document-link behavior. The main conversation should decide whether this constitutes sufficient product evidence for a narrowly scoped LSP, or whether the performance transport decision must be completed first.

Review these questions:

1. Should `forma lsp` be accepted as an editor-neutral language-intelligence transport while CLI/RPC operations remain authoritative for Explorer, health, and view rendering?
2. Should the implementation live in a reusable `forma-lsp` crate while the single published `forma` binary exposes the `lsp` subcommand?
3. Should VS Code later migrate Definition, Hover, DocumentLink, diagnostics, completion, and references to the same LSP?
4. What in-memory workspace snapshot and invalidation model is required before the spike becomes production code?
5. Is Zed 1.5.3 the appropriate minimum version because it introduced LSP document links?
6. Should frontmatter source-range mapping be added to Forma Core so every editor shares it, rather than reimplemented in each adapter?
7. Does the canonical Zed task need its scope and acceptance criteria updated before implementation begins?

## Performance Evidence To Record

Even for the narrow spike, record:

- CLI/LSP initialization time;
- first and repeated definition latency;
- small realistic workspace entry count;
- whether each definition request rebuilds the complete workspace;
- idle CPU and memory while the LSP is connected;
- behavior after editing `.forma.md`, imports, taxonomy definitions, and include patterns;
- behavior when the LSP process exits and Zed restarts it.

Use the existing budgets as context rather than silently redefining them:

- cached editor link navigation p95: no more than 100 ms;
- cold editor link navigation p95: no more than 250 ms;
- background analysis: at most one core analysis per document version.

## Suggested Stop Conditions

Stop and reassess rather than broadening the spike when:

- a Zed extension cannot reliably attach the server to built-in Markdown;
- Zed does not pass sufficient workspace or document context to resolve Forma roots safely;
- frontmatter navigation would require duplicating schema semantics outside Core;
- a basic definition request exceeds the current interaction budget because it repeatedly rebuilds the workspace;
- the implementation begins to require Preview, custom UI, CLI acquisition, task-state changes, or write operations.

## Acceptance Criteria

The technical validation is successful when:

- Zed starts a preinstalled matching `forma` binary in LSP mode;
- a real Markdown link and wikilink in a Forma-controlled document navigate to canonical source;
- at least one multi-owner frontmatter reference is identified by schema and navigates correctly;
- a string-valued tag with the same text is not treated as a reference;
- fragment, unresolved, ambiguous, and unsaved-buffer behavior are recorded;
- protocol logs contain no material LSP errors;
- measured latency and resource observations are reported;
- no CLI management, Marketplace publication, custom Preview, or duplicated Core semantics are introduced.

## Next Action

In the main conversation, inspect this handoff together with the canonical Zed task and performance transport rules. Decide whether to:

1. refine and start the narrow navigation spike now;
2. update the architecture and task first, then start;
3. defer Zed until the planned transport performance decision is complete.

## Response

Accepted in the main conversation on 2026-07-13. The implementation is split into a reusable `forma-lsp` foundation and a focused Zed link-navigation validation. The canonical execution sequence is recorded in [[planning/forma-lsp-zed-navigation-execution-plan]].
