---
scope: workspace
title: Practice Distillation
summary: Human-reviewed, de-identified comparison workflow for turning project evidence into limited team practice.
tags:
    - fde
    - practice
    - de-identification
    - boundaries
skill:
    id: practice-distillation
    title: Practice Distillation
    description: Compare already-authorized local evidence cards, preserve differences and failures, and stop before human approval or cross-workspace action.
    projection: section
    order: 10
sources:
    - patterns/acknowledgement-window-diagnostic
relatedTo:
    - overview/practice-map
---

# Practice Distillation

## Agent Skill

Use only the two de-identified source indexes and local evidence card in this workspace. Confirm that the evidence card has two source projects, different environments, a failure or counterexample, and a revalidation reason.

Agents may compare local entries and draft a proposal. They must not scan another workspace, import customer content, infer authorization from `ENG-SYN-001`, or automatically promote a proposal into a pattern, guideline, template, or code asset.

The source project FDE remains responsible for source facts and de-identification. The practice reviewer is responsible for accepting, rejecting, or adjusting the proposed abstraction. Portfolio observation contains metadata only and is not a second source of customer truth.

## Review Gate

Do not accept a general conclusion when the two projects have the same conditions only. Preserve the production-naive failure and explain why the adjusted revalidation still applies or requires changes.
