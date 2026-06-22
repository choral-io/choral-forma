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
    - diagnostics
    - resources

effort: S
status: done
readiness: ready
sprint:

blockedBy:
    - "tasks/implement-workspace-resource-routes"
relatedTo:
    - "tasks/expose-read-only-knowledge-health-in-webapp"
    - "tasks/implement-check-index-diagnostics"

reportedBy:
affectedArea: Resource health diagnostics
---

# Implement Resource Description Health Diagnostics

## Goal

Detect resource description documents whose target resource file is missing.

## Sources

- [[tasks/implement-workspace-resource-routes]]
- [[tasks/expose-read-only-knowledge-health-in-webapp]]
- [[architecture/forma-p0-check-index-spec]]
- [[architecture/forma-p0-operation-api-spec]]

## Context

Workspace resource routes and resource file inventory are separate from knowledge-entry checks. A non-Markdown resource such as `assets/logo.png` may exist without a Markdown description document. When a description document such as `assets/logo.png.md` exists, it represents knowledge about the resource and the described target should exist.

The raw route/resource inventory baseline does not need to own this health rule. The rule belongs with diagnostic and health behavior so users can find broken resource documentation without making resources part of spaces, graph nodes, backlinks, or normal knowledge-entry validation.

## In Scope

- Detect Markdown resource description documents whose filename-derived target resource is missing.
- Emit a diagnostic such as `resource.description.missingTarget` with the description document path and missing target path.
- Keep resource files themselves out of spaces, graph nodes, backlinks, and knowledge-entry checks by default.
- Add focused Rust coverage for present-resource and missing-resource cases.
- Update operation or health documentation if the diagnostic becomes an API contract.

## Out Of Scope

- Requiring every resource file to have a description document.
- Adding a required `target` frontmatter field.
- Full media preview UI.
- Automatic fixes or file creation.
- Changing raw route access rules.

## Acceptance Criteria

- `assets/logo.png.md` with an existing `assets/logo.png` does not produce a missing-target diagnostic.
- `assets/logo.png.md` without `assets/logo.png` produces a `resource.description.missingTarget` diagnostic.
- The diagnostic uses workspace-relative POSIX paths only.
- Non-Markdown resources do not become space entries, graph nodes, or backlink participants because of this check.
- Focused Rust checks pass for the changed diagnostic behavior.

## Relationship Notes

This task follows the raw route/resource inventory baseline. The `blockedBy` entry records dependency history and is resolved once [[tasks/implement-workspace-resource-routes]] is in Done.

It can feed the read-only knowledge health WebApp task.

## Validation Notes

- Implemented `resource.description.missingTarget` in core workspace discovery.
- Added focused Rust coverage for present-resource and missing-resource description documents.
- Updated check/index and operation API architecture docs for the new diagnostic contract.
- Validation passed on 2026-05-25:
    - `cargo test -p forma-core resource_description_documents_report_missing_targets`
    - `cargo test -p forma-core`
    - `cargo test -p forma-rpc`
    - `pnpm exec prettier --check "knowledge/**/*.md"`
    - `mise run check:rust`
    - `git diff --check`

## Open Questions

-
