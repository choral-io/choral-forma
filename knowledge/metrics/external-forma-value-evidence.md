---
schemaVersion: 1
kind: metric
title: External Forma Value Evidence
summary: Measures whether comparable external work shows a reliable maintenance or knowledge-quality advantage from Forma beyond disciplined Markdown and lightweight tools.
scope: project
type: metric
status: planned
owners:
    - "members/tiscs"
tags:
    - metric
    - product-value
    - external-validation
source: "A user-authorized qualitative case corpus in choral-io/knowledge-research plus consented comparative pilot records."
unit: "comparative evidence set"
direction: "increase"
target: "At least three comparable work records across two or more domains, with setup effort, rework, failures caught, reviewer effort, continued use, and a documented continue, narrow, reposition, or stop decision."
reviewCadence: "After every pilot cohort and before broadening a product-value claim."
relatedExperiments:
    - "experiments/external-forma-value-validation-pilot"
relatedReleases:
    - "releases/forma-v0.1.23"
---

# External Forma Value Evidence

## Definition

This metric measures product-value evidence, not internal workflow readiness. It asks whether comparable external work is easier to set up, maintain, review, or reuse with Forma than with a disciplined Markdown baseline and lightweight tools.

## Measures

- setup and support time;
- knowledge or reference failures caught before use;
- Agent and Human rework caused by missing or stale context;
- completion and reviewer effort for the same representative job;
- feature use and continued weekly use;
- qualitative reasons to continue, narrow, reposition, or stop.

## Evidence Rules

- Compare the same job and bounded corpus in both paths.
- Preserve qualitative findings separately from measured outcomes.
- Record consent, confidentiality constraints, and evidence-retention limits.
- Do not infer market fit from downloads, internal dogfooding, or a published narrative alone.

## Initial Qualitative Inputs

- [From knowledge-workflow to Forma](https://github.com/choral-io/knowledge-research/blob/main/publications/forma/from-knowledge-workflow-to-forma.md)
- [From documents to knowledge assets](https://github.com/choral-io/knowledge-research/blob/main/publications/forma/from-documents-to-knowledge-assets.md)

## Related Knowledge

- [[user-stories/external-team-evaluates-forma]]
- [[experiments/external-forma-value-validation-pilot]]
- [[tasks/define-external-product-value-validation]]
