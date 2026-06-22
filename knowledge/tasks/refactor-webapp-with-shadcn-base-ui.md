---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - webapp
    - ui
    - design-system

effort: L
status: backlog
readiness: needs-refinement
sprint:

blockedBy: []
relatedTo:
    - "tasks/implement-read-only-webapp"
    - "decisions/forma-p0-core-architecture"
    - "architecture/forma-core-technical-direction"

reportedBy:
affectedArea: WebApp UI foundation
---

# Refactor WebApp With shadcn/ui And Base UI

## Goal

Refactor the Forma WebApp UI foundation in P1 using shadcn/ui and Base UI.

## Sources

- [[tasks/implement-read-only-webapp]]
- [[decisions/forma-p0-core-architecture]]
- [[architecture/forma-core-technical-direction]]

## Context

The P0 WebApp established a local read-only browser interface for browsing, rendering, inspecting, and diagnosing Forma workspaces. Its current component structure and styling are intentionally lightweight. In P1, the WebApp should move toward a more durable UI foundation suitable for additional navigation, relationship, graph, editing-adjacent, or diagnostic workflows.

The preferred direction is to use shadcn/ui together with Base UI rather than continuing to grow bespoke controls for common UI primitives.

## In Scope

- Evaluate and introduce shadcn/ui and Base UI for the WebApp component foundation.
- Replace or wrap existing bespoke controls where the libraries provide better primitives.
- Preserve current read-only WebApp behavior while improving component structure, accessibility, and styling consistency.
- Keep Forma-specific workspace, document, reference, diagnostics, and navigation components separate from generic UI primitives.
- Update frontend build, lint, and type-check configuration as needed.
- Update durable design or architecture knowledge when the selected component boundaries are finalized.

## Out Of Scope

- Adding new product workflows beyond the refactor itself.
- Making the WebApp a full Markdown editor.
- Replacing the React/Vite WebApp stack.
- Changing core RPC operation semantics.
- Reworking CLI or server behavior except where required to serve the same WebApp assets.

## Acceptance Criteria

- The WebApp builds successfully with the selected shadcn/ui and Base UI dependencies.
- Existing read-only browsing, rendering, file/source preview, diagnostics, and view navigation behavior remains available.
- Shared generic controls are separated from Forma-specific product components.
- Common controls have accessible labels, keyboard behavior, and visible states consistent with the chosen UI foundation.
- Focused frontend checks pass for changed packages.
- Durable design or architecture documentation records the final component boundary and dependency choices.

## Relationship Notes

This task follows the P0 read-only WebApp implementation. It should remain P1 because P0 can continue with the existing custom UI while product behavior and RPC surfaces stabilize.

It may need to be split if dependency setup, component migration, and visual redesign become independently reviewable work streams.

## Open Questions

- Which exact Base UI package and import style should be used?
- Should shadcn/ui components be vendored into the repository, generated during setup, or introduced gradually as specific controls are migrated?
- Should this refactor target only the shell/navigation primitives first, or include document, table, kanban, and diagnostics surfaces in the same pass?
