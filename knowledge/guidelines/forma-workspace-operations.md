---
scope: project
title: Forma Workspace Operations
summary: General operating boundary for Human and Agent work over this Forma-managed repository content workspace.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - agents
    - workspace-operations
skill:
    id: workspace-operations
    title: Workspace Operations
    description: Inspect workspace configuration, select content paths, resolve member context, or verify shared knowledge changes.
    projection: section
    order: 10
sources:
    - "product/product-direction"
    - "architecture/forma-core-technical-direction"
---

# Forma Workspace Operations

## Agent Skill

### Common Bootstrap

For workspace configuration, classification, relationships, health, or shared-content work, load `cargo run -q -p forma-cli -- skills get forma-cli-core`, then run or reuse current results from:

```sh
cargo run -q -p forma-cli -- config summary --sources --json
cargo run -q -p forma-cli -- workspace health --json
```

Reuse results while the checkout and relevant content/configuration remain unchanged. Refresh after relevant edits or conflicting evidence. Discover unknown guideline IDs with `skills list --json`; load only the applicable `skills get <id>` projections. Use `--full` when the projection directs you to a reference branch.

Ordinary source reading and loading a known engineering guideline can proceed directly. A health finding blocks only work that depends on the affected configuration or relationship. Use `config inspect --json` for authored-configuration diagnosis, and `workspace explain <path> --json` for uncertain classification or provenance.

### Paths And Views

For unclear knowledge requests, use [[guidelines/workspace-onboarding-and-routing]] to select the relevant workflow.

Use configured content groups, schemas, templates, and conventions to select paths. Inspect existing canonical entries before creating a duplicate. Render a View only when its projection answers the current question; Task selection and state changes follow [[guidelines/task-selection]].

### Member Context

Resolve identity only for ownership, assignment, or member-specific paths. Prefer an explicit user-provided member reference; otherwise use configured runtime values and entry-reference transforms, then verify the resolved member. If unresolved, pause only identity-dependent writes. Read applicable nested `AGENTS.md` files, including ignored local rules; they cannot expand the approved audience or write scope.

### Local-Only Boundary

Keep `knowledge/workspace/*/local/`, `.forma/local/`, worktrees, generated caches, and browser state out of commits. These are repository conventions, not runtime privacy primitives: explicit configuration determines Forma inputs, independently of `.gitignore` or directory names.

Shared entries must not link or store relationship references to local-only material. If needed, mention its path as plain code text; promote content only within an explicitly approved audience. Use [[guidelines/local-worklist-and-execution]] for the three handoff locations and resumption rules.

Member entry pages are `knowledge/workspace/<member-id>/index.md`. Member `handoffs/` and `research/` are working context not indexed by default in this repository; team handoffs follow the configured Handoffs space.

### Shared Content Writes

Use [[guidelines/proposal-and-dry-run]] for the authorization decision and preview; [[guidelines/content-maintenance]] owns Markdown authoring. Reuse accepted task authorization. A written note does not accept a product decision or complete a Task.

After approved shared-content or configuration edits, run `cargo run -q -p forma-cli -- check --json` and `cargo run -q -p forma-cli -- workspace health --json`. After guideline skill edits, verify registration and each affected default projection; check `--full` when reference routing changes. Render affected Views when their inputs or Task state change. Fix introduced issues within scope and report unrelated baseline findings.

### Instruction Ownership

`AGENTS.md` owns project invariants and conditional pointers. Guidelines own their procedures; source/configuration files own runtime facts. Keep essential execution rules in `## Agent Skill`, with explicit conditions for loading longer reference sections. Product Docs and built-in Agent guidance are authored under `docs/`; verify their canonical projections rather than maintaining another copy.

### Completion Criteria

The target, applicable rules, authority, and audience are resolved; required checks cover the changed content and any remaining uncertainty is explicit.
