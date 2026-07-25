---
schemaVersion: 1
kind: task
scope: project
title: Design Guided Knowledge Modeling Flow
summary: Define the first user journey from a domain description or existing Markdown to a reviewable, healthy Forma workspace model.
type: task
priority: P1
value: H
module: product
effort: M
status: ready
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - product-value
    - onboarding
    - modeling
blockedBy: []
relatedTo:
    - "planning/forma-product-value-gap-roadmap"
    - "product/product-direction"
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: Guided workspace and knowledge modeling
---

# Design Guided Knowledge Modeling Flow

## Goal

Define the smallest product flow that helps a user turn a real domain description into an explainable first Forma slice without requiring prior Schema DSL or repository-layout expertise.

## Observed Baseline

Forma can bootstrap an empty workspace and its embedded guidance can help an Agent design the first content group. The product does not yet own a reviewable modeling flow or compare proposed structures against existing Markdown.

## In Scope

- Define inputs for domain discovery, existing-content inventory, and user intent.
- Produce a reviewable first-slice proposal for spaces, semantic types, create inputs, templates, guidelines, and initial views.
- Explain assumptions, alternatives, source paths, and intentionally deferred structure.
- Define CLI/Agent and future GUI boundaries without making an Agent the only usable surface.
- Specify representative fixtures for software R&D, research, and operations.

## Out Of Scope

- Implementing the flow.
- Importing or rewriting existing content.
- Generating a complete enterprise information architecture.
- Copying example workspaces as the default answer.

## Acceptance Criteria

- The accepted design defines one end-to-end journey from description to reviewed first slice.
- Every proposed artifact has a user-visible reason and source.
- The design can start from empty and existing repositories.
- Three domain fixtures define observable success and rejection cases.
- Follow-up implementation tasks can be split without changing the product contract.

## Sequencing

This is the first recommended roadmap item. [[tasks/design-markdown-import-normalization-flow]] depends on the modeling vocabulary and review boundary established here.
