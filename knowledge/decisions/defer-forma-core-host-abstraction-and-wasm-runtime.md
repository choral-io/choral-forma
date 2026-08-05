---
schemaVersion: 1
title: Defer Forma Core Host Abstraction And WASM Runtime
summary: Defer a broad Forma Core host abstraction and WASM runtime migration until a concrete Host use case justifies the cost.
scope: project
type: decision
owners:
    - "members/tiscs"
reviewers: []
tags:
    - architecture
    - forma
    - wasm
    - portability
sources:
    - "decisions/forma-p0-core-architecture"
    - "architecture/forma-core-technical-direction"
    - "planning/forma-product-value-gap-roadmap"
supersedes: []
supersededBy: []
---

# Defer Forma Core Host Abstraction And WASM Runtime

## Context

Forma already separates product operations from CLI, HTTP, LSP, WebApp, and editor adapters, but `forma-core` still performs native filesystem, process, clock, and path-boundary work directly. Moving all of those effects behind a new Host abstraction could make an optional WebAssembly runtime easier to embed, but the abstraction and migration cost is material.

The current product roadmap has higher-priority gaps in guided modeling, import and normalization, reviewable writes, schema evolution, compatibility, cross-surface parity, and external value evidence. A broad portability refactor would not close those user-facing gaps by itself.

## Evidence

On 2026-07-30, the current checkout established compile-level feasibility:

- `forma-core` and `forma-rpc` passed `wasm32-wasip1` and `wasm32-wasip2` checks;
- `forma-lsp` passed a `wasm32-wasip2` check;
- `forma-cli` did not pass the same target because its Axum and Tokio `full` host stack is not a portable Core concern;
- native `forma-core` and `forma-rpc` tests passed;
- no WASM runtime, browser, editor-embedded, write-safety, or Native/WASM behavior-parity proof was completed.

This evidence shows that Rust and the main domain dependencies do not block the direction. It does not prove that Forma has a stable Host capability contract or a useful WASM product integration.

## Decision

Defer implementation of a broad Forma Core Host abstraction and WASM runtime.

For the current product phase:

- keep the native `forma` binary as the default runtime and distribution;
- preserve the existing typed operation and JSON result contracts as the cross-surface product boundary;
- do not introduce a generic `Platform`, tool-execution, shell, network, or plugin capability into Core;
- do not add a WASM component crate, runtime dependency, release artifact, browser Host, or editor-embedded runtime;
- do not add a WASM CI gate as part of this decision-only slice;
- keep WASM portability as an option rather than a current product commitment.

When the work resumes, start from one concrete Host and one measurable outcome. Prefer standard WASI capabilities before designing custom filesystem or runtime interfaces, and introduce narrower capability boundaries only where the selected Host proves they are necessary.

## Current Cut Line

This decision and its parked follow-up task are the complete authorized work. No code, build, CI, release, configuration, editor, or WebApp changes are included.

The compile evidence may drift while the work is parked because no continuous portability gate is being added. Re-verifying current targets and dependencies is therefore an explicit first step when the task resumes.

## Resume Conditions

Refine and select the follow-up task only when at least one of these conditions is present:

- VS Code or another editor has a concrete requirement to run Forma without acquiring and launching a native binary;
- a browser-local, serverless, embedded, mobile, or sandboxed Agent Host becomes an accepted product surface;
- native artifact building, signing, installation, or version coordination creates measured delivery cost;
- reviewable write operations need an explicit capability sandbox that the native-only boundary cannot provide;
- an external integrator needs an embeddable Forma runtime and supplies representative constraints;
- a bounded experiment can name parity, startup, memory, package-size, security, and user-value acceptance evidence.

## First Slice After Resumption

The first resumed slice should:

1. select one Host rather than design for every possible platform;
2. re-run compile and dependency compatibility checks against the current toolchain;
3. prove read-only `config.summary` and `check` behavior against a representative fixture;
4. compare canonical Native and WASM JSON results;
5. record which standard WASI capabilities are sufficient and which custom imports are actually required;
6. stop before write support, tool execution, or multi-Host productization unless the read-only proof passes.

## Consequences

- The current product roadmap and selected delivery priorities remain unchanged.
- Forma avoids a speculative abstraction whose shape would otherwise be derived only from the native implementation.
- The repository retains durable evidence that WASM is technically plausible but not yet product-justified.
- Future work has explicit recovery conditions and a bounded first experiment instead of restarting the architecture discussion from memory.
- Any future runtime plugin system remains a separate security and product decision; compiling Forma Core to WASM does not authorize workspace-provided WASM execution.

## Related Knowledge

- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/editor-extension-adapter-contract]]
- [[planning/forma-product-value-gap-roadmap]]
- [[tasks/productize-forma-core-host-abstraction-and-wasm]]
