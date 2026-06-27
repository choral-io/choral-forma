---
scope: project
type: planning
owners:
    - "members/tiscs"
tags:
    - forma
    - knowledge
    - migration
sources:
    - "architecture/repository-forma-workspace-migration-design"
    - "planning/repository-knowledge-content-migration-audit"
    - "planning/workspace-support-material-classification"
    - "tasks/migrate-repository-knowledge-content"
---

# Repository Knowledge Content Migration Report

## Summary

The repository knowledge content migration is complete for the current Forma-managed structure.

The migration did not require a broad directory move because the current `.forma.md` configuration already recognizes the target repository spaces and the additional product-practice spaces introduced during the knowledge-workflow replacement work.

## Changed Assumptions

- The old `.workflow` directory is not part of the target workspace and is not recreated.
- Forma runtime semantics no longer depend on SCM ignore parsing.
- Current Agent guidance is config-driven through Forma CLI output and configured guidelines.
- Relationship metadata uses path-qualified entry references, not wikilink strings or `.md` suffixed page refs.
- Workspace-support material is retained only when it is useful shared support context; local execution context remains local-only by repository workflow.

## Changed Knowledge

- Added [[planning/repository-knowledge-content-migration-audit]].
- Added [[planning/workspace-support-material-classification]].
- Split [[tasks/migrate-repository-knowledge-content]] into reviewable migration slices.
- Removed the invalid `forma board show` command from current guidelines.
- Normalized decision supersession metadata from wikilink strings to path-qualified refs.
- Updated product-direction metadata-reference examples to use canonical entry refs such as `members/alex-chen`.

## Health Normalization Result

The follow-up normalization task [[tasks/normalize-repository-forma-knowledge-health]] resolved the post-migration health warnings. Current validation reports:

- `forma check --json`: passed
- `forma workspace health --json`: passed with 0 warnings

The resolved warnings were relationship-density warnings rather than broken or ambiguous references. They were fixed with meaningful related-knowledge links and one dependency-review guidance link.

## Starter-Kit Alignment Pass

The starter-kit validation pass confirmed that `examples/forma-starter-kit` remains clean enough to serve as the product-level evaluation fixture before continuing current repository migration:

- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit config inspect --json`: passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit check --json`: passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit workspace health --json`: passed with 0 errors and 0 warnings.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks list --json`: passed and exposed the intended sample task states.
- `cargo run -q -p forma-cli -- --workspace examples/forma-starter-kit tasks inspect --json tasks/add-team-notes.md`: passed and returned workspace plus task-specific guidelines.

The current repository migration can therefore continue from the project workspace itself rather than by changing the starter baseline.

The first resumed cleanup normalized completed task metadata where the task status was already `done` but `readiness` still said `needs-refinement`. Those entries now follow the repository's current task metadata model, where completed work should not appear as still needing refinement during Forma task selection or board review.

## Ownership Metadata Pass

The next cleanup pass normalized `owners` metadata for current canonical shared project content in the configured product, architecture, decision, concept, discovery, guideline, and repository README spaces.

This pass intentionally did not fill empty `assignees`, `reviewers`, template defaults, or historical workspace-support files:

- empty `assignees` can mean unassigned work;
- empty `reviewers` can mean no review owner has been assigned yet;
- template defaults should remain neutral for future generated content;
- historical workspace-support files keep their original context unless promoted into canonical spaces.
