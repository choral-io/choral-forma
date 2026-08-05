---
schemaVersion: 1
kind: task
scope: project
title: Productize Forma Core Host Abstraction And WASM
summary: Design and implement a concrete Host capability boundary and optional WASM runtime when product demand justifies resuming the work.
type: task
priority: P3
value: M
module: core
effort: L
status: backlog
readiness: needs-refinement
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - architecture
    - wasm
    - portability
    - host-adapter
blockedBy: []
relatedTo:
    - "decisions/defer-forma-core-host-abstraction-and-wasm-runtime"
    - "decisions/forma-p0-core-architecture"
    - "architecture/forma-core-technical-direction"
    - "architecture/editor-extension-adapter-contract"
    - "planning/forma-product-value-gap-roadmap"
    - "tasks/define-cross-surface-capability-matrix"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Forma Core, RPC, native adapters, and future WASM Hosts
---

# Productize Forma Core Host Abstraction And WASM

## Goal

When concrete product demand exists, define and implement the smallest Host capability boundary that lets Forma Core run consistently in the selected non-native environment without weakening native behavior, workspace safety, or operation contracts.

This task is intentionally parked. Do not start implementation until its resume conditions are satisfied and its scope, Host, acceptance evidence, priority, and readiness are reviewed.

## Sources

- [[decisions/defer-forma-core-host-abstraction-and-wasm-runtime]]
- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/editor-extension-adapter-contract]]
- [[planning/forma-product-value-gap-roadmap]]

## Observed Baseline

- Core, RPC, CLI, LSP, WebApp, VS Code, and Zed already share Forma-owned operation and semantic boundaries.
- Compile-only checks on 2026-07-30 showed that `forma-core` and `forma-rpc` can target WASIp1 and WASIp2, and `forma-lsp` can target WASIp2.
- The native CLI host stack is not itself expected to become a WASM component.
- Core still owns direct filesystem, process, clock, path-boundary, and write behavior.
- No runtime execution, Native/WASM parity, browser, embedded editor, write-safety, package-size, or performance evidence exists.

## Why This Is Parked

The expected architectural value is real, but current user-facing value is indirect. Designing the complete boundary now would be based mainly on the native implementation rather than a second Host with concrete constraints. The product roadmap currently prioritizes guided modeling, import, reviewable writes, schema evolution, compatibility, cross-surface parity, and external value validation.

## Resume Conditions

Before changing `readiness`, identify at least one accepted trigger:

- an editor must avoid installing or launching a native Forma binary;
- a browser-local, serverless, embedded, mobile, or sandboxed Agent Host is selected;
- native distribution or version coordination has measured cost;
- a reviewable-write security design requires a capability sandbox;
- an external integration supplies representative Host constraints.

Refinement must name:

- the first Host;
- the first user-visible or delivery outcome;
- supported read and write effects;
- security and trust boundaries;
- parity, performance, package-size, and lifecycle acceptance evidence;
- the stop condition if the experiment does not justify productization.

## In Scope

- Re-verify current Rust, dependency, WASI, and Component Model support.
- Select one concrete Host and define a narrow vertical proof.
- Classify Core-owned semantics, Host-owned effects, operation API contracts, and replaceable implementation details.
- Evaluate standard WASI filesystem, clock, random, and runtime capabilities before defining custom imports.
- Introduce only the capability seams required by the selected Host, with a native production implementation and deterministic test implementation where appropriate.
- Preserve workspace-relative POSIX product paths while keeping host filesystem paths internal.
- Prove canonical operation-result parity for the selected read-only operations.
- Define generation, invalidation, cancellation, and error behavior for a persistent Host when required.
- Measure cold start, warm operations, memory, component/package size, and representative workspace behavior.
- If write support is selected later, align it with `propose -> diff -> approve -> apply -> verify`, preconditions, confinement, symlink protection, and atomicity.
- Define WIT or another embedding ABI only after the internal capability boundary and versioning needs are evidenced.
- Add focused, conformance, integration, and complete repository gates appropriate to the accepted slice.

## Out of Scope

- Starting work while the task remains `backlog` and `needs-refinement`.
- Replacing the native CLI solely for architectural consistency.
- Designing simultaneously for VS Code, Zed, browsers, serverless, mobile, and every Agent runtime.
- Treating successful cross-compilation as runtime or product validation.
- Adding arbitrary shell, network, tool, JavaScript, Rust, WASM, or plugin execution to Core.
- Weakening workspace confinement, path validation, write safety, approval gates, or source-of-truth Markdown behavior for portability.
- Making WASM a required end-user runtime before one Host proves a clear advantage.
- Conflating a WASM-compiled Forma Core with a workspace runtime for user-provided WASM plugins.

## Acceptance Criteria

- A concrete Host and measurable product or delivery outcome are approved before implementation begins.
- The selected architecture names every imported Host capability and every exported Forma operation.
- Native behavior remains available and its canonical operation results match the new runtime for accepted fixtures.
- Host differences are explicit rather than hidden behind best-effort fallbacks.
- Workspace path, symlink, confinement, identity, clock, mutation, and trust behavior are covered where the Host exposes them.
- Performance and package evidence is compared with an appropriate native or current-adapter baseline.
- Write support, if included, uses an approved plan/apply contract and fails closed when Host guarantees are insufficient.
- CI and release claims distinguish compile support, runtime support, packaged support, and real-Host validation.
- Documentation records the delivered capability, unsupported behavior, version contract, and whether further Hosts are justified.
