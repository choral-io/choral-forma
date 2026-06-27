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
    - "tasks/audit-repository-knowledge-migration-scope"
    - "tasks/migrate-repository-knowledge-content"
---

# Repository Knowledge Content Migration Audit

## Purpose

Turn [[tasks/migrate-repository-knowledge-content]] into reviewable execution slices based on the current Forma configuration and repository knowledge state.

## Current Configured Spaces

The effective config currently defines these spaces:

- `product`
- `architecture`
- `decisions`
- `design`
- `concepts`
- `user-stories`
- `discovery`
- `metrics`
- `experiments`
- `guidelines`
- `planning`
- `proposals`
- `tasks`
- `test-cases`
- `members`
- `releases`
- `workspace-support`

The original migration design listed the smaller target baseline: `product`, `architecture`, `decisions`, `concepts`, `discovery`, `guidelines`, `planning`, `tasks`, `members`, and `workspace-support`.

The additional configured spaces are deliberate product-practice spaces introduced while replacing the old workflow skills: `design`, `user-stories`, `metrics`, `experiments`, `proposals`, `test-cases`, and `releases`. They should not be collapsed during migration unless a later product decision removes them.

## Migration Gaps

- The old `.workflow` directory is gone and should not be recreated.
- The repository no longer depends on Git ignore parsing for Forma runtime semantics.
- `knowledge/workspace/*/handoffs/**/*.md` and `knowledge/workspace/*/research/**/*.md` are configured workspace-support includes.
- `knowledge/workspace/*/local/**` remains local-only by repository ignore policy and is not a Forma runtime convention.
- Workspace-support research can remain shared support evidence. Durable synthesis should still be promoted to a canonical space such as `discovery`, `architecture`, or `product` when it becomes current product direction.

## Knowledge Workflow Reference Classification

References that should stay:

- Migration design records that explain Knowledge Workflow as source material, not a target compatibility requirement.
- The completed replacement task [[tasks/replace-knowledge-workflow-mechanics-with-forma-cli]].
- Starter-kit test cases that describe replacement pressure for old workflow-skill behavior.
- Guidelines that explicitly say current Forma guidance replaces old workflow skills.

References that should be cleaned next:

- Any current operating guidance that implies old workflow paths, schemas, or runtime files still drive behavior.
- Compatibility wording that can be replaced with current Forma CLI, configured guidelines, and configured spaces.
- Broad statements in task/planning records that read as a commitment to preserve the old workflow layout.

## Relationship Metadata Candidates

Canonical relationship metadata should continue to use path-qualified references, without `.md` suffixes, when the target is repository knowledge.

Fields to audit in the next metadata pass:

- `owners`
- `assignees`
- `reviewers`
- `blockedBy`
- `relatedTo`
- `sources`
- space-specific relationship fields such as `relatedTasks`, `relatedMetrics`, `relatedReleases`, `relatedTestCases`, and `relatedUserStories`

Known candidate to verify:

- `knowledge/product/product-direction.md` contains example-like `members/alex-chen.md` references inside the body. These may be illustrative examples rather than Forma-owned metadata, so they should not be changed mechanically without checking surrounding context.

## Workspace Support Candidates

Configured workspace-support pages:

- [[workspace/tiscs/handoffs/forma-markdown-parser-spike]]
- [[workspace/tiscs/handoffs/forma-starter-kit-to-system-refactor]]

Promotion candidates:

- The Markdown parser spike handoff and research report are historical technical evidence. If still useful, the durable synthesis should move to `discovery` or `architecture`; otherwise it can remain workspace support or be left as historical context.
- The starter-kit-to-system-refactor handoff has already driven implementation. Its remaining durable value is as migration context; canonical product and architecture documents should carry current decisions.

Omit from shared migration:

- `knowledge/workspace/*/local/**`
- local drafts, logs, worklists, and personal handoffs

## Historical Execution Order

This section records the execution order that was recommended during the migration audit. These tasks have since been completed or superseded by the current product R&D validation chain.

1. Promote [[tasks/clean-obsolete-knowledge-workflow-language]] to Ready and remove non-current workflow compatibility wording.
2. Normalize repository relationship metadata after cleanup reduces noisy historical references.
3. Classify workspace-support material once current language and relationship metadata are stable enough to judge what should be promoted.
4. Run [[tasks/normalize-repository-forma-knowledge-health]] after migration cleanup is complete.

## Historical Verification Baseline

Baseline captured at the time of this audit:

- `cargo run -q -p forma-cli -- check --json` passes.
- `cargo run -q -p forma-cli -- workspace health --json` reported 8 warnings, all pre-existing:
    - no outgoing refs: `knowledge/architecture/forma-p0-schema-dsl-spec.md`
    - no backlinks: `knowledge/decisions/use-space-as-core-partition-model.md`
    - no outgoing refs: `knowledge/discovery/mainstream-knowledge-app-feature-analysis.md`
    - no backlinks and no outgoing refs: `knowledge/guidelines/dependency-governance.md`
    - no outgoing refs: `knowledge/members/tiscs.md`
    - no backlinks and no outgoing refs: `knowledge/product/forma-actions-triggers-concept.md`
