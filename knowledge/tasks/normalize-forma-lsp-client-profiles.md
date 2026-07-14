---
schemaVersion: 1
scope: project
type: task
title: Normalize Forma LSP Client Profiles
summary: Separate editor-neutral Forma navigation from Zed-specific compatibility behavior before VS Code consumes the shared language server.
priority: P1
value: H
module: app
effort: S
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - lsp
    - vscode
    - zed
    - navigation
blockedBy: []
relatedTo:
    - "planning/vscode-lsp-navigation-migration-plan"
    - "architecture/editor-extension-adapter-contract"
    - "tasks/implement-forma-lsp-foundation"
    - "tasks/refine-zed-link-navigation-and-highlighting"
    - "discovery/forma-lsp-zed-navigation-validation-2026-07-13"
severity:
sprint:
reportedBy:
affectedArea: Forma LSP client-specific Definition and DocumentLink behavior
---

# Normalize Forma LSP Client Profiles

## Goal

Make the reusable language server conservative by default and express every editor-specific navigation workaround through a named client profile before VS Code attaches to it.

## Sources

- [[planning/vscode-lsp-navigation-migration-plan]]
- [[architecture/editor-extension-adapter-contract]]
- [[tasks/implement-forma-lsp-foundation]]
- [[tasks/refine-zed-link-navigation-and-highlighting]]
- [[discovery/forma-lsp-zed-navigation-validation-2026-07-13]]

## In Scope

- Capture the current ownership matrix for standard Markdown links, heading fragments, wikilinks, aliases, embeds, frontmatter references, inline code, Markdown fences, unmanaged documents, and source highlighting.
- Replace the narrow target-style switch with explicit Generic, Zed, and VS Code client behavior profiles.
- Keep `zed://file`, the bounded standard-Markdown heading fallback, and code-example DocumentLink projection limited to the Zed profile when current evidence requires them.
- Keep Generic and VS Code profiles limited to Forma-owned navigation and standard `file:` protocol targets.
- Preserve managed-document gating, dynamic controlled-scope watchers, ambiguity results, workspace boundaries, UTF-16 conversion, and no semantic-token capability.
- Add focused server and protocol tests for every profile difference.
- Run the quick LSP performance suite and compare it with the recorded Alpha 18 baseline.

## Out Of Scope

- Adding the VS Code Language Client dependency or starting a server from VS Code.
- Changing Zed source highlighting, grammar, Preview, panels, or CLI lifecycle.
- Hover, Diagnostics, Completion, References, Rename, or write operations.
- General taxonomy model changes or multiple-taxonomy composition.

## Acceptance Criteria

- Zed retains its currently accepted positionless wikilink, fragment, and code-example navigation behavior.
- VS Code and Generic profiles do not return Forma fallback results for working native standard Markdown behavior.
- Every profile returns no Forma language result for unmanaged Markdown.
- No profile advertises semantic tokens or changes source highlighting.
- Profile selection and optional initialization data are validated without trusting arbitrary workspace content.
- Focused Rust tests and `mise run perf:lsp:quick` pass without a material regression.
- `mise run check` passes.

## Implementation Evidence

Implemented on 2026-07-14 through an explicit `Generic`, `Zed`, and `Vscode` behavior profile in `forma-lsp`.

| Behavior                                       | Generic     | Zed                   | VS Code     |
| ---------------------------------------------- | ----------- | --------------------- | ----------- |
| Forma wikilinks, embeds, and schema references | Forma-owned | Forma-owned           | Forma-owned |
| Positionless resolved document target          | `file:`     | `zed://file`          | `file:`     |
| Standard Markdown links without fragments      | Host-owned  | Host-owned            | Host-owned  |
| Standard Markdown heading fallback             | Host-owned  | Narrow Forma fallback | Host-owned  |
| Inline and Markdown-fence example projection   | Disabled    | Enabled               | Disabled    |
| Unmanaged Markdown                             | Ignored     | Ignored               | Ignored     |
| Source highlighting and semantic tokens        | Host-owned  | Host-owned            | Host-owned  |

Initialization profile values are strictly decoded, must match the LSP client identity, and return `InvalidParams` during initialization when invalid. No profile reads workspace content to select editor behavior.

Verification:

- `cargo test -p forma-lsp`: 21 tests passed.
- `mise run perf:lsp:quick`: project cold 131.1 ms, warm p95 0.2 ms; 1,000-entry cold 37.0 ms, warm p95 0.1 ms.
- `mise run check`: passed.
