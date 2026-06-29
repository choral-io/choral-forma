---
title: "Release Readiness"
summary: "Judgment of whether the release has enough scope, validation, and risk evidence to proceed."
status: active
unit: "readiness judgment"
direction: increase
target: "Ready when required release tasks are done or explicitly deferred and linked validation cases pass."
owners:
  - members/ava-patel
createdAt: "2026-06-29T00:00:00Z"
updatedAt: "2026-06-29T00:00:00Z"
---

# Release Readiness

## Definition

Release readiness is a lightweight judgment that combines task status, validation evidence, and remaining risk.

## Interpretation

- `not-ready`: required tasks are blocked, reviewing work has unresolved findings, or validation evidence is missing.
- `partially-ready`: the main scope is implemented but some validation or documentation still needs review.
- `ready`: required scope is done or explicitly deferred, validation passes, and follow-up work is recorded.

## Related Records

- [[releases/planning-beta]]
- [[validation/release-scope-review]]
- [[experiments/readiness-review-checklist]]
