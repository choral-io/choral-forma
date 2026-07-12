---
scope: project
type: execution-plan
title: Forma Performance Optimization Plan
summary: Small, measurable iterations for reducing CLI fan-out, duplicate workspace analysis, Explorer response growth, and editor resource pressure.
owners:
    - "members/tiscs"
reviewers: []
tags:
    - planning
    - performance
    - rust
    - vscode
    - optimization
sources:
    - "architecture/forma-performance-engineering"
    - "discovery/forma-performance-assessment-2026-07-12"
    - "architecture/editor-extension-adapter-contract"
    - "planning/editor-extension-mvp-roadmap"
---

# Forma Performance Optimization Plan

## Objective

Improve Forma performance through small, independently measurable iterations. Each iteration should address one dominant cost source, preserve observable behavior, and produce before-and-after evidence before the next optimization begins.

The optimization sequence follows the budgets and rules in [[architecture/forma-performance-engineering]] and starts from the measurements in [[discovery/forma-performance-assessment-2026-07-12]]. It deliberately postpones stdio RPC, a daemon, and persisted indexes until simpler changes have been measured.

## Execution Principles

- Use one focused implementation iteration per commit or pull request.
- Record a before measurement from the same commit, fixture, build profile, and host used for the after measurement.
- Change one primary performance dimension at a time.
- Preserve CLI and RPC result semantics unless the iteration explicitly introduces a new operation contract.
- Treat removal of N+1 work, an output-size failure, unbounded concurrency, or unbounded memory as a valid optimization even when wall-clock changes are within benchmark noise.
- Stop and investigate when a non-target operation regresses by more than `max(10%, 5 ms)`.
- Do not introduce a persistent cache or long-lived process to hide duplicate work that can be removed directly.

## Per-Iteration Evaluation Loop

Every iteration uses the same loop:

```text
capture before
-> implement one optimization
-> run focused functional tests
-> build an optimized release binary
-> run perf:quick
-> compare latency, operation count, output size, and relevant resource metrics
-> record the result
-> continue, revise, or revert
```

The quick evaluation should complete in approximately 60 seconds and use:

- the current Choral Forma project workspace;
- a deterministic 1,000-entry synthetic workspace;
- one unreported warm-up and five measured samples per operation;
- median and maximum latency;
- operation output bytes;
- iteration-specific process count, maximum concurrency, parse count, or peak RSS.

At milestone boundaries, run the full baseline with 100, 500, 1,000, and 5,000 entries, additional samples, p50, p95, peak RSS, and output-size reporting.

An iteration passes when:

- the intended cost is removed or the target metric improves by at least 10%;
- non-target operations stay inside the regression tolerance;
- functional tests pass;
- `forma check` and workspace health remain clean;
- resource bounds introduced by the iteration are verified.

## Iteration 0: Repeatable Benchmark Harness

### Scope

Establish the measurement tools before changing performance behavior.

### Changes

- Add a deterministic temporary fixture generator without committing thousands of Markdown files.
- Add `mise run perf:quick` for the current project workspace and a 1,000-entry fixture.
- Add `mise run perf:baseline` for 100, 500, 1,000, and 5,000-entry fixtures.
- Measure `config inspect`, workspace dashboard, document inspect, reference resolve, and view render.
- Record latency and output bytes in machine-readable JSON plus a short Markdown summary.
- Add an extension-side fake process runner that can report invocation count and maximum concurrency.
- Run the first formal baseline from a clean committed revision.

### Quick Evaluation

- Run `perf:quick` twice on the same host and revision.
- Confirm that median results normally vary by less than 10%.
- Confirm the quick suite completes in approximately 60 seconds without network access or a new benchmark dependency.

### Exit Criteria

- The same command can generate comparable before-and-after evidence for every later iteration.
- Fixture generation is deterministic and leaves no committed workspace content.
- Benchmark output identifies revision and dirty-worktree state.

## Iteration 1: Remove Per-Link Background CLI Fan-Out

### Scope

Replace background O(links) reference-resolution processes with one document-analysis result.

### Changes

- Reuse one `inspectDocument` or equivalent document-analysis result for Preview links and document diagnostics.
- Stop invoking `reference resolve` for every link during document open and save.
- Preserve on-demand resolve for hover, definition, explicit navigation, and ambiguous-reference selection.
- Allow a view document to perform one document analysis plus one view render.
- Add extension tests that assert CLI invocation counts for a 25-link document.

### Quick Evaluation

| Scenario                | Current upper bound | Target upper bound |
| ----------------------- | ------------------: | -----------------: |
| Open ordinary document  |    approximately 51 |                  1 |
| Save ordinary document  |    approximately 51 |                  1 |
| Open view Preview       |    approximately 52 |                  2 |
| One hover or definition |                   1 |                  1 |

Measure the wall time and CLI count for a 25-link document in addition to the normal quick suite.

### Exit Criteria

- Background analysis invocation count is O(1) with respect to link count.
- Preview titles, link navigation, unresolved diagnostics, fragments, and frontmatter references remain correct.
- No feature starts a replacement per-link loop through a different API.

## Iteration 2: Bound And Deduplicate Extension Requests

### Scope

Coordinate work across Preview, navigation, Explorer, watchers, saves, editor changes, and manual refresh.

### Changes

- Introduce a workspace-level request scheduler.
- Set the default global CLI concurrency limit to two and the hard maximum to four.
- Deduplicate in-flight requests by workspace, operation, document version, and relevant parameters.
- Cancel work for stale document versions and prevent stale results from updating UI or caches.
- Coalesce watcher, save, active-editor, runtime-state, Preview, and explicit-refresh triggers.
- Remove duplicate Explorer refresh caused by overlapping runtime-state and command paths.

### Quick Evaluation

- Trigger ten equivalent refresh requests and count actual dashboard or Explorer operations.
- Save several document versions quickly and confirm that only the latest version updates Preview and diagnostics.
- Record maximum simultaneous child-process count.
- Confirm the extension has no child process while idle.

### Exit Criteria

- Equivalent refresh bursts result in one in-flight operation and at most one necessary follow-up.
- Maximum child-process concurrency never exceeds the configured bound.
- Cancellation releases child processes, timers, and event listeners.
- Manual refresh remains predictable and updates all required UI.

## Iteration 3: Reuse The Loaded Workspace During Discovery

### Scope

Remove duplicate configuration and import loading inside one Core operation without changing public result schemas.

### Changes

- Add a discovery entry point that accepts an already loaded workspace.
- Update dashboard, inspect, resolve, list, view, and related operations to reuse it.
- Preserve configuration diagnostics and effective-config behavior.
- Add instrumentation or tests proving one effective configuration load per operation.

### Quick Evaluation

- Compare project, 1,000-entry, and 5,000-entry inspect, resolve, dashboard, and view results.
- Record configuration-load count in focused tests.
- Compare JSON output to ensure semantic compatibility.

### Exit Criteria

- Each operation loads effective configuration at most once.
- Target operations improve measurably or the duplicate I/O and parsing are demonstrably removed.
- No configuration diagnostic or local-override behavior changes unintentionally.

## Iteration 4: Compact And Lazy Explorer Operations

### Scope

Remove the full workspace dashboard from the initial Forma Explorer load path.

### Changes

- Add a compact Explorer root operation that returns taxonomy and term summaries plus views.
- Load term entries only when the user expands the term.
- Add pagination or a cursor for large entry lists.
- Return only fields required by the tree consumer.
- Preserve the current full dashboard operation for consumers that need its complete projection.

### Quick Evaluation

| Workspace scale | Current dashboard output | Explorer initial-response target |
| --------------- | -----------------------: | -------------------------------: |
| 1,000 entries   |    approximately 522 KiB |              no more than 64 KiB |
| 5,000 entries   |   approximately 2.62 MiB |             no more than 256 KiB |

Measure first tree load, term expansion, output bytes, and memory for 1,000 and 5,000 entries.

### Exit Criteria

- A 5,000-entry workspace opens the Forma Explorer without exceeding process-output limits.
- Initial response size does not grow approximately linearly with every entry.
- Expansion, pagination, refresh, document opening, and view opening remain correct.
- The implementation does not merely increase the existing 1 MiB output ceiling.

## Milestone A: Rebaseline And Stop Check

After Iterations 0 through 4:

1. Run the full baseline from a clean committed revision.
2. Repeat the 25-link editor scenario and refresh-burst scenario.
3. Compare the result with the 2026-07-12 assessment.
4. Record whether current performance budgets are met.
5. Stop if the remaining costs are below budget and no resource limit is approaching.

Do not proceed automatically to a larger architectural change merely because later iterations are listed.

## Iteration 5: Operation-Scoped Workspace Snapshot

### Scope

Ensure each controlled file is read and parsed at most once within one analysis generation and share lookup indexes across projections.

### Iteration 5A: Establish The Boundary

Introduce an internal, non-persisted snapshot containing:

- effective configuration;
- parsed entries and views;
- path, space, taxonomy, and reference indexes;
- diagnostics;
- source identity needed for one analysis generation.

This step should be primarily structural and preserve algorithms and output.

### Iteration 5B: Remove Repeated Work

- Replace repeated linear entry searches with indexed lookup.
- Share backlink and reference indexes across inspect, resolve, health, dashboard, and view evaluation.
- Avoid repeated sorting and repeated status calculation over identical collections.
- Count file reads and Markdown parses in focused tests.

### Quick Evaluation

- Run all Core operations on 1,000 and 5,000-entry fixtures.
- Add a reference-dense fixture with multiple spaces and schemas.
- Record file-read count, Markdown-parse count, latency, and peak RSS.

### Exit Criteria

- Each controlled file is parsed at most once per snapshot generation.
- 5,000-entry inspect and resolve remain within the 250 ms p95 budget.
- A 5,000-entry short-lived process remains within the 64 MiB peak RSS budget.
- The snapshot is rebuildable and does not become persisted product state.

## Iteration 6: Resource And Output Hygiene

### Scope

Prevent long-running extension sessions and large results from accumulating memory, logs, buffers, timers, or orphan processes.

### Changes

- Accumulate stdout and stderr as chunks with an independent byte counter.
- Clean Markdown enhancements when documents close.
- Define capacity, eviction, and invalidation rules for every cache and map.
- Log operation summaries instead of complete large JSON results by default.
- Bound diagnostic retention and provide summaries when limits are reached.
- Verify that cancellation and timeout release processes, timers, and listeners.

### Quick Evaluation

- Open, edit, and close 200 documents repeatedly.
- Track cache sizes, enhancement count, extension memory, child processes, and timers.
- Exercise output near the configured safety limit.
- Cancel operations repeatedly and check for orphan processes.

### Exit Criteria

- Repeated activity reaches a stable memory and cache plateau.
- No child process remains after cancellation, timeout, or idle transition.
- Large output handling avoids repeated whole-string copying.
- Every retained resource has a documented bound and invalidation event.

## Iteration 7: VS Code Remote And Transport Decision

### Scope

Measure the optimized short-lived CLI model in local and VS Code Remote environments, then decide whether a long-lived transport is justified.

### Evaluation

Measure cold and warm behavior for:

- extension activation;
- document open and save;
- Markdown Preview;
- hover, definition, and navigation;
- Explorer root load and term expansion;
- configuration and include-pattern changes.

### Decision Rules

- Keep short-lived CLI calls when the optimized adapter meets interaction and resource budgets.
- Plan `forma rpc --stdio` only when process startup or repeated snapshot construction remains a material measured cost, or unsaved-buffer analysis requires a session-aware protocol.
- Continue operation, projection, or filesystem optimization when those costs still dominate; stdio RPC must not conceal them.
- Design a persisted local cache only after an in-memory session and scoped invalidation still fail realistic large-workspace budgets.

### Exit Criteria

- Local and Remote measurements are recorded separately.
- The transport decision cites measured costs rather than anticipated convenience.
- Any stdio or cache proposal becomes a separate reviewed architecture and execution plan.

## Suggested Commit Boundaries

1. `test: add repeatable performance benchmark harness`
2. `perf: reuse document analysis for preview diagnostics`
3. `perf: bound and deduplicate extension requests`
4. `perf: reuse loaded workspace during discovery`
5. `perf: add lazy explorer data operations`
6. `refactor: introduce operation workspace snapshot`
7. `perf: share snapshot indexes across operations`
8. `perf: bound extension caches and process output`
9. `docs: record remote performance transport decision`

Do not combine Core indexing, extension scheduling, and Explorer operation changes in one iteration. Separate boundaries make regressions attributable and allow an optimization to be reverted without discarding unrelated improvements.

## Recommended First Goal Cutline

The first implementation goal should cover Iterations 0 through 4 only:

- repeatable benchmark tooling;
- removal of background per-link CLI fan-out;
- request scheduling, deduplication, cancellation, and refresh coalescing;
- single workspace load per Core operation;
- compact and lazy Explorer operations;
- a clean full rebaseline and Milestone A stop decision.

Workspace snapshots, output hygiene beyond what the first iterations require, VS Code Remote evaluation, stdio RPC, and persisted caches should remain outside that goal until Milestone A evidence justifies them.

## Execution Log

### Iteration 0 — Completed 2026-07-12

The repeatable benchmark harness was added in commits `f5cc322` and `31fd543`. `mise run perf:quick` completes in approximately 11 seconds, and the full clean baseline completed in approximately 27 seconds on revision `31fd543e8c57`.

| Workspace | Dashboard median / p95 | Inspect median / p95 | Resolve median / p95 | View median / p95 |
| --------- | ---------------------- | -------------------- | -------------------- | ----------------- |
| Project   | 204.5 / 207.8 ms       | 97.8 / 100.3 ms      | 99.7 / 101.5 ms      | 170.7 / 175.9 ms  |
| 1,000     | 74.6 / 79.7 ms         | 40.8 / 44.6 ms       | 40.5 / 43.0 ms       | 66.6 / 69.8 ms    |
| 5,000     | 410.3 / 449.2 ms       | 202.0 / 250.6 ms     | 192.7 / 198.4 ms     | 332.1 / 339.4 ms  |

Measured 5,000-entry peak RSS was 44.3 MiB for dashboard, 28.3 MiB for inspect, 27.4 MiB for resolve, and 40.4 MiB for view render. Dashboard output remained the scale limit at approximately 2.62 MiB for 5,000 entries.

The full `mise run check` gate passed before the harness commit. Benchmark JSON is generated under ignored `target/performance/` paths and records revision and dirty-worktree state. Very short commands can complete before the RSS sampler observes their true peak; memory results are most useful for longer workspace-analysis operations.

### Iteration 1 — Completed 2026-07-12

Commit `95989d4` replaced background per-link reference resolution with one shared document inspect result. Core inspect references now expose the raw target and resolved entry title needed by Preview, while unresolved and ambiguous body-reference diagnostics are projected from the same result.

A 25-subscriber concurrent inspect test performs one loader invocation instead of 25. Preview and document validation no longer contain per-link `resolveReference` loops; hover, definition, and explicit navigation remain on-demand operations. The inspect cache allows an individual subscriber to cancel without cancelling shared analysis and prevents stale results from repopulating a cleared cache.

The clean quick run on `95989d45857f` measured project inspect at 92.7 ms and 1,000-entry inspect at 37.4 ms, compared with the initial full-baseline medians of 97.8 ms and 40.8 ms. Other Core operations stayed within the non-regression tolerance. These small latency differences are treated as host variance because the iteration primarily removes editor process multiplication rather than Core work.

`mise run check`, focused Core and extension tests, trusted Extension Host tests, and the untrusted-workspace test passed. Downloaded `.vscode-test` runtimes were removed after validation.

### Iteration 2 — Completed 2026-07-12

Commit `453d2f9` added a global Forma process scheduler with default concurrency two, identical in-flight request deduplication, subscriber-aware cancellation, and generation invalidation. Explorer refresh now coalesces requests from the same analysis generation and performs at most one follow-up when content changes during an active refresh. The explicit workspace-refresh command no longer starts a second Explorer refresh after the runtime state event.

Tests verified that ten identical requests execute once, eight distinct requests never exceed two active operations, cancelling one subscriber preserves shared work, invalidation aborts old work, ten same-generation Explorer refreshes execute once, and multiple newer generations coalesce into one follow-up.

The clean quick run on `453d2f99d489` measured project dashboard at 195.0 ms, inspect at 92.6 ms, and resolve at 92.0 ms. The 1,000-entry results were 70.4 ms, 38.2 ms, and 38.0 ms respectively. All stayed within the non-regression tolerance. `mise run check` passed with 78 TypeScript tests plus the complete Rust workspace suite.

### Iteration 3 — Completed 2026-07-12

Commit `262b5b8` introduced discovery from an already loaded `FormaWorkspace`. The loaded workspace now carries its resolved configuration sources and import patterns, allowing dashboard, inspect, reference, list, render, health, and check operations to reuse one effective configuration load. This also removes repeated import-glob expansion within discovery while preserving public operation schemas.

A focused regression test changes `.forma.md` after loading and confirms that discovery continues from the loaded configuration snapshot. The complete Core suite and `mise run check` passed.

The clean quick run on `262b5b82cd2a` measured project dashboard at 189.0 ms, inspect at 87.0 ms, resolve at 86.0 ms, and view render at 156.4 ms. The 1,000-entry results were 68.9 ms, 36.7 ms, 36.8 ms, and 61.4 ms respectively. Compared with the Iteration 2 clean run, the project inspect and resolve paths improved by approximately 6–7%, and all measured operations remained within the non-regression tolerance. The more important invariant is structural: these operations now perform one effective configuration load rather than two or more.

### Iteration 4 — Completed 2026-07-12

Commit `6ff64f0` added `workspace.explorer` and `workspace.explorerEntries` across Core, RPC, CLI, the shared TypeScript client, and the VS Code adapter. The root operation returns only taxonomy and term summaries plus Views. Expanding a term loads 100 entries by default, exposes a `Load more…` node when another page exists, and enforces a 500-entry hard page limit. The complete `workspace.dashboard` contract remains unchanged for existing consumers.

Core, RPC, client, and tree-model tests cover the compact schema, pagination, command arguments, View behavior, and load-more projection. The extension deduplicates concurrent loads of the same page. `mise run check` passed with 79 TypeScript tests, 164 Core tests, 22 RPC tests, the CLI integration suite, lint, formatting, and production builds.

The clean full baseline on `6ff64f09f741` measured the following Explorer behavior:

| Workspace | Explorer root median / p95 | Root output | 100-entry page median / p95 | Page output |
| --------- | -------------------------- | ----------: | --------------------------- | ----------: |
| Project   | 187.6 / 191.0 ms           |     3,395 B | 187.6 / 191.0 ms            |    27,377 B |
| 1,000     | 62.2 / 68.0 ms             |       433 B | 64.7 / 69.2 ms              |    26,353 B |
| 5,000     | 304.9 / 347.9 ms           |       433 B | 319.2 / 327.7 ms            |    26,446 B |

The 5,000-entry Explorer root used 33.2 MiB peak RSS, and a term page used 35.2 MiB. Initial output no longer grows with entry count and remains far below both the 256 KiB target and the extension process-output ceiling. The initial tree still analyzes configured files to calculate counts and status, but it no longer serializes or parses a full entry projection in the extension.

### Milestone A — Stop Check Completed 2026-07-12

The full baseline was rerun outside the filesystem/process sandbox so peak RSS sampling could observe child processes. The clean `6ff64f09f741` results meet every current 1,000-entry and 5,000-entry budget:

| 5,000-entry operation |   Median |      p95 | Peak RSS | Budget result                            |
| --------------------- | -------: | -------: | -------: | ---------------------------------------- |
| Dashboard             | 377.1 ms | 386.8 ms | 44.7 MiB | within 750 ms and 64 MiB                 |
| Explorer root         | 304.9 ms | 347.9 ms | 33.2 MiB | within 750 ms, 64 MiB, and output budget |
| Explorer page         | 319.2 ms | 327.7 ms | 35.2 MiB | bounded 100-entry response               |
| Inspect               | 175.8 ms | 182.7 ms | 28.5 MiB | within 250 ms and 64 MiB                 |
| Reference resolve     | 175.7 ms | 176.2 ms | 28.6 MiB | within 250 ms and 64 MiB                 |
| View render           | 307.5 ms | 346.7 ms | 40.7 MiB | within 750 ms and 64 MiB                 |

The 25-link document scenario remains one shared inspect load, the refresh-burst tests remain bounded to one active refresh plus at most one necessary follow-up, maximum CLI concurrency remains two, and the extension performs no intentional idle CLI work. The complete dashboard is still approximately 2.62 MiB at 5,000 entries, but the VS Code Explorer no longer consumes it.

The Milestone A stop rule therefore applies. Do not begin the operation-scoped snapshot, shared-index, resource-hygiene stress campaign, VS Code Remote transport evaluation, stdio RPC, or persisted-cache work as part of this goal. Reopen those iterations only when realistic editor traces, Remote measurements, memory-plateau tests, larger or denser workspaces, or a product requirement demonstrates a budget miss. Short-lived Forma CLI operations remain the selected architecture.
