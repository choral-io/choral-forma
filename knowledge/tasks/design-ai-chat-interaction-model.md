---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "members/Tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - webapp
    - ai
    - chat

effort: M
status: backlog
readiness: needs-refinement
sprint:

blocked_by:
    - "tasks/implement-webapp-v2-dashboard-shell"
    - "tasks/design-reviewable-operation-proposal-flow"
related_to:
    - "decisions/webapp-primary-gui-client"
    - "planning/webapp-primary-gui-roadmap"
    - "concepts/agent-assisted-knowledge-maintenance"

reported_by:
affected_area: WebApp AI Chat
---

# Design AI Chat Interaction Model

## Goal

Design the WebApp AI Chat model for explaining, navigating, diagnosing, and proposing knowledge maintenance actions without bypassing repository review boundaries.

## Sources

- [[decisions/webapp-primary-gui-client]]
- [[planning/webapp-primary-gui-roadmap]]
- [[concepts/agent-assisted-knowledge-maintenance]]
- [[tasks/design-reviewable-operation-proposal-flow]]

## Context

AI Chat is a natural fit for the primary WebApp GUI because it can see workspace state, diagnostics, references, views, and user-selected context. It also creates safety risk if suggestions are treated as direct writes. The first model should define Chat modes and boundaries before implementation.

## In Scope

- Define supported AI Chat modes such as explain, find, diagnose, draft, dry-run, and propose.
- Define what workspace context the Chat surface can read from existing and future Forma operations.
- Define how Chat suggestions become operation proposals rather than direct file writes.
- Define privacy, local-only, confirmation, and audit boundaries for Chat.
- Identify backend operation needs and follow-up implementation tasks.

## Out Of Scope

- Selecting a specific model provider.
- Implementing network calls, credentials, billing, or hosted AI services.
- Letting Chat silently edit repository files.
- Full autonomous Agent execution.
- Editor extension Chat surfaces.

## Acceptance Criteria

- The design defines Chat modes and clear safety boundaries.
- Chat output paths into reviewable operation proposals are explicit.
- Required RPC/CLI context operations are listed.
- Privacy and local-only constraints are documented.
- Follow-up implementation tasks can be created with clear P1/P2 boundaries.

## Relationship Notes

This task depends on the proposal flow because Chat should produce explainable plans or proposals before any write-capable implementation is considered.

## Open Questions

- Should the first Chat implementation be provider-agnostic shell design only, or include a local/manual mock provider for dogfooding?
