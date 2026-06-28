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
sources:
    - "product/product-direction"
    - "architecture/forma-core-technical-direction"
---

# Forma Workspace Operations

## Purpose

This guideline defines the general operating boundary for humans and Agents working with this repository's Forma-managed content workspace.

## Operating Model

- Markdown under `knowledge/` remains the source of project facts.
- `.forma.md`, `.forma/spaces/*.md`, and `.forma/views/*.md` define the workspace structure and read models.
- Guidelines explain collaboration rules, soft constraints, and lightweight procedure checklists for humans and Agents.
- Schema validates document structure.
- Future policies will define machine-readable operation constraints.
- Operations such as check, audit, proposal, and apply should enforce machine-readable rules only when those rules exist in runtime configuration and the operation can consume them.

## Agent Read Workflow

Before task, review, audit, or project workspace work, Agents should run:

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- workspace health --json`

The built-in `forma-cli-core` guide is packaged with the Forma binary from the product documentation source `docs/agents/forma-cli-core.md`. It is embedded product documentation, not a project workspace guideline, and does not need to be listed in `.forma.md`.

Agents should then use `cargo run -q -p forma-cli -- skills list --json` to discover workspace-projected skills and load guideline files declared by `config inspect` before task, board, review, proposal, or shared project-content operations. Guidelines may include general rules as well as workflow-specific procedures.

Agent workflow should be config-driven:

1. Load the built-in CLI guide from `forma skills get forma-cli-core`.
2. Read effective workspace config.
3. Discover workspace-projected skills.
4. Read configured workspace guidelines.
5. If acting on a specific space, view, task, or file, inspect it and read any guidelines returned by that operation.
6. Use Forma CLI/RPC operation output as evidence.
7. Apply the relevant guideline procedure.
8. Report any guideline gap instead of inventing hidden rules.

## Write Boundary

- Do not write shared project content, task metadata, `.forma` config, or repository operating state without explicit user approval.
- Prefer a dry-run or proposal summary before multi-file edits.
- After edits, run `cargo run -q -p forma-cli -- check --json`.
- When content relationships matter, also run `cargo run -q -p forma-cli -- workspace health --json`.
- Do not preserve obsolete compatibility notes for unreleased workflow behavior unless they are current product requirements.

## Local-Only Boundary

Do not commit:

- `knowledge/workspace/*/local/`
- `.forma/local/`
- `.agents/*/local`
- `.worktrees/`
- generated caches such as `target/`, `node_modules/`, package build outputs, or browser state.

Treat local-only status as workflow guidance, explicit user context, or a future explicit configuration-entry concern, not as an intrinsic Forma path rule. Forma runtime does not infer knowledge semantics from `.gitignore`, and a directory named `local/` is ordinary content unless the current Human/Agent workflow treats it as private.

Shared team knowledge must not link to member local content. Do not add wikilinks, Markdown links, or frontmatter relationship fields that target `knowledge/workspace/*/local/**`, `.forma/local/**`, or other local-only paths. If a shared page needs to acknowledge that local material exists, mention the local path as plain code text and ask before promoting any content from it.

## Member Workspace Placement

- `knowledge/workspace/<member-id>/index.md` is the shared entry page for a member workspace.
- `knowledge/workspace/<member-id>/handoffs/` stores working handoffs and continuation notes that are not indexed by default.
- `knowledge/workspace/<member-id>/research/` stores working support research evidence that is not indexed by default.
- `knowledge/workspace/<member-id>/local/` stores local-only drafts, logs, worklists, scratchpads, and private execution context.
- Promote workspace material only after a human approves the destination and scope. Stable conclusions should move to the relevant canonical space instead of staying in workspace indefinitely.

## Task Workflow

- Task board membership is stored in task `status`.
- Task executability is stored in task `readiness`.
- Use `cargo run -q -p forma-cli -- list --space tasks --json` for current task entries.
- Use `cargo run -q -p forma-cli -- view render .forma/views/task-board --json` for status-based board membership.
- Do not change task status without explicit user approval.
- Ready tasks should have owners, source context, and acceptance criteria.
- Blocked tasks should name their blockers through `blockedBy` or an explicit blocker note.
- Done readiness should be supported by verification evidence.
- For delivery selection, audit, and board maintenance details, follow the configured delivery guideline, currently [[guidelines/task-selection]].

## Content Placement

- Product behavior belongs in `knowledge/product/`.
- Technical architecture and contracts belong in `knowledge/architecture/`.
- Accepted lasting tradeoffs belong in `knowledge/decisions/`.
- UX and interaction design belongs in `knowledge/design/`.
- Delivery tasks belong in `knowledge/tasks/`.
- Release validation and rollout records belong in `knowledge/releases/`.
- Metrics, experiments, test cases, proposals, and user stories should use their dedicated spaces when the content is durable enough to structure.
- For intake, promotion, cleanup, schema audit, and status reporting details, follow the configured content maintenance guideline, currently [[guidelines/content-maintenance]].

## Review Evidence

Review summaries should include:

- task or content source context;
- files changed;
- checks run;
- checks not run;
- residual warnings or risks;
- whether follow-up task board changes are needed.

When a change adds, removes, or pre-positions third-party dependencies, follow [[guidelines/dependency-governance]] as part of review evidence.

## Source Of Guidance

This document and the configured guidelines replace the old repository-local content workflow skills as soft Human/Agent operating guidance. They do not recreate the old workflow runtime or make its deleted files authoritative.
