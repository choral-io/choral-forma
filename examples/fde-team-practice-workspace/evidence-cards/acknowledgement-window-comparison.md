---
title: "Acknowledgement Window Comparison Evidence Card"
summary: "Two de-identified source projects show a reusable diagnostic sequence with a non-reusable fixed threshold."
type: evidence-card
status: ready-for-review
synthetic: "true"
engagementKey: ENG-SYN-001
sourceProjects:
    - projects/p-042
    - projects/p-051
results:
    - verification/p-042-staging-result
    - verification/p-051-production-naive-result
    - verification/p-051-production-adjusted-result
environmentDifference: "P-042 is staging-like asynchronous queue behavior; P-051 is production-like burst/retry behavior."
counterexample: "The naive 120-second production-like profile without replay protection fails two cases."
revalidationReason: "The diagnostic sequence remains applicable, but P-051 requires a 90-second profile and replay protection."
relatedTo:
    - projects/p-042
    - projects/p-051
    - proposals/acknowledgement-window-diagnostic-pattern
tags:
    - evidence-card
    - two-sources
    - de-identified
    - human-review
---

# Acknowledgement Window Comparison Evidence Card

## Comparison

| Source | Environment | Positive result | Difference retained |
| --- | --- | --- | --- |
| `P-042` | staging-like asynchronous queue | 120-second profile with replay protection: 4 passed, 0 failed | Provides the initial diagnostic baseline. |
| `P-051` | production-like burst/retry | naive 120-second profile without replay protection: 2 passed, 2 failed; adjusted 90-second profile: 4 passed, 0 failed | Fixed threshold is not portable; replay protection is required. |

## Allowed abstraction

Reuse the diagnostic sequence: inspect the environment, inspect the window, inspect replay behavior, run the matching profile, and revalidate. Do not reuse the 120-second number as a universal setting.

## Boundary

This card contains de-identified synthetic summaries and workspace-local references only. It contains no original customer name, path, credential, communication body, cross-workspace import, or automatic promotion action.
