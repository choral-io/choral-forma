---
scope: project
title: Proposal And Dry-Run Guidance
summary: Short Agent-facing procedure for deciding when to stop, produce a dry run, or create a proposal before shared workspace changes.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - agents
    - dry-run
    - proposal
skill:
    id: proposal-and-dry-run
    title: Proposal And Dry Run
    description: Use when an Agent may create, promote, reorganize, or materially update shared workspace content, task state, release evidence, configuration, guidelines, schemas, views, or proposals.
    triggers:
        - create shared content
        - promote local notes
        - change task status
        - update release evidence
        - create proposal
        - update guidelines
        - update config
        - multi-file content change
    order: 15
sources:
    - "guidelines/forma-workspace-operations"
    - "guidelines/content-maintenance"
    - "guidelines/task-selection"
    - "tasks/define-agent-markdown-authoring-workflow"
---

# Proposal And Dry-Run Guidance

## Purpose

This guideline is the short Agent-facing checkpoint for reviewable workspace changes. Use it before the broader authoring guideline when a request may require a dry run, proposal, or explicit human approval.

It is soft guidance. It does not replace Forma checks, Git review, or future product-level write operations.

Pressure coverage is tracked in [[test-cases/proposal-and-dry-run-guideline-pressure]].

## Agent Skill

### When To Use

Use this skill before editing when the change may:

- create, move, reorganize, or delete shared workspace content;
- promote local-only or private notes into shared content;
- change task `status`, `readiness`, blockers, owners, assignees, or reviewers;
- change release evidence, product direction, architecture, decisions, metrics, experiments, user stories, or validation records;
- change `.forma.md`, `.forma/**`, guidelines, schemas, views, templates, or skill metadata;
- add cross-file links, backlinks, embeds, or frontmatter references whose target may be ambiguous;
- modify more than one shared file;
- depend on conversation-only, inferred, generated, or conflicting evidence.

### Bootstrap

Run or confirm current output from:

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- config summary --sources --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- `cargo run -q -p forma-cli -- skills get proposal-and-dry-run`

If the task targets a specific entry or space, inspect it before planning the edit.

### Stop Rules

Stop and ask for confirmation before writing when:

- the target path or configured space is uncertain;
- the change affects task board state or release evidence;
- local-only material would become shared;
- the edit changes `.forma` config, guidelines, schemas, views, templates, or skill metadata;
- the user asked for an evaluation, recommendation, or plan but did not ask to write;
- the dry run says `Requires confirmation: yes`.

Do not treat a proposed board move, release decision, or content promotion as approved only because it appears useful.

### Direct Edit Fast Path

Skip the dry run only when all are true:

- the user explicitly approved the exact target and scope;
- the edit is single-file, low-risk wording or narrow metadata cleanup;
- the configured space is already known;
- no local-only, private, release, task-board, guideline, config, dependency, or cross-file evidence is being promoted;
- no new ambiguous reference is added.

Even on the fast path, run `cargo run -q -p forma-cli -- check --json` after editing.

### Dry-Run Output

Use this compact format before any non-fast-path write:

| Field                 | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| Decision              | create, update, promote, reorganize, cleanup, or proposal |
| Target space          | configured space id                                       |
| Target path           | workspace-relative path or unresolved                     |
| Source evidence       | files, command output, or conversation summary            |
| Planned changes       | concise file-by-file changes                              |
| Links/refs            | references to add, remove, or verify                      |
| Risk class            | low, medium, high                                         |
| Checks before write   | commands or inspections already run                       |
| Checks after write    | `check`, `workspace health`, tests, or none with reason   |
| Requires confirmation | yes/no and why                                            |

After presenting a dry run with `Requires confirmation: yes`, wait. Do not edit in the same response unless the user already explicitly approved that exact dry run.

### Proposal Choice

Create or recommend a proposal instead of editing canonical content when:

- the fact, decision, or scope is valuable but not accepted;
- multiple target spaces are plausible;
- a task or release decision needs review before it becomes operational truth;
- the change is broad enough that direct editing would hide review context;
- the user asks for options, critique, evaluation, or a plan rather than implementation.

A proposal should include source evidence, the proposed canonical target, review questions, and acceptance criteria. Do not present a proposal as delivered work.

### Scenario Templates

#### Task Or Board Change

- Inspect the task and task board.
- State the current `status`, `readiness`, blockers, owners, and reviewers.
- Propose exactly one state or metadata change.
- Require confirmation unless the user explicitly requested that exact change.
- After approved edits, run `check --json` and render the task board.

#### Local-To-Shared Promotion

- Identify the local source as local-only.
- Summarize only the durable facts to promote.
- Choose the canonical target space and path.
- Exclude private notes, command chatter, credentials, and sensitive data.
- Require confirmation before writing.
- After approved edits, run `check --json` and `workspace health --json`.

#### Proposal Creation

- Explain why a proposal is safer than direct canonical capture.
- Choose the `proposals` space unless a more specific configured proposal path exists.
- Link sources and proposed canonical targets.
- Set status as proposed or draft according to existing local convention.
- After approved edits, run `check --json` and `workspace health --json`.

#### Release Evidence Or Cutline Change

- Inspect the release record and related task or validation evidence first.
- For release candidate gates, tag publication, published-asset verification, and closure evidence, follow [[guidelines/release-execution-and-verification]].
- State whether the user asked for evaluation, release recommendation, record update, tag/push action, or all of them.
- Treat release readiness, cutline, tag movement, rollout status, and validation history changes as high risk.
- Require confirmation before writing release records unless the user explicitly requested that exact update.
- Never push, tag, move a tag, or publish based only on a release dry run.
- After approved edits, run `check --json` and `workspace health --json`; before push or tag actions, run the project validation gate requested by the maintainer.

#### Guideline Or Config Change

- Show the current skill or config discovery impact.
- Name any new or changed workspace-projected skill id.
- Require confirmation before writing unless the user explicitly approved the exact change.
- After approved edits, run `skills list --json`, `skills get <id>`, `check --json`, and `workspace health --json`.
