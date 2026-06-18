---
scope: project
type: task
priority: P1
severity:
value: H
module: knowledge

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - review
    - knowledge

effort: M
readiness: needs-refinement
sprint:

blocked_by: []
related_to:
    - "[[tasks/implement-operation-rpc-cli-foundation]]"
    - "[[tasks/implement-check-index-diagnostics]]"

reported_by:
affected_area: Reviewable knowledge changes
---

# Design Reviewable Knowledge Change Proposals

## Goal

Design how Forma should represent reviewable knowledge changes before they are committed to repository files.

## Sources

- [[discovery/mainstream-knowledge-app-feature-analysis]]
- [[product/choral-forma]]
- [[product/product-direction]]
- [[tasks/implement-operation-rpc-cli-foundation]]

## Context

Product research and direction identify reviewable change proposals as a core differentiator for human and Agent collaboration. The product should help users and Agents maintain structured knowledge without hiding the repository as the source of truth. The design needs to clarify whether reviewable changes map directly to Git branches and commits, or whether Forma introduces an intermediate proposal layer.

## In Scope

- Define user-facing and Agent-facing goals for reviewable knowledge changes.
- Compare direct Git-diff review with an intermediate Forma proposal model.
- Define how proposals relate to files, diagnostics, checks, and future write operations.
- Identify P1/P2 boundaries and follow-up implementation tasks.
- Update product, architecture, or decision knowledge with the accepted model.

## Out Of Scope

- Implementing proposal storage or review UI.
- Git hosting integration.
- Pull request automation.
- Multi-user realtime collaboration.
- Agent autonomy policy beyond the reviewable change model.

## Acceptance Criteria

- The design states whether Forma should use direct Git diffs, an intermediate proposal model, or both.
- The design explains how humans and Agents review proposed file changes.
- The design preserves repository files as the durable source of truth.
- Follow-up implementation tasks can be created with clear P1/P2 boundaries.
- Open product risks are listed explicitly.

## Relationship Notes

This task should be handled before building broader write or Agent-assisted maintenance surfaces.

## Open Questions

- Should Forma proposals be files in the workspace, local-only runtime state, or Git branches/commits?
- How much of this should be handled by Agent Skills instead of core Forma product behavior?
