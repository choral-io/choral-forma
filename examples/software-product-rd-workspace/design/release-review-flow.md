---
title: "Release Review Flow"
summary: "A release should show scope, validation evidence, remaining risk, and follow-up work before approval."
owners:
  - members/ava-patel
reviewers:
  - members/noah-kim
tags:
  - design
  - release
createdAt: "2026-06-29T00:00:00Z"
updatedAt: "2026-06-29T00:00:00Z"
---

# Release Review Flow

The release review view should let the team scan whether a release is ready without opening every task first.

## Required Signals

- Release status and date.
- Linked tasks that define the release scope.
- Linked validation cases that provide validation evidence.
- Linked metrics that define readiness thresholds.
- Remaining blocked or reviewing tasks.

## Interaction Notes

The first version should make release evidence easy to scan. Reviewers should be able to see scope, validation, blockers, and deferred work before approving a release.

## Related Records

- [[releases/planning-beta]]
- [[tasks/prepare-release-readiness-report]]
