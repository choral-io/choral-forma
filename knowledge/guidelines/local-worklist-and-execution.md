---
scope: project
title: Local Worklist And Execution
summary: Lightweight Agent guidance for member-local worklists, logs, drafts, and execution notes that must stay out of shared project truth.
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
    description: Use when an Agent needs to manage member-local worklists, logs, drafts, execution notes, or decide whether local material should stay private or be proposed for promotion.
    triggers:
        - local worklist
        - execution log
        - member local notes
        - resume local work
        - promote local draft
        - worktree execution
        - run next local item
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

Local worklist behavior is intentionally smaller than the old workflow suite. Use it for coordination, notes, and resumption; use task, content, proposal, and review guidelines when work crosses into shared state.

## Agent Skill

### When To Use

Use this skill when the user asks to:

- capture or resume member-local work;
- create, groom, or read a local worklist;
- record a concise execution log;
- decide whether a local draft should stay private or be promoted;
- coordinate worktree or local execution notes;
- continue a local item that may connect to a shared task.

### Bootstrap

Run or confirm current output from:

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- workspace health --json`

Resolve the current user from configured runtime values when available. If the member id is ambiguous, ask before writing local files.

### Local Paths

- Shared member entry: `knowledge/workspace/<member-id>/index.md`
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

### Modes

- `capture`: put a local note in worklist, drafts, or scratch.
- `resume`: read the worklist and recent logs, then recommend the next local action.
- `groom`: split, close, reorder, or clarify local items.
- `log`: record a concise started, progress, blocked, done, or follow-up note.
- `promote`: prepare a dry run for moving durable facts into shared content.
- `execute`: continue a local item only when scope, target, and safety are clear.

### Output

Report:

- local file read or changed;
- selected item and status;
- whether the item stays local or needs shared promotion;
- checks or git hygiene performed;
- next action or approval needed.
