---
scope: project
type: technical-assessment
title: Forma LSP And Zed Navigation Validation — 2026-07-13
summary: Records automated and real-editor correctness, performance, resource, packaging, navigation, and wikilink highlighting evidence for the first Forma LSP and Zed slice.
owners:
    - "members/tiscs"
tags:
    - discovery
    - lsp
    - zed
    - performance
    - validation
sources:
    - "architecture/editor-extension-adapter-contract"
    - "architecture/forma-performance-engineering"
    - "planning/forma-lsp-zed-navigation-execution-plan"
    - "planning/forma-link-navigation-and-highlighting-refinement-plan"
    - "tasks/implement-forma-lsp-foundation"
    - "tasks/refine-zed-link-navigation-and-highlighting"
    - "tasks/validate-zed-link-navigation"
---

# Forma LSP And Zed Navigation Validation — 2026-07-13

## Outcome

The editor-neutral LSP foundation is complete and passes the automated delivery gates. Core owns transient reference semantics, the long-lived session reuses a rebuildable in-memory snapshot, and the Zed extension remains a thin WASM adapter that invokes `forma lsp` from the worktree environment.

The measured implementation stays inside the accepted interaction budgets through the 5,000-entry fixture. Warm Definition p95 remains below 0.2 ms, connected RSS remains below 33 MiB, and the server performs no intentional idle CPU work on the measured host.

The local Zed Dev Extension was built, installed, cold-started, restarted, and exercised in `examples/getting-started-workspace/`. Navigation, unsaved overlays, ambiguity handling, restart recovery, and theme-aligned wikilink highlighting all passed. [[tasks/validate-zed-link-navigation]] and the follow-up [[tasks/refine-zed-link-navigation-and-highlighting]] are complete.

## Validated Behavior

Automated Core and protocol tests cover:

- Markdown links and images, wikilinks, aliases, embeds, and heading fragments;
- schema-declared frontmatter references, including multiple owners, nested and repeated values, comments, quoted values, and CRLF;
- ordinary frontmatter strings that resemble paths without becoming references;
- unresolved targets, multiple ambiguity candidates, external links, and local non-Markdown resources;
- UTF-16 positions with Chinese text and surrogate-pair emoji;
- full-text `didOpen`, `didChange`, `didSave`, and `didClose` overlays;
- full-document semantic tokens for wikilink and embed targets, with UTF-16 ranges;
- workspace-boundary rejection, malformed-request recovery, shutdown, exit, and process restart;
- one document analysis per overlay version and snapshot reuse across warm requests.

The persistent validation fixture is `examples/getting-started-workspace/tasks/validate-editor-link-navigation.md`. The example workspace passes `forma check --json` with no diagnostics.

## Real Zed Evidence

The Dev Extension compiled to WASM and installed locally in Zed. After a full editor restart, Zed resolved the preinstalled matching `0.1.0-alpha.17` CLI from the global mise installation, started it with the example workspace root, and reported no Forma LSP errors. Unrelated edit-prediction requests continued to report HTTP 403 and are not caused by Forma.

Direct source-mode checks passed for:

- both values in the multi-owner frontmatter list;
- relative Markdown links and heading fragments;
- ordinary, aliased, and heading-fragment wikilinks;
- Obsidian-style embeds;
- ordinary frontmatter strings and fenced examples remaining inert;
- an unsaved wikilink resolving immediately through the document overlay;
- an unresolved unsaved reference remaining in place;
- an ambiguous basename opening Zed's Definitions multibuffer with both candidates;
- navigation continuing after `editor: restart language server` and after a full Zed restart.

Zed's native Markdown Tree-sitter query classifies wikilink targets as `text.literal.markup`, which the active theme renders like emphasized link text. Forma now returns five explicit semantic roles for wikilink and embed syntax: delimiter, target, fragment, label, and embed marker. The example workspace maps those roles to theme scopes instead of fixed colors through `.zed/settings.json`; the extension README documents the required workspace setting. Opening and closing brackets therefore share one punctuation style, wikilinks and embeds share target and label styles, and only the leading `!` receives the marker style. With Markdown semantic tokens in `combined` mode, the syntax follows the active theme.

## Link And Managed-Scope Refinement — 2026-07-14

Core now classifies Markdown sources as managed content, configured Views, control files, or unmanaged files. Managed content is the taxonomy-neutral union of all effective taxonomy-term `include` patterns; no taxonomy id, including `spaces`, receives special handling. This iteration assumes one Page matches at most one taxonomy term and defers multi-taxonomy composition to [[tasks/generalize-taxonomy-neutral-page-model]].

The long-lived session and LSP apply that classification consistently:

- only managed Pages and Views are stored and analyzed as open-document overlays;
- requests for unmanaged Markdown return no Forma definitions, document links, or semantic tokens;
- saved root configuration, imports, taxonomy/term definitions, View sources, and include changes rebuild the effective scope and reclassify open documents;
- dynamic `workspace/didChangeWatchedFiles` registrations follow scope-affecting configuration sources, configured View paths, and managed include patterns and are replaced when configuration changes;
- a save followed by the editor's duplicate changed-file notification is coalesced, while changes outside managed scope do not rebuild the snapshot;
- an invalid configuration refresh preserves the last valid snapshot instead of temporarily dropping navigation.

Reference parsing now preserves separate full-syntax, target, fragment, and label spans, including UTF-16-safe positions for CRLF and non-ASCII content. Navigation ownership is explicit:

- native Markdown links and images remain editor-owned and receive no competing Forma Definition result;
- wikilink and embed targets, fragments, and labels resolve through the same Core destination;
- opening/closing brackets, alias separators, and the embed marker are not clickable;
- internal Forma references are owned by Definition, while DocumentLink remains available only for external or local-resource targets;
- resolved heading links select a non-empty heading range, and unresolved headings do not silently fall back to the start of the file;
- explicit-path wikilinks work for managed Pages under any taxonomy, while generic basename/title lookup remains intentionally deferred.

Focused Core and protocol tests cover unmanaged request gating, configured View overlays and save behavior, failed-refresh snapshot preservation, reclassification after configuration changes, post-`initialized` watcher registration and replacement, save deduplication, Definition versus DocumentLink ownership, alias and fragment activation, delimiter exclusion, and semantic-token roles. VS Code adapter tests confirm that native Markdown links remain native while wikilink targets and aliases share the resolved target.

Real Zed checks used the current locally built CLI through the installed `0.1.0-alpha.17` mise path. Clicking an aliased wikilink opened the same member document as its path, and a heading alias selected the non-empty `Sam Rivera` heading range. Forma returned no Definition for a standard Markdown link, leaving it to Zed's native Markdown command-click path. Source highlighting was visually checked by previewing Ayu Light and then restoring Ayu Dark without persisting a theme change; all five roles remained theme-derived in both themes.

## Performance Evidence

The baseline used the release `forma` binary, 50 warm repetitions, the current project workspace, and generated 1,000- and 5,000-entry workspaces.

| Workspace | Initialize | Cold Definition | Warm Definition p95 | Warm DocumentLink p95 | Connected RSS | Idle CPU |
| --------- | ---------: | --------------: | ------------------: | --------------------: | ------------: | -------: |
| Project   |    4.36 ms |        95.59 ms |             0.15 ms |               0.05 ms |     26.34 MiB |       0% |
| 1,000     |    4.04 ms |        38.55 ms |             0.10 ms |               0.08 ms |     15.67 MiB |       0% |
| 5,000     |    3.99 ms |       183.04 ms |             0.15 ms |               0.11 ms |     32.31 MiB |       0% |

The 5,000-entry cold Definition result is below the 250 ms cold gate. All warm results are well below the 100 ms gate. The one-second idle CPU-time delta was zero for all measured workspaces.

The benchmark is reproducible through:

- `mise run perf:lsp:quick`
- `mise run perf:lsp:baseline`

Generated JSON evidence remains under `target/performance/` and is intentionally not committed.

The refinement quick benchmark remained within the same performance envelope and improved the project cold path relative to its immediate pre-change quick baseline:

| Quick workspace | Pre-change initialize | Refined initialize | Pre-change cold Definition | Refined cold Definition | Pre-change warm p95 | Refined warm p95 |
| --- | --: | --: | --: | --: | --: | --: |
| Project | 895.2 ms | 834.1 ms | 123.2 ms | 106.3 ms | 0.2 ms | 0.2 ms |
| 1,000 | 4.0 ms | 4.1 ms | 39.3 ms | 39.0 ms | 0.1 ms | 0.1 ms |

The quick sample is a regression signal rather than a statistically controlled benchmark. It shows no material warm-path or 1,000-entry regression, while managed-scope gating removes analysis and rebuild work for unrelated Markdown.

## Verification Commands

- `cargo test -p forma-core -p forma-lsp --locked`
- `cargo check -p forma-zed-extension --target wasm32-wasip1`
- `node scripts/lsp-performance-benchmark.mjs --mode baseline`
- `mise run perf:lsp:quick`
- `forma --workspace examples/getting-started-workspace check --json`
- `CI=true mise run check`
- `node scripts/check-release-version.mjs`

The aggregate check includes Rust formatting, compilation and workspace tests; TypeScript checks, lint, builds and tests; release-version normalization tests; and the Zed WASM check. `CI=true` supplies pnpm's required non-interactive purge behavior in the Agent environment and does not relax the project checks.

## Residual Zed Constraints

- Zed keeps semantic tokens off by default. Workspaces must enable `combined` mode for Markdown to receive Forma's theme-aligned wikilink syntax styling.
- The current Zed extension manifest registers Forma for the built-in Markdown language. It cannot express an activation condition based on the presence of `.forma.md`, so Zed may still ask the adapter to start in non-Forma Markdown worktrees. Core and LSP managed-scope gating prevents document work when no managed Page or View exists, but avoiding process startup itself remains an editor-adapter concern.
- Dynamic watcher registration and replacement are protocol-tested. The real-editor pass exercised navigation, highlighting, CLI restart, and full Zed restart rather than instrumenting Zed's file-watch traffic.
- The Dev Extension requires a matching preinstalled CLI. CLI acquisition, registry publication, Preview, and additional project UI remain outside this validation slice.
