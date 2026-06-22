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

The migration did not require a broad directory move because the current `.forma.yml` configuration already recognizes the target repository spaces and the additional product-practice spaces introduced during the knowledge-workflow replacement work.

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
- `forma knowledge health --json`: passed with 0 warnings

The resolved warnings were relationship-density warnings rather than broken or ambiguous references. They were fixed with meaningful related-knowledge links and one dependency-review guidance link.
