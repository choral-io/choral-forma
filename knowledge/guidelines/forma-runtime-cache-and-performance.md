---
scope: project
type: engineering-guideline
title: Forma Runtime Cache And Performance
summary: Correctness and verification rules for effective workspace snapshots, caches, static generation, and performance work.
owners:
    - "members/tiscs"
tags:
    - forma
    - engineering
    - runtime
    - cache
    - performance
    - static-generation
    - guidelines
    - agents
skill:
    id: forma-runtime-cache-and-performance
    title: Forma Runtime Cache And Performance
    description: Verify workspace snapshots, caches, invalidation, static generation, and performance changes without weakening Core semantics.
    projection: full
    order: 45
sources:
    - "architecture/forma-core-technical-direction"
    - "decisions/resolve-authored-config-into-typed-workspace-model"
    - "guidelines/forma-product-model-and-configuration-fidelity"
---

# Forma Runtime Cache And Performance

## Purpose

This guideline keeps performance work consistent with Forma's effective-workspace contract. Apply it when Core, RPC, CLI, the local server, WebApp, static export, or editor integrations change workspace loading, snapshots, caching, invalidation, or performance-sensitive projections.

Treat scan plans, cache layouts, validation windows, and generated artifact staging as implementation details. Optimize them without turning the current mechanism into a product primitive.

## Runtime Ownership

- Build behavior from the resolved workspace model and shared Core projections. Do not add a faster downstream interpretation of raw config, paths, or identifiers.
- Capture one resolved workspace snapshot per operation when the operation needs a consistent view of configuration and content. Additional loads require an explicit correctness reason.
- Reuse validated scan plans and classification results instead of introducing surface-specific walkers or matchers.
- Preserve workspace-boundary and config-source protections on every fast path. Performance does not justify bypassing validation or publication policy.
- Follow [[guidelines/forma-product-model-and-configuration-fidelity]] when an optimization interprets configured concepts or repository paths.

## Cache Correctness

- Cache only results whose inputs and invalidation dependencies are known.
- Associate asynchronous cache work with a generation or equivalent lease. A result computed for an older generation must never replace newer state.
- Invalidate affected state before a successful mutation becomes observable to later reads.
- Treat effective-config load failure as invalid state. Do not serve a cached success across a configuration or boundary failure.
- Do not cache source or arbitrary-path responses until their exact dependencies and invalidation behavior are defined.
- Keep cache lookup, fingerprinting, parsing, and response storage ownership explicit. Avoid holding shared cache locks during filesystem scans or expensive projection work.
- Cover races, mutation invalidation, and handler-specific cache behavior with deterministic tests rather than timing assumptions alone.

## Performance Evidence

Measure the surface being optimized instead of extrapolating from a neighboring command.

For a persistent server or response cache, distinguish:

- cold request;
- immediate cache hit;
- request after the validation window;
- first request after a relevant mutation or external edit;
- subsequent warm requests.

For workspace-wide changes, distinguish:

- one-shot CLI process cost;
- persistent-process request cost;
- representative real-workspace behavior;
- synthetic scale behavior;
- static generation time and artifact determinism.

Record the baseline commit or artifact provenance. A dirty-worktree baseline may support directional comparison but must not be presented as a release-quality regression threshold.

## Verification

- Use focused tests during implementation, including deterministic race and invalidation coverage.
- Run the complete repository gate after cross-surface integration. Focused Core or CLI suites do not establish final readiness for changes shared by CLI, WebApp, static export, and editor integrations.
- Run the relevant lint and compiler warning gates when runtime ownership or public contracts change.
- Verify static output from independent builds when determinism is part of the contract.
- Use the real backend for persistent-cache measurements and terminate temporary servers after validation.
- Report cold, warm, and invalidation behavior separately, along with checks not run and residual uncertainty.

## Stop And Reassess When

- a cache cannot name its dependencies or invalidation events;
- an optimization requires a downstream surface to reinterpret Core semantics;
- stale results can re-enter after a newer generation;
- a cached success would survive config-load or workspace-boundary failure;
- focused tests pass but the integrated workspace gate exposes a cross-surface regression;
- benchmark improvement depends on an unrepresentative fixture or incomparable baseline;
- a performance change silently changes publication, privacy, path, or classification behavior.

## Definition Of Done

A runtime or performance change is complete only when:

- semantic behavior still comes from the resolved Core model;
- snapshot and invalidation ownership are explicit;
- stale-write and mutation paths have deterministic coverage;
- representative cold, warm, and invalidation evidence is recorded;
- static artifacts remain correct and deterministic where applicable;
- the complete repository gate passes;
- temporary instrumentation and servers are removed;
- residual performance or correctness limitations are reported.
