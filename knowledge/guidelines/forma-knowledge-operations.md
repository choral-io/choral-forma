---
scope: project
type: guideline
owners:
    - "members/Tiscs"
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

This guideline defines how humans and Agents work with this repository's Forma-managed knowledge base.

## Operating Model

- Markdown under `knowledge/` remains the source of project facts.
- `.forma.yml`, `.forma/spaces/*.md`, and `.forma/views/*.md` define the workspace structure and read models.
- Guidelines explain collaboration rules for humans and Agents.
- Schema validates document structure.
- Future policies will define machine-readable operation constraints.
- Operations such as check, audit, proposal, and apply should enforce machine-readable rules as they become available.

## Agent Read Workflow

Before task, review, audit, or knowledge work, Agents should run:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`

Agents should then load guideline files declared in `.forma.yml` that apply to the requested work.

## Write Boundary

- Do not write shared knowledge, task metadata, `.forma` config, or workflow state without explicit user approval.
- Prefer a dry-run or proposal summary before multi-file edits.
- After edits, run `cargo run -q -p forma-cli -- check --json`.
- When knowledge relationships matter, also run `cargo run -q -p forma-cli -- knowledge health --json`.
- Do not preserve obsolete compatibility notes for unreleased workflow behavior unless they are current product requirements.

## Local-Only Boundary

Do not commit:

- `knowledge/workspace/*/local/`
- `.forma/local/local.yml`
- `.agents/*/local`
- `.worktrees/`
- generated caches such as `target/`, `node_modules/`, package build outputs, or browser state.

## Task Workflow

- Task board membership is stored in task `status`.
- Task executability is stored in task `readiness`.
- Use `cargo run -q -p forma-cli -- board show --json` for current board state.
- Do not change task status without explicit user approval.
- Ready tasks should have owners, source context, and acceptance criteria.
- Blocked tasks should name their blockers through `blocked_by` or an explicit blocker note.
- Done readiness should be supported by verification evidence.

## Knowledge Placement

- Product behavior belongs in `knowledge/product/`.
- Technical architecture and contracts belong in `knowledge/architecture/`.
- Accepted lasting tradeoffs belong in `knowledge/decisions/`.
- UX and interaction design belongs in `knowledge/design/`.
- Delivery tasks belong in `knowledge/tasks/`.
- Release validation and rollout records belong in `knowledge/releases/`.
- Metrics, experiments, test cases, proposals, and user stories should use their dedicated spaces when the knowledge is durable enough to structure.

## Review Evidence

Review summaries should include:

- task or knowledge source context;
- files changed;
- checks run;
- checks not run;
- residual warnings or risks;
- whether follow-up task board changes are needed.
