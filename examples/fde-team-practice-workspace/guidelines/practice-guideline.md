---
scope: workspace
title: "Practice Guideline: Revalidate Before Reuse"
summary: Use reviewed patterns as investigation prompts and revalidate them against the current project.
type: practice-guideline
status: active
synthetic: "true"
engagementKey: ENG-SYN-001
tags:
    - practice
    - revalidation
skill:
    id: revalidate-before-reuse
    title: Revalidate Before Reuse
    description: Apply a reviewed practice only after checking current project conditions, limits, and failure paths.
    projection: section
    order: 20
sources:
    - patterns/acknowledgement-window-diagnostic
relatedTo:
    - overview/practice-map
---

# Practice Guideline: Revalidate Before Reuse

Use the partition contract to distinguish source observations, reviewed practice, and current-project revalidation.

## Agent Skill

Treat a reviewed pattern as a conditional starting point. Read the current project facts first, compare environment and applicability, preserve known counterexamples, and ask for human review when conditions differ.

Never infer customer authorization, cross-workspace access, or promotion permission from a source key such as `ENG-SYN-001`.
