---
schemaVersion: 1
kind: task
scope: project
title: Define External Forma Product Value Validation
summary: Define a comparative external pilot that tests whether Forma reduces knowledge and Agent failures beyond disciplined Markdown and scripts.
type: task
priority: P1
value: H
module: product
effort: M
status: ready
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - product-value
    - validation
    - adoption
blockedBy: []
relatedTo:
    - "planning/forma-product-value-gap-roadmap"
    - "experiments/starter-kit-agent-pressure-validation"
    - "metrics/knowledge-workflow-replacement-readiness"
    - "user-stories/external-team-evaluates-forma"
    - "metrics/external-forma-value-evidence"
    - "experiments/external-forma-value-validation-pilot"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: External product evidence and adoption confidence
---

# Define External Forma Product Value Validation

## Goal

Define a small comparative pilot that can raise or lower confidence in Forma's value versus well-designed Markdown, editor features, lightweight scripts, and generic coding Agents.

## Observed Baseline

Internal dogfooding and starter-kit pressure validation prove technical mechanics and Agent discoverability. They do not measure external setup cost, recurring use, time saved, errors prevented, or willingness to keep Forma in a real workflow.

## Initial Case Corpus

The first protocol uses two user-authorized published case narratives from the `choral-io/knowledge-research` repository as qualitative inputs, not as pre-counted pilot results:

- [From knowledge-workflow to Forma](https://github.com/choral-io/knowledge-research/blob/main/publications/forma/from-knowledge-workflow-to-forma.md) identifies the cost of carrying software-engineering knowledge mechanics into content, sales, professional-service, and operations domains.
- [From documents to knowledge assets](https://github.com/choral-io/knowledge-research/blob/main/publications/forma/from-documents-to-knowledge-assets.md) describes a professional-services trial in which structured records, evidence, review boundaries, and recurring maintenance improve reuse without delegating professional judgment to an Agent.

The pilot must collect the same evidence in a comparable shape before treating either narrative as support for a product-value claim.

## In Scope

- Define participant and repository criteria for three to five external teams or maintainers.
- Establish a disciplined Markdown baseline before introducing Forma.
- Measure setup/support time, schema/reference failures caught, Agent rework, task completion time, feature use, and continued weekly use.
- Separate source portability value from runtime/projection value.
- Define privacy, consent, evidence retention, success thresholds, and stop criteria.
- Repeat the pilot after guided modeling and safe-write milestones rather than waiting for every roadmap item.

## Out Of Scope

- Claiming market fit from release downloads or internal dogfooding.
- Broad market research, pricing, or a growth campaign.
- Collecting product telemetry without explicit design and consent.
- Selecting only repositories already optimized for Forma.

## Acceptance Criteria

- The comparison protocol, cohort criteria, measures, and stop conditions are explicit.
- Baseline and Forma-assisted workflows use the same representative jobs.
- Qualitative findings are separated from measured outcomes.
- A future experiment and metric record can capture results without changing the protocol.
- Results can recommend continue, narrow, reposition, or stop for each roadmap claim.

## Sequencing

Define the baseline alongside guided modeling. Run the first meaningful external comparison after guided modeling and import/normalization provide a complete adoption path.
