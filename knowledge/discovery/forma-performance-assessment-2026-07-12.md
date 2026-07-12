---
scope: project
type: technical-assessment
title: Forma Performance Assessment — 2026-07-12
summary: Measured CLI latency, memory, output growth, and VS Code adapter fan-out risks before formal performance optimization work.
owners:
    - "members/tiscs"
tags:
    - discovery
    - performance
    - benchmark
    - rust
    - vscode
sources:
    - "architecture/forma-core-technical-direction"
    - "architecture/editor-extension-adapter-contract"
    - "planning/editor-extension-mvp-roadmap"
---

# Forma Performance Assessment — 2026-07-12

## Outcome

The Rust core is not the primary current performance risk. Release-mode measurements show approximately linear behavior through 5,000 controlled Markdown entries, with practical single-process latency and memory.

The highest-priority risks are adapter and operation architecture:

1. VS Code background validation and Markdown Preview can each start up to 25 independent reference-resolution processes for one document.
2. Core operations can load configuration and rebuild the workspace read model more than once in a single invocation.
3. Dashboard JSON grows linearly and exceeds the VS Code extension's 1 MiB process-output limit before the 5,000-entry scale point.
4. Refresh triggers and caches need shared scheduling and lifecycle bounds.

The assessment does not justify replacing Rust, compiling the core to WebAssembly, introducing a database, or adding a persistent index. The next work should remove N+1 process invocation, reduce duplicate analysis, and introduce compact or paginated Explorer data.

The lasting budgets and rules derived from this assessment are captured in [[architecture/forma-performance-engineering]].

## Assessment Scope

The assessment covered:

- release-mode Forma CLI operations;
- the current Choral Forma project workspace;
- synthetic 100, 500, 1,000, and 5,000-entry workspaces;
- CLI latency, output size, and selected peak-memory measurements;
- concurrent reference-resolution behavior;
- VS Code extension process fan-out, output buffering, caching, watcher, and refresh paths;
- existing architecture constraints around short-lived CLI calls and non-persisted indexes.

It did not measure an end-to-end VS Code UI interaction trace, VS Code Remote, cold filesystem cache, Windows, Linux, network filesystems, or workspaces above 5,000 entries.

## Test Context

| Field             | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| Date              | 2026-07-12                                                                  |
| Host architecture | `arm64`                                                                     |
| macOS             | `26.5.2`                                                                    |
| Rust              | `rustc 1.96.0 (ac68faa20 2026-05-25)`                                       |
| Node.js           | `v24.18.0`                                                                  |
| Git commit        | `5b8f787defc6`                                                              |
| Worktree          | dirty; measurements include uncommitted scoped-discovery and editor changes |
| Binary            | `cargo build --release --locked --bin forma`                                |
| Forma version     | `0.1.0-alpha.15`                                                            |

Because the worktree was dirty, this is an implementation assessment rather than an immutable release baseline. Repeat the suite after the relevant changes are committed and record the commit identifier.

## Method

Each command received one unreported warm-up run. The normal measurements then used seven samples; the 5,000-entry fixture used four samples to keep the assessment short. Reported p95 for four samples is therefore close to the maximum observed value and should not be treated as a statistically stable CI threshold.

The synthetic fixture used:

- one explicit `.forma.md`;
- one `spaces` taxonomy;
- one `notes` taxonomy term with `notes/**/*.md` include scope;
- one list view;
- simple Markdown frontmatter;
- one wikilink from each note to the preceding note.

The realistic repository measurement used the current project workspace with 135 discovered entries, two views, multiple configured spaces and schemas, and its real reference and diagnostic workload.

## Current Project Workspace Results

| Operation             | p50      | p95      | Minimum  | JSON output |
| --------------------- | -------- | -------- | -------- | ----------- |
| `config inspect`      | 10.9 ms  | 15.5 ms  | 10.0 ms  | 25,252 B    |
| `workspace dashboard` | 194.7 ms | 198.0 ms | 191.9 ms | 133,988 B   |
| `inspect`             | 94.1 ms  | 96.0 ms  | 92.5 ms  | 1,067 B     |
| `reference resolve`   | 92.2 ms  | 102.6 ms | 89.5 ms  | 396 B       |
| `view render`         | 159.8 ms | 161.8 ms | 158.3 ms | 45,048 B    |

Selected peak resident memory:

- Project dashboard: 27,213,824 bytes, approximately 26.0 MiB.
- Project reference resolve: 25,493,504 bytes, approximately 24.3 MiB.

The realistic 135-entry workspace is slower than the minimal 1,000-entry fixture. Entry count alone is therefore not a sufficient scale measure. Schema count, reference density, Markdown complexity, diagnostics, taxonomies, views, file inventory, and result projection all contribute materially.

## Synthetic Scale Results

### Latency

| Entries | Dashboard p50 / p95 | Inspect p50 / p95 | Resolve p50 / p95 | View p50 / p95   |
| ------: | ------------------- | ----------------- | ----------------- | ---------------- |
|     100 | 12.0 / 12.3 ms      | 8.7 / 8.9 ms      | 8.9 / 9.2 ms      | 11.2 / 11.7 ms   |
|     500 | 35.1 / 37.8 ms      | 20.6 / 21.0 ms    | 20.8 / 21.1 ms    | 31.6 / 34.5 ms   |
|   1,000 | 65.2 / 67.1 ms      | 36.1 / 40.2 ms    | 35.3 / 36.7 ms    | 58.0 / 59.1 ms   |
|   5,000 | 358.7 / 391.3 ms    | 170.1 / 174.7 ms  | 164.5 / 165.5 ms  | 287.0 / 288.2 ms |

The results are broadly linear across the measured sizes. There is no sign in this fixture of an immediate algorithmic cliff requiring a persisted index.

### Output Growth

| Entries | Dashboard JSON | Inspect JSON | Resolve JSON | View JSON |
| ------: | -------------: | -----------: | -----------: | --------: |
|     100 |       52,575 B |        422 B |        344 B |   9,746 B |
|     500 |      261,375 B |        424 B |        345 B |  47,346 B |
|   1,000 |      522,378 B |        425 B |        346 B |  94,347 B |
|   5,000 |    2,618,342 B |        427 B |        347 B | 478,347 B |

Dashboard output grows by roughly 522 bytes per simple entry. The extension currently limits a process result to 1,048,576 bytes, so a simple workspace around 2,000 entries is likely to exceed the limit even though the core operation itself remains fast enough.

### Memory

| Entries |                   Dashboard peak RSS |
| ------: | -----------------------------------: |
|   1,000 | 19,005,440 B, approximately 18.1 MiB |
|   5,000 | 48,627,712 B, approximately 46.4 MiB |

Memory remains practical for one short-lived process at the measured scale. This result does not make 25 concurrent processes safe; transient aggregate memory depends on process overlap and was not directly measured in this assessment.

## Concurrent Resolve Results

The benchmark started identical reference-resolution processes concurrently against the project workspace.

| Concurrent processes | Median total completion time |
| -------------------: | ---------------------------: |
|                    1 |                      93.0 ms |
|                    4 |                     103.0 ms |
|                   10 |                     128.7 ms |
|                   25 |                     296.5 ms |

Rust and the operating system handle the parallel CPU work reasonably on this host, but latency alone hides process count and transient memory pressure. One measured resolve process used approximately 24.3 MiB peak RSS. The adapter should not rely on unconstrained parallelism as a batching mechanism.

## Implementation Findings

### VS Code Link Fan-Out

Document validation scans up to 25 reference tokens and invokes one CLI resolution for each token in a `Promise.all` call. Markdown Preview independently resolves up to 25 wikilinks. A link-dense document can therefore trigger up to 50 short-lived CLI invocations across the two background features.

Relevant implementation:

- `packages/vscode-extension/src/navigation.ts`
- `packages/vscode-extension/src/native-preview.ts`

The existing document `inspect` result already provides analyzed reference information. Preview and diagnostics should consume a single document-analysis result. Explicit hover, definition, and navigation can retain on-demand resolution when needed.

### Duplicate Core Loading

`workspace_dashboard`, `resolve_reference`, and document inspection load the workspace and then call `discover_workspace`, which loads it again. This creates avoidable configuration parsing and import discovery inside every short-lived process.

Relevant implementation:

- `crates/forma-core/src/operations.rs`
- `crates/forma-core/src/index.rs`

The immediate correction is to pass a loaded workspace into discovery. The broader reusable shape is a non-persisted operation snapshot that owns configuration, parsed entries, indexes, and diagnostics for one analysis generation.

### Dashboard Transport Limit

The extension uses a 1 MiB output ceiling for every JSON operation. The current dashboard contract returns the complete entry and taxonomy projection, so a workspace can become impossible to load in Explorer before core latency or memory becomes problematic.

Relevant implementation:

- `packages/vscode-extension/src/forma-client.ts`
- `packages/vscode-extension/src/workspace-tree.ts`

Increasing the output limit would postpone the failure while increasing parsing and memory costs. Explorer needs compact projections, lazy children, or pagination.

### Scheduling And Resource Bounds

The extension already has useful local protections, including aborting stale preview work, bounded 64-entry inspect and body-link caches, scoped file watchers, and debounced content/config refresh.

Remaining gaps include:

- no global concurrency limit across features;
- no cross-feature in-flight request deduplication;
- refresh paths that may perform duplicate Explorer work;
- an unbounded Markdown enhancement map until extension disposal;
- accumulated stdout string copying and repeated byte-length calculation;
- potentially large diagnostic and output-channel retention.

## Recommended Work Order

1. Reuse one document analysis for Preview and diagnostics; remove per-link background CLI calls.
2. Add global scheduling, cancellation, request deduplication, and bounded concurrency in the extension.
3. Add compact or paginated Explorer operations before increasing output limits.
4. Eliminate duplicate workspace loading within core operations.
5. Introduce an operation-scoped `WorkspaceSnapshot` and share parsing and indexes across projections.
6. Add reproducible 1,000 and 5,000-entry performance fixtures and publish results in CI.
7. Repeat local and VS Code Remote measurements.
8. Consider stdio RPC only if the optimized short-lived model still misses interaction budgets.
9. Consider a rebuildable persisted local cache only if the in-memory session model still misses realistic large-workspace budgets.

## Baseline Limitations And Follow-Up

The next formal baseline should:

- run from a clean committed revision;
- capture CPU model and available memory;
- use more samples for stable p95 and variance;
- separate cold filesystem cache from warm runs;
- include a realistic reference-dense fixture and multiple spaces;
- measure combined child-process RSS during editor fan-out;
- capture an end-to-end VS Code trace for open, save, preview, hover, definition, and Explorer expansion;
- repeat against a VS Code Remote workspace;
- include Windows and Linux before treating budgets as cross-platform release gates.
