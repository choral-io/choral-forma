---
schemaVersion: 1
kind: user-story
title: External Team Evaluates Forma In Its Own Domain
summary: A professional team can compare a Forma-assisted knowledge workflow with disciplined Markdown and lightweight tools using the same representative work.
scope: project
type: user-story
status: planned
owners:
    - "members/tiscs"
tags:
    - forma
    - product-value
    - external-validation
    - adoption
actors:
    - Professional team maintainer
    - Domain reviewer
relatedProduct:
    - "product/product-direction"
relatedTasks:
    - "tasks/define-external-product-value-validation"
relatedTestCases: []
relatedMetrics:
    - "metrics/external-forma-value-evidence"
---

# External Team Evaluates Forma In Its Own Domain

## Goal

A professional team can assess whether Forma helps it maintain and reuse domain knowledge more reliably than a disciplined Markdown baseline, without requiring the team to adopt this repository's software-product vocabulary.

## Main Flow

1. The team chooses one representative recurring knowledge job and a bounded corpus.
2. It performs the job with its existing Markdown, editor, and lightweight-tool baseline.
3. It performs an equivalent job with a Forma workspace that makes the team's own content types, templates, views, and review boundaries explicit.
4. The team records setup effort, rework, failures caught, reviewer effort, and continued use with the same definitions in both paths.
5. A Human maintainer reviews the evidence and decides whether to continue, narrow, reposition, or stop the applicable product claim.

## Boundaries

- The pilot does not claim professional or domain correctness from tool output.
- Domain reviewers retain responsibility for decisions, approvals, and sensitive material.
- Published narratives are qualitative discovery inputs; they do not substitute for comparable pilot evidence.

## Related Knowledge

- [[metrics/external-forma-value-evidence]]
- [[experiments/external-forma-value-validation-pilot]]
- [[tasks/define-external-product-value-validation]]
