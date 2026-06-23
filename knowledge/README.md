---
scope: project
type: index
owners:
    - "members/tiscs"
tags:
    - knowledge
---

# Project Knowledge

This directory is the project knowledge base for this repository and is the principal source of product facts, task context, and delivery records.

## Current Product R&D Focus

The current internal-development focus is proving that Forma can manage this repository's project knowledge through repository Markdown, configured spaces, schemas, guidelines, CLI checks, and the WebApp read surface.

The active validation thread is replacing the old `knowledge-workflow` skills with Forma CLI plus configured guidelines. The main executable gate is [[tasks/run-starter-kit-agent-pressure-validation]], supported by the starter-kit validation suite in [[test-cases/forma-starter-kit]].

Use release, metric, user-story, experiment, test-case, and task records to judge current product readiness. Older migration and audit notes remain evidence, but should not be treated as the current execution entrypoint unless a current task, release, experiment, or planning record links to them.

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
- `cargo run -q -p forma-cli -- list --space <space-id> --json`
- `cargo run -q -p forma-cli -- inspect <path> --json`
- `cargo run -q -p forma-cli -- inspect --space <space-id> <entry-id> --json`

For Agent-assisted write, review, or task operations, use `cargo run -q -p forma-cli -- config inspect --json` first to discover configured guideline files and read them before acting.

## Source Layout

Current product planning should prefer:

- `product/`: product direction and accepted behavior
- `user-stories/`: actor-centered workflow intent
- `metrics/`: success criteria and release readiness thresholds
- `experiments/`: hypothesis-driven validation with metrics and guardrails
- `releases/`: release gates and rollout records
- `test-cases/`: reusable validation cases
- `tasks/`: executable work

Use `planning/` for planning records, audits, and migration evidence. Planning records can support decisions, but should not replace release, metric, user-story, or task records when those configured spaces are a better fit.

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
- Do not write local-only state to commits. Determine local-only status from workflow guidance and explicit user context; Forma itself does not infer knowledge semantics from SCM ignore rules.
- Keep `.agents` state, browser state, and local `.local` paths out of git history.

## Local-Only Workflow Material

The repo keeps local working context under ignored or otherwise local-only paths such as:

- `knowledge/workspace/*/local/`
- `.worktrees/`
- `.forma/local/` (when present)
- `target/` and other generated caches

These are not committed and not required for active runtime instructions.
