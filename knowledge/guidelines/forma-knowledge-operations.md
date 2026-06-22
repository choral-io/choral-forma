---
scope: project
title: Forma Knowledge Operations
summary: General operating boundary for Human and Agent work over this Forma-managed repository knowledge base.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - agents
    - knowledge-operations
sources:
    - "product/product-direction"
    - "architecture/forma-core-technical-direction"
---

# Forma Knowledge Operations

## Purpose

This guideline defines the general operating boundary for humans and Agents working with this repository's Forma-managed knowledge base.

## Operating Model

- Markdown under `knowledge/` remains the source of project facts.
- `.forma.yml`, `.forma/spaces/*.md`, and `.forma/views/*.md` define the workspace structure and read models.
- Guidelines explain collaboration rules, soft constraints, and lightweight procedure checklists for humans and Agents.
- Schema validates document structure.
- Future policies will define machine-readable operation constraints.
- Operations such as check, audit, proposal, and apply should enforce machine-readable rules only when those rules exist in runtime configuration and the operation can consume them.

## Agent Read Workflow

Before task, review, audit, or knowledge work, Agents should run:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`

Agents should then load guideline files declared by `config inspect` before task, board, review, proposal, or shared knowledge operations. Guidelines may include general rules as well as workflow-specific procedures.

Agent workflow should be config-driven:

1. Read effective workspace config.
2. Read configured workspace guidelines.
3. If acting on a specific space, view, task, or file, inspect it and read any guidelines returned by that operation.
4. Use Forma CLI/RPC operation output as evidence.
5. Apply the relevant guideline procedure.
6. Report any guideline gap instead of inventing hidden rules.

## Write Boundary

- Do not write shared knowledge, task metadata, `.forma` config, or repository operating state without explicit user approval.
- Prefer a dry-run or proposal summary before multi-file edits.
- After edits, run `cargo run -q -p forma-cli -- check --json`.
- When knowledge relationships matter, also run `cargo run -q -p forma-cli -- knowledge health --json`.
- Do not preserve obsolete compatibility notes for unreleased workflow behavior unless they are current product requirements.

## Local-Only Boundary

Do not commit:

- `knowledge/workspace/*/local/`
- `.forma/local/`
- `.agents/*/local`
- `.worktrees/`
- generated caches such as `target/`, `node_modules/`, package build outputs, or browser state.

Treat local-only status as workflow guidance, explicit user context, or a future explicit configuration-entry concern, not as an intrinsic Forma path rule. Forma runtime does not infer knowledge semantics from `.gitignore`, and a directory named `local/` is ordinary content unless the current Human/Agent workflow treats it as private.

## Task Workflow

- Task board membership is stored in task `status`.
- Task executability is stored in task `readiness`.
- Use `cargo run -q -p forma-cli -- board show --json` for current board state.
- Do not change task status without explicit user approval.
- Ready tasks should have owners, source context, and acceptance criteria.
- Blocked tasks should name their blockers through `blocked_by` or an explicit blocker note.
- Done readiness should be supported by verification evidence.
- For delivery selection, audit, and board maintenance details, follow the configured delivery guideline, currently [[guidelines/task-selection]].

## Knowledge Placement

- Product behavior belongs in `knowledge/product/`.
- Technical architecture and contracts belong in `knowledge/architecture/`.
- Accepted lasting tradeoffs belong in `knowledge/decisions/`.
- UX and interaction design belongs in `knowledge/design/`.
- Delivery tasks belong in `knowledge/tasks/`.
- Release validation and rollout records belong in `knowledge/releases/`.
- Metrics, experiments, test cases, proposals, and user stories should use their dedicated spaces when the knowledge is durable enough to structure.
- For intake, promotion, cleanup, schema audit, and status reporting details, follow the configured knowledge maintenance guideline, currently [[guidelines/knowledge-capture]].

## Review Evidence

Review summaries should include:

- task or knowledge source context;
- files changed;
- checks run;
- checks not run;
- residual warnings or risks;
- whether follow-up task board changes are needed.

## Source Of Guidance

This document and the configured guidelines replace the old repository-local knowledge workflow skills as soft Human/Agent operating guidance. They do not recreate the old workflow runtime or make its deleted files authoritative.
