---
scope: project
type: technical-design
title: Forma Performance Engineering
summary: Performance model, budgets, optimization sequence, and implementation rules for keeping file-backed Forma workspaces responsive.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - architecture
    - performance
    - rust
    - editor-extension
    - indexing
sources:
    - "architecture/forma-core-technical-direction"
    - "architecture/editor-extension-adapter-contract"
    - "discovery/forma-performance-assessment-2026-07-12"
    - "planning/editor-extension-mvp-roadmap"
---

# Forma Performance Engineering

## Purpose

Forma uses Rust in part to make discovery, lookup, navigation, validation, and view evaluation over file-backed content feel immediate. The performance objective is not merely a fast CLI benchmark. Forma must remain responsive when editor lifecycle events, filesystem changes, remote filesystems, large operation results, and repeated reference queries are included.

Repository Markdown and explicit configuration remain the source of truth. Performance work must not introduce a hidden proprietary content store or make a cache authoritative.

The first measured baseline and implementation findings are recorded in [[discovery/forma-performance-assessment-2026-07-12]].

The small-step delivery sequence and per-iteration evaluation gates are defined in [[planning/forma-performance-optimization-plan]].

## Current Direction

The Rust core is fast enough to remain the primary engine. The first baseline found approximately linear behavior through 5,000 configured Markdown entries, with single-operation latency and memory remaining practical for a short-lived CLI process.

The largest near-term risks are outside raw Rust execution speed:

- Editor adapters can multiply one user event into many independent CLI processes.
- A single operation can reload configuration and rebuild the workspace read model more than once.
- Full dashboard responses grow with the workspace and can exceed adapter output limits.
- Watcher, save, active-editor, preview, and explicit-refresh events can overlap.
- Unbounded concurrency, caches, logs, diagnostics, or output can turn acceptable single-operation costs into system pressure.

Short-lived structured CLI calls remain acceptable while the adapter can meet the budgets below. A persistent stdio RPC process, daemon, language server, or persisted local index requires fresh measurement evidence after batching and duplicate-work removal.

Zed navigation provides separate functional evidence for a narrowly scoped language server: the public Zed extension surface exposes editor-native Definition and DocumentLink behavior through LSP. `forma lsp` may therefore be introduced for language intelligence without first proving that the optimized short-lived CLI misses its latency budget. This is not permission to move Explorer, health, view rendering, or general RPC traffic into the language server.

The LSP must still preserve the performance rules in this document. A connected server should reuse an in-memory, rebuildable workspace snapshot, keep unsaved document overlays by version, perform no intentional idle work, and avoid rebuilding the workspace for every warm navigation request. Configuration, imports, taxonomy definitions, and include-pattern changes invalidate the controlled-file scope and require a safe snapshot rebuild.

## Performance Model

Forma performance has four separate cost layers:

1. **Scope discovery**: load `.forma.md`, imports, taxonomy terms, and include patterns; determine which files are controlled.
2. **Workspace analysis**: read and parse controlled Markdown, validate schemas, resolve references, build indexes, and evaluate diagnostics.
3. **Operation projection**: construct inspect, resolve, dashboard, view, health, or other operation results.
4. **Adapter orchestration**: start processes, transfer JSON, schedule work, cancel stale requests, cache results, and update the editor UI.

Optimizations should identify the responsible layer before changing architecture. A fast resolver does not compensate for starting it 25 times, and a cache should not hide repeated parsing within one operation.

## Initial Performance Budgets

These are engineering budgets, not compatibility promises. Measure them on optimized release builds and revise them with dated evidence.

| Scenario                                 | Initial budget                                 |
| ---------------------------------------- | ---------------------------------------------- |
| 1,000-entry `inspect` or `resolve` p95   | no more than 75 ms                             |
| 5,000-entry `inspect` or `resolve` p95   | no more than 250 ms                            |
| 1,000-entry dashboard or view p95        | no more than 150 ms                            |
| 5,000-entry dashboard or view p95        | no more than 750 ms                            |
| Cached editor link navigation p95        | no more than 100 ms                            |
| Cold editor link navigation p95          | no more than 250 ms                            |
| Background document analysis             | at most one core analysis per document version |
| Concurrent CLI processes per extension   | default 2, hard maximum 4                      |
| One 5,000-entry short-lived core process | no more than 64 MiB peak RSS                   |
| Idle extension state                     | no child process and effectively zero CPU      |
| One Explorer response                    | target no more than 256 KiB; paginate above    |

Budgets for remote workspaces should be measured separately. The remote extension host should execute Forma near the workspace files, and adapters should minimize filesystem and process round trips.

Percentile budgets require a statistically meaningful sample. Do not turn a cold p95 budget into a hard assertion over one editor launch or one request on a shared CI runner. Packaged smoke tests may record a single cold sample as diagnostic evidence and must still verify its functional result, while cold-latency release gates use repeated independent launches or a controlled benchmark. Multi-sample warm p95 measurements may remain hard CI gates when their sample count and measurement boundary are explicit.

## Optimization Sequence

### Phase 0: Remove Multiplication And Scale Limits

1. Combine preview links, frontmatter references, and document diagnostics into one document-analysis result.
2. Use that result for background editor work instead of resolving every link with a separate CLI invocation.
3. Add a workspace-wide request scheduler with cancellation, in-flight deduplication, and a concurrency limit of two by default.
4. Coalesce watcher, save, active-editor, runtime-state, and explicit-refresh triggers.
5. Introduce a compact or paginated Explorer operation so initial tree loading does not require the full workspace dashboard.
6. Make process output accumulation byte-counted and chunk-based rather than repeatedly copying the complete accumulated string.
7. Bound and lifecycle-manage every cache, enhancement map, diagnostic set, log, and operation result.

### Phase 1: Reuse One Operation Snapshot

Introduce an internal, non-persisted `WorkspaceSnapshot` or equivalent operation context:

```text
load effective configuration once
-> discover controlled files once
-> read and parse each file once
-> build reference and taxonomy indexes once
-> execute one or more projections
```

Core operations should accept the loaded workspace or snapshot instead of calling configuration loading and discovery independently. This preserves stateless CLI semantics while eliminating duplicate work inside a process.

### Phase 2: Reassess The Transport

After Phase 0 and Phase 1, repeat local and VS Code Remote measurements. Introduce a long-lived `forma rpc --stdio` process only if cold process startup, repeated snapshot construction, or unsaved-buffer requirements still exceed the budgets.

A long-lived process may keep an in-memory snapshot and apply scoped invalidation. Its lifecycle should be owned by the editor host, and loss of the process must be recoverable by rebuilding from source files.

### Phase 3: Evidence-Gated Local Cache

Consider a persisted local index only when in-memory snapshot reuse and scoped invalidation still fail measured workspace targets. Any such cache must be:

- stored under a project-ignored path;
- local-only and safe to delete;
- fully rebuildable from Markdown and configuration;
- versioned against the Forma format and implementation;
- invalidated by configuration identity and file fingerprints;
- invisible as a product fact or public semantic interface.

## Engineering Rules

### Discovery And Filesystem

1. Start discovery from the selected `.forma.md`; do not recursively search for nested workspaces.
2. Scan only configuration imports and taxonomy term `include` patterns.
3. Use the longest static glob prefix as the scan root, then apply the complete glob as a filter.
4. Recompute controlled paths and watcher scope whenever `.forma.md`, imports, taxonomy definitions, or include patterns change.
5. Do not infer Forma semantics or controlled scope from `.gitignore`.
6. Minimize `stat`, directory traversal, and file-open round trips, especially on remote filesystems.

### Operations And Indexes

7. One operation must load effective configuration at most once.
8. One analysis generation must read and parse each controlled file at most once.
9. Do not call full discovery, `inspect`, `resolve`, or filesystem lookup from inside a per-link or per-entry loop.
10. Prefer batch analysis and indexed lookup over N independent operations.
11. Keep lookup indexes in the operation snapshot; build them once and share them across validation, backlinks, navigation, and view evaluation.
12. Avoid quadratic string accumulation, repeated linear searches through all entries, and repeated sorting of identical collections.

### Editor Adapters

13. One document open, save, or version change should schedule at most one background core analysis.
14. Definition, hover, and explicit navigation may perform an on-demand query; preview and diagnostics must reuse batch analysis.
15. Cancel results for stale document versions and prevent them from updating UI or caches.
16. Deduplicate identical in-flight requests by workspace, operation, document version, and relevant parameters.
17. Bound process concurrency globally rather than independently in each feature.
18. Run the CLI or future stdio service in the extension host closest to the files for remote workspaces.

### Results And Memory

19. Every cache, map, log, diagnostic collection, process queue, and output buffer must have a capacity and invalidation rule.
20. Large collection operations must support projection, pagination, or lazy children; increasing an arbitrary output cap is not a scale strategy.
21. Result contracts should return only fields needed by the consumer when a smaller projection is available.
22. Idle state must not retain child processes or schedule periodic full scans without an explicit feature requirement.

### Measurement And Review

23. Measure optimized release builds and report cold and warm results separately.
24. Record workspace shape, entry count, reference density, view count, configuration complexity, p50, p95, peak RSS, and output bytes.
25. Changes to discovery, parsing, references, views, watchers, RPC, process orchestration, or Explorer data must be tested with at least 1,000-entry and 5,000-entry fixtures.
26. Treat a performance regression as a product regression when it breaks a budget, introduces UI stalls, increases idle work, or removes a resource bound.
27. Do not introduce a daemon, database, persisted index, or new cache until measurements identify the cost it is expected to remove.

## Benchmark Protocol

The repeatable baseline suite should include:

- A small realistic project workspace.
- Synthetic workspaces with 100, 1,000, and 5,000 entries.
- A reference-dense document that exercises batch analysis.
- Multiple spaces, schemas, taxonomies, views, and diagnostics rather than only minimal fixtures.
- `config inspect`, dashboard or Explorer projection, document inspect, reference resolve, view render, and workspace health.
- Single-operation and adapter-concurrency measurements.
- Output size and peak memory in addition to wall-clock latency.

Initially publish these measurements as a non-blocking CI artifact. Promote stable budgets to a blocking regression gate only after fixture shape and runner variance are understood.

## Architecture Escalation Criteria

Escalate from short-lived CLI calls to general stdio RPC when measurements show one or more of:

- repeated snapshot construction remains a material part of editor p95 after batching;
- process startup dominates small-workspace interaction latency;
- unsaved-buffer analysis requires a session-aware protocol;
- VS Code Remote process or filesystem round trips exceed editor budgets;
- bounded concurrency still produces unacceptable transient resource pressure.

A host editor that requires LSP for native language intelligence may use the separately accepted `forma lsp` boundary. Before treating that implementation as release-ready, record initialization, cold and warm navigation, snapshot rebuild count, idle CPU, connected RSS, document-version analysis count, and recovery after process exit.

Escalate from in-memory snapshots to a persisted local cache only when 5,000-entry and larger realistic workspaces remain outside budget after scoped discovery, one-pass parsing, indexed lookup, batching, and incremental invalidation.
