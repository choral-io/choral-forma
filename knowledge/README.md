---
scope: project
type: index
owners: []
tags:
    - knowledge
---

# Project Knowledge

This directory is the project knowledge base for this repository and is the principal source of product facts, task context, and delivery records.

Active knowledge operations are managed by:

- Markdown documents under `knowledge/`
- `.forma.yml` workspace config
- `.forma.yml` configured guideline files (for example, `knowledge/guidelines/forma-knowledge-operations.md`) that define human and Agent operating rules
- `.forma/spaces/*.md` space configuration and index targets
- `.forma/views/*.md` read models

Use these bootstrap checks before read operations:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`

Use these read commands for routine agent work:

- `cargo run -q -p forma-cli -- tasks list --json`
- `cargo run -q -p forma-cli -- tasks inspect --json <task-id-or-path>`
- `cargo run -q -p forma-cli -- board show --json`
- `cargo run -q -p forma-cli -- list --space <space-id> --json`
- `cargo run -q -p forma-cli -- inspect <path> --json`
- `cargo run -q -p forma-cli -- inspect --space <space-id> <entry-id> --json`

For Agent-assisted write, review, or task operations, use `cargo run -q -p forma-cli -- config inspect --json` first to discover configured guideline files and read them before acting.

## Source Layout

- `members/`: member profiles and workspace mapping references
- `workspace/`: shared member workspaces, handoffs, and local-only personal work areas under `local/`
- `discovery/`: discovery notes, research, and assumptions
- `product/`: product requirements and user-facing behavior
- `user-stories/`: actor-centered product stories and use cases
- `concepts/`: reusable domain language
- `architecture/`: architecture notes and design direction
- `design/`: UX, product design, and interface specification records
- `decisions/`: accepted decisions
- `guidelines/`: cross-area process and documentation guidance
- `metrics/`: product, quality, and delivery metric definitions
- `experiments/`: product and workflow experiments
- `planning/`: roadmap, sprint plan, and Kanban state
- `proposals/`: queued review candidates
- `tasks/`: delivery task definitions and acceptance criteria
- `test-cases/`: reusable acceptance and validation cases
- `releases/`: release scope, validation, rollout, and follow-up records

## Writing and Operation Boundaries

- Do not write shared knowledge, `.forma.yml`, `.forma/spaces/*.md`, or task metadata directly without explicit user approval.
- Do not write local-only state to commits. Determine local-only status from project ignore rules and workflow guidance; in this repository that includes `knowledge/workspace/*/local/`, `.forma/local/` when present, generated caches, and worktree-only state.
- Keep `.agents` state, browser state, and local `.local` paths out of git history.

## Local-Only Workflow Material

The repo keeps local working context under ignored or otherwise local-only paths such as:

- `knowledge/workspace/*/local/`
- `.worktrees/`
- `.forma/local/` (when present)
- `target/` and other generated caches

These are not committed and not required for active runtime instructions.
