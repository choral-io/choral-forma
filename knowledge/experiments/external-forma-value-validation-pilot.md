---
schemaVersion: 1
kind: experiment
title: External Forma Value Validation Pilot
summary: Compare Forma-assisted and disciplined Markdown workflows for representative external knowledge-maintenance work without treating qualitative case narratives as measured outcomes.
scope: project
type: experiment
status: planned
owners:
    - "members/tiscs"
tags:
    - experiment
    - product-value
    - external-validation
    - adoption
hypothesis: "For selected recurring knowledge work, Forma makes structure, evidence, review boundaries, and reuse more reliable than a disciplined Markdown baseline without imposing an unsuitable domain model."
metrics:
    - "metrics/external-forma-value-evidence"
guardrails:
    - "Use the same representative job and bounded corpus for the baseline and Forma-assisted paths."
    - "Keep participant consent, confidentiality, and evidence-retention limits explicit."
    - "Do not claim professional or domain correctness from tool output."
    - "Treat published case narratives as qualitative inputs until comparable measurements exist."
relatedReleases:
    - "releases/forma-v0.1.23"
relatedUserStories:
    - "user-stories/external-team-evaluates-forma"
---

# External Forma Value Validation Pilot

## Hypothesis

For selected recurring knowledge work, Forma makes structure, evidence, review boundaries, and reuse more reliable than a disciplined Markdown baseline without imposing an unsuitable domain model.

## Case Corpus

The pilot starts from two published, user-authorized qualitative narratives in `choral-io/knowledge-research`:

- [From knowledge-workflow to Forma](https://github.com/choral-io/knowledge-research/blob/main/publications/forma/from-knowledge-workflow-to-forma.md)
- [From documents to knowledge assets](https://github.com/choral-io/knowledge-research/blob/main/publications/forma/from-documents-to-knowledge-assets.md)

They identify candidate domains and recurring jobs. They are not experimental results.

## Protocol

1. Recruit three to five external teams or maintainers across at least two domains.
2. Select one representative recurring knowledge job and bounded corpus per participant.
3. Record the disciplined Markdown baseline first.
4. Configure a minimal Forma workspace that uses the participant's own vocabulary, templates, views, and review boundaries.
5. Repeat the same job and collect the metric definitions without product telemetry.
6. Record a per-claim decision: continue, narrow, reposition, or stop.

## Stop Conditions

- The corpus is too sensitive or consent is incomplete.
- The compared jobs are not equivalent enough to support interpretation.
- Setup burden dominates the maintained-work benefit for the selected team.
- Evidence does not support a clear next product claim or scope.

## Related Knowledge

- [[user-stories/external-team-evaluates-forma]]
- [[metrics/external-forma-value-evidence]]
- [[tasks/define-external-product-value-validation]]
