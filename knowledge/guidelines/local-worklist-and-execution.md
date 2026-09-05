---
scope: project
title: Local Worklist And Execution
summary: Guidance for team and personal handoffs plus member-local worklists, with explicit sharing and authorization boundaries.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - local
    - worklist
    - execution
    - agents
skill:
    id: local-worklist-and-execution
    title: Local Worklist And Execution
    description: Capture, update, or resume team or personal handoffs and local worklists while preserving authorization and knowledge boundaries.
    projection: section
    order: 50
sources:
    - "guidelines/forma-workspace-operations"
    - "guidelines/proposal-and-dry-run"
    - "guidelines/content-maintenance"
    - "guidelines/task-selection"
---

# Local Worklist And Execution

## Purpose

This guideline provides a lightweight replacement for the old member-local worklist flow. It keeps local execution state useful without making it part of shared project truth.

Local worklist behavior is intentionally smaller than the old workflow suite. This guideline also routes team and personal handoffs; use task, content, proposal, and review guidelines for shared-state changes.

## Agent Skill

### When To Use

Use this skill when the user asks to:

- capture, update, or resume a handoff;
- capture or resume member-local work;
- create, groom, or read a local worklist;
- record a concise execution log;
- decide whether a local draft should stay private or be promoted;
- coordinate worktree or local execution notes;
- continue a local item that may connect to a shared task.

### Bootstrap

For an explicitly supplied handoff, read it and applicable local rules first. Use `skills get workspace-operations` ([[guidelines/forma-workspace-operations]]) with the repository CLI when classification, ownership, shared references, or promotion requires a workspace baseline. Reuse current results. Resolve member identity only when choosing a member path; ambiguity blocks that write, not independent work.

### Local Paths

- Shared member entry: `knowledge/workspace/<member-id>/index.md`
- Local handoffs: `knowledge/workspace/<member-id>/local/handoffs/`
- Local worklist: `knowledge/workspace/<member-id>/local/WORKLIST.md`
- Local logs: `knowledge/workspace/<member-id>/local/logs/YYYY-MM-DD.md`
- Local drafts: `knowledge/workspace/<member-id>/local/drafts/`
- Local scratch: `knowledge/workspace/<member-id>/local/scratch/`
- Local worktrees: `.worktrees/`

Treat these paths as conventions for this workspace, not Forma built-ins.

### Rules

- Never write another member's local workspace without explicit confirmation.
- Never stage or commit `knowledge/workspace/*/local/**`, `.forma/local/**`, or worktree contents under `.worktrees/**`.
- Keep local worklist items short. Put details in logs or drafts.
- Do not use local-only material as shared planning evidence until the user approves a promotion path.
- Do not hide accepted shared task state in local notes. Shared task status and readiness belong in configured task entries.
- If a local item affects shared content, task metadata, release evidence, config, guidelines, schemas, or views, switch to [[guidelines/proposal-and-dry-run]] before writing shared files.

### Worklist Item Shape

Use a compact Markdown list:

```md
- [ ] Title
    - Status: active | waiting | blocked | done
    - Source: task path, local note, or conversation date
    - Next: one concrete next action
```

Avoid storing long transcripts, command logs, secrets, credentials, or private data.

### Handoff And Resumption

A handoff is focused continuation context, not a transcript, shared Task state, or a transfer of product-level responsibility. Tailor it to the next activity: investigation, implementation, or review.

#### Placement And Authority

- For a new handoff, default to team-shared `knowledge/handoffs/<topic>.md`. Use personal shared `knowledge/workspace/<member-id>/handoffs/<topic>.md` or personal local `knowledge/workspace/<member-id>/local/handoffs/<topic>.md` when the user specifies that placement. An explicit path takes precedence.
- When resuming or updating an existing handoff, retain its location and audience unless the user requests a move. The team default does not authorize publishing existing private context. Confirm any move that expands visibility and select only content appropriate to the approved audience.
- Team-shared handoffs are indexed by the configured Handoffs space. Personal shared handoffs are shareable repository files, with indexing determined by each workspace configuration; unindexed does not mean private. Personal local handoffs remain local-only.
- Use `type: handoff` and `scope: project` for new team handoffs, `scope: member` for personal shared handoffs, and `scope: local` for personal local handoffs. Preserve existing metadata on updates; these are repository conventions, not access controls.
- Keep local handoffs outside commits and shared indexes. Shared handoff placement follows the current workspace configuration and approved audience; a folder name alone does not grant privacy or authority.
- Creating or receiving a handoff does not authorize implementation, commits, publication, Task acceptance, or local-to-shared promotion. Carry forward the actual approved scope and identify decisions that still require approval.
- Promote only approved durable conclusions and evidence into canonical project entries. Follow [[guidelines/proposal-and-dry-run]]; shared entries must not link to private local material.

#### Document Shape

For new handoffs, use the following compact structure. Preserve existing anchors when updating an older document; add or refresh an equivalent current summary rather than migrating historical records mechanically. Preserve existing metadata and use configured schemas for indexed shared entries; these headings are workflow guidance, not a built-in Forma schema.

```md
## Current Handoff

Updated date; continuation goal; current outcome; approved scope and limits; remaining work; one concrete next action; observed repository/worktree/HEAD and relevant dirty state, when applicable.

## Read First

Authoritative paths or URLs with a short reason to read each. Relevant available skills or Forma guideline ids and when to load them.

## Open Decisions And Verification

Unresolved decisions, blockers, acceptance criteria or their source; checks run and their results, checks not run and why; evidence provenance and conditions requiring revalidation.

## Expected Return

Expected result or artifact, evidence, residual risks, and recipient or review owner when known. State any shared Task transition still needed.

## Evidence And History

Dated supporting records and references; clearly mark superseded proposals.
```

Keep the current summary short enough to orient the next reader without reading the history. Retain decisive conclusions inline, but reference existing specs, decisions, tasks, commits, diffs, and logs instead of duplicating them. Exclude secrets, raw transcripts, and unnecessary personal or customer data. Include only skills relevant to the next activity; missing optional skills must not silently become prerequisites.

#### Update And Resume

- After each completed stage, refresh `Current Handoff` first, then append only useful evidence. Make supersession explicit; the reader must not infer current instructions from the last paragraph or newest-looking proposal.
- On resumption, read the current summary and authoritative sources, then recheck the checkout, HEAD, relevant dirty state, task state, and environment before relying on recorded evidence. Historical authorization cannot override newer user instructions or current access limits.
- Continue settled decisions without re-interviewing the user. If source facts changed or scope is unclear, identify the specific conflict, continue independent read-only work, and ask only for the decision that blocks progress.
- Return results under [[guidelines/task-selection]] when handing off a named Task for review. Keep local execution progress distinct from shared lifecycle state; a written handoff is not proof of delivery acceptance or successful resumption.

### Modes

- `handoff`: capture or refresh focused continuation context using the structure above.
- `capture`: put a local note in worklist, drafts, or scratch.
- `resume`: read the current handoff or worklist, revalidate its baseline, then continue within authorization or identify the next decision needed.
- `groom`: split, close, reorder, or clarify local items.
- `log`: record a concise started, progress, blocked, done, or follow-up note.
- `promote`: prepare a dry run for moving durable facts into shared content.
- `execute`: continue a local item only when scope, target, and safety are clear.

### Output

Report:

- file read or changed and its placement: team shared, personal shared, or personal local;
- selected item and status;
- whether the audience is unchanged or an approved promotion is needed;
- checks or git hygiene performed;
- next action or approval needed.

### Completion Criteria

Finish local work only when the selected item and next action are explicit, local material remains outside shared truth and commits, and any required promotion is stopped at a dry run or approval boundary.

For a handoff, verify that placement matches the team default or user instruction, its content fits the audience, and current scope, source references, outstanding checks, and the expected return are clear. Sharing the note does not accept its conclusions or complete the underlying work.

## Method Reference

Adapted from [Matt Pocock’s handoff skill](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/skills/productivity/handoff/SKILL.md): focus on the next session, reference existing artifacts, suggest relevant skills, and redact sensitive material. This workspace retains its own placement, authorization, and delivery rules.
