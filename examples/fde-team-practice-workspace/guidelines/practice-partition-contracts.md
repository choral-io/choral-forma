---
scope: workspace
title: Practice Workspace Partition Contracts
summary: Routing, evidence, de-identification, and human review rules for each team-defined practice partition.
type: practice-guideline
status: active
synthetic: "true"
engagementKey: ENG-SYN-001
tags:
    - fde
    - practice
    - partition-contracts
skill:
    id: practice-partition-contracts
    title: Practice Workspace Partition Contracts
    description: Route de-identified observations and reviewed practice records without crossing workspace or approval boundaries.
    projection: section
    order: 5
sources:
    - patterns/acknowledgement-window-diagnostic
relatedTo:
    - overview/practice-map
---

# Practice Workspace Partition Contracts

The directory names below are team conventions backed by separate Forma content groups. A source observation, evidence card, review, pattern, guideline, and revalidation are different record types and must not be collapsed into one generic content group.

| Partition | Use for | Required contract | Human or boundary rule |
| --- | --- | --- | --- |
| `overview/` | Narrative practice map | Source project references | Orientation only; not a second source of truth |
| `customers/` | Minimal de-identified customer indexes | Environment and allowed-share boundary | Source FDE owns facts and de-identification |
| `projects/` | De-identified project observations | Project key, environment, customer-local reference, allowed share | No cross-workspace import or original path |
| `communications/` | Authorized source indexes | Source id/kind and local project reference | Do not copy original communication bodies |
| `evidence-cards/` | Cross-project comparison evidence | Two projects, different conditions, failure path, revalidation reason | Human reviewer decides whether abstraction is acceptable |
| `verification/` | Positive, negative, and adjusted result manifests | Project, environment, result, exit status, actual output | Failure and counterexample remain visible |
| `proposals/` | Candidate practice abstractions | Evidence references and limited claim | Never auto-promote |
| `reviews/` | Human acceptance, rejection, or adjustment | Decision, reviewer role, reason, evidence | Agent may prepare; human approves |
| `patterns/` | Reviewed conditional practice | Applicability, limits, counterexample, evidence | Not a universal configuration |
| `guidelines/` | Agent-facing reuse instructions | Practice guideline metadata and evidence references | Revalidate against the current project |
| `reusable-templates/` | Reviewed team-authored shapes | Applicability, limits, evidence | Team convention, not a Forma built-in |
| `revalidations/` | Current-project reuse decisions | Environment, result, reason, adjustment | Required before reusing a pattern |
| `roles/` | Responsibility metadata | Owner role and local context | Not RBAC or an authorization grant |
| `portfolio-observation/` | Minimal attention metadata | Stage, blocker, health, owner, project references | Not a built-in portfolio or customer truth |

## Agent Skill

Route a new record through the partition table, preserve de-identification and local references, and stop for human review before accepting or reusing a practice.

## Agent routing

1. Read this contract and the distillation/reuse guidelines before creating or editing a practice record.
2. Choose the partition whose contract matches the record's purpose. Use its content group's schema and template rather than writing a generic Markdown card.
3. Keep every `entryRef` workspace-local. `ENG-SYN-001` is a narrative scenario key only; it is not a join, authorization credential, path, synchronization key, or promotion trigger.
4. Keep source observations, evidence, review, practice artifacts, and revalidation as separate stages. An Agent may compare and draft, but human review controls acceptance.
5. Do not treat `portfolio-observation/` as a portfolio capability or `reusable-templates/` as automatic distribution.

<!-- forma:content -->
