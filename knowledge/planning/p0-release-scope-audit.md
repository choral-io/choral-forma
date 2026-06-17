---
scope: project
type: roadmap
owners:
    - "[[members/Tiscs]]"
reviewers: []
tags:
    - forma
    - p0
    - planning
    - release
sources:
    - "[[product/product-direction]]"
    - "[[product/forma-p0-starter-spec]]"
    - "[[architecture/forma-core-technical-direction]]"
    - "[[architecture/forma-p0-operation-api-spec]]"
    - "[[architecture/forma-p0-check-index-spec]]"
    - "[[architecture/forma-p0-schema-dsl-spec]]"
    - "[[architecture/forma-view-query-model]]"
    - "[[decisions/forma-p0-core-architecture]]"
    - "[[planning/KANBAN]]"
    - "[[tasks/audit-p0-release-scope-and-roadmap]]"
---

# P0 Release Scope Audit

## Summary

The current P0 plan is feature-complete enough to stop adding product surface
area and switch to release validation. The remaining P0 work should converge on
source stability, full validation evidence, and an explicit release cutline.

The remaining Backlog is mostly P1/P2 follow-up work. Resource-description
health diagnostics are useful and already ready, but they are not part of the
minimum release bar described by the current P0 product, operation, check,
starter, and view-query documents.

## Completed P0 Capability Baseline

- Rust and pnpm workspace scaffold for the `forma` binary, shared Rust core,
  RPC model, CLI, shared TypeScript package, and read-only WebApp.
- P0 config and path model for explicit workspace configuration and safe
  workspace-relative path behavior.
- Forma Schema DSL, runtime values, template placeholders, semantic references,
  and starter-compatible validation behavior.
- Markdown parsing, frontmatter parsing, FormaAST enrichment, reference
  extraction, rendering inputs, and diagnostic source locations.
- Operation and RPC foundation shared by CLI, local HTTP, and WebApp callers.
- `check` diagnostics over source files and configuration without a committed
  persistent index.
- Starter flows for `forma init`, `forma create`, `forma inspect`, `forma list`,
  and workspace checks.
- View discovery, view metadata, table and kanban rendering, and graph view
  discovery/indexing without requiring interactive graph rendering in P0.
- Read-only local WebApp for browsing spaces, views, files, rendered
  Markdown, diagnostics, and index status.
- CI/release baseline, release packaging workflow, and MVP validation fixes.
- Reference navigation baseline through `file.references`, including outgoing
  references, backlinks, intent distinctions, and WebApp navigation.
- Workspace resource routing and inventory behavior for display-safe
  non-Markdown resources without turning resources into knowledge entries.

## P0 Release Bar

### Must Have

- Current delivery state must be stable in Git: local completion commits should
  be intentionally pushed or a release branch should be selected before release
  validation is treated as durable. The current branch is locally ahead of
  `origin/main`.
- Run and record a full release-validation matrix on the current release
  cutline, including knowledge checks, Rust checks/tests, Web checks/build, and
  a starter workspace smoke test.
- Confirm the release cutline does not include uncommitted implementation,
  generated, ignored, or local-only artifacts.
- Confirm P0 operations still match the documented boundary: CLI init,
  config inspect, check, inspect, list, create, serve, and WebApp-backed
  read-only file/view/reference operations.

### Should Have

- Record release-readiness evidence in a single task item so the next person can
  distinguish verified release facts from inferred completion.
- Keep the validation focused on already accepted P0 behavior instead of adding
  resource health, graph UI, search, write actions, or proposal workflows.
- Decide whether the completed local commits require a new prerelease artifact
  after validation.

### Deferred

- Interactive graph rendering.
- Read-only health dashboard improvements in the WebApp.
- Resource-description missing-target diagnostics.
- Quick switcher or full-text search.
- Metadata edit, deprecate, delete, move, rename, and fix commands.
- Reviewable knowledge change proposal workflows.
- UI system refactors that do not change the release bar.

## Remaining P0 Closure Gaps

- No single task currently owns full release validation and cutline evidence.
- The local branch is ahead of `origin/main`; release readiness is source-unstable
  until that state is intentionally resolved.
- Existing Done tasks contain focused validation notes, but there is not yet a
  current-HEAD release validation record that ties them together.

## Recommended Kanban Dry Run

| Card                                                        | Current       | Proposed                                | Rationale                                                                         |
| ----------------------------------------------------------- | ------------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| [[tasks/audit-p0-release-scope-and-roadmap]]                | Ready         | Reviewing after this report is accepted | The scope audit deliverable exists; move only after maintainer approval.          |
| [[tasks/run-p0-release-validation-and-cutline-check]]       | New task item | Ready                                   | This is the next executable P0 closure task and owns release validation evidence. |
| [[tasks/implement-resource-description-health-diagnostics]] | Backlog       | Backlog                                 | Useful P1 health improvement, but not a P0 release blocker.                       |
| [[tasks/expose-read-only-knowledge-health-in-webapp]]       | Backlog       | Backlog                                 | P1 WebApp improvement after the existing read-only baseline.                      |
| [[tasks/implement-interactive-graph-view-render]]           | Backlog       | Backlog                                 | P1; current view-query model only requires graph discovery/indexing for P0.       |
| [[tasks/implement-quick-switcher-search]]                   | Backlog       | Backlog                                 | P2; search/query commands are outside the initial P0 command set.                 |
| [[tasks/design-metadata-edit-deprecate-operations]]         | Backlog       | Backlog                                 | P1 design work; write/lifecycle commands are explicitly out of P0.                |
| [[tasks/design-reviewable-knowledge-change-proposals]]      | Backlog       | Backlog                                 | P1 design work after the read-only P0 baseline is validated.                      |

## Next Executable Task

Use [[tasks/run-p0-release-validation-and-cutline-check]] as the next P0 task.
It should not add product features. It should validate the current release
cutline, record exact evidence, and return a yes/no release-readiness result.
