---
scope: project
type: guideline
owners: []
tags:
    - engineering
    - dependencies
    - review
---

# Dependency Governance

## Purpose

Define how Choral Forma evaluates third-party dependencies during implementation
and review.

## Scope

This guideline applies to application code dependencies, development tooling
dependencies, runtime libraries, parser libraries, server frameworks, CLI
frameworks, and other third-party packages added to the repository.

## Core Rules

Choral Forma does not require every added dependency to be heavily used in the
same change that introduces it. Pre-positioning a dependency is acceptable when
it clearly supports an imminent implementation path and reduces avoidable
rework.

Every new third-party dependency should still have a concrete reason:

- the product or engineering capability it supports;
- the crate or package boundary where it belongs;
- whether it is runtime, build-time, test-only, or development-only;
- why the team should prefer it over a standard-library, existing-project, or
  lighter alternative;
- the likely replacement or removal path if the assumption changes.

Core-path dependencies need explicit selection reasoning. Examples include
Markdown parsers, YAML parsers, HTTP server frameworks, CLI frameworks, async
runtimes, storage layers, serialization libraries, and public API contract
libraries.

Pre-positioned dependencies are allowed but should be easy to justify in review.
They are strongest when the next accepted task will use them directly, the
dependency is stable and common in the ecosystem, and introducing it early
clarifies module boundaries.

For heavy, security-sensitive, network-facing, runtime-loaded, immature, or
architecture-shaping dependencies, do a small technical evaluation or spike
before making the dependency part of the main implementation path.

Feature flags should be scoped to actual needs where practical. Broad feature
sets are acceptable during early scaffolding, but review should call out when a
dependency can be narrowed later.

## Review Checklist

When reviewing a change that adds dependencies, check:

- the dependency is added to the narrowest appropriate crate or package;
- the dependency does not leak into unrelated runtime surfaces;
- the lockfile update is consistent with the manifest change;
- the dependency choice is explained in the implementation summary, review
  notes, or a durable architecture/decision document when the dependency is
  architecture-shaping;
- temporary or speculative dependencies have a clear reason to stay.

## Avoid

- Adding dependencies only because they may be useful someday.
- Pulling server, runtime, or UI dependencies into core libraries when an
  adapter crate can own them.
- Treating a passing build as enough justification for a new dependency.
- Introducing executable plugin, scripting, or network-fetching capabilities
  without an explicit product and security design.
