# Help Mode

Use help mode to answer workflow questions and recommend the next process step. Help mode explains rules; it does not modify repository files.

## Read Order

Read only what the question needs:

1. Search for `*/.workflow/manifest.yml`, commonly `knowledge/.workflow/manifest.yml`.
2. If one manifest exists, use its `knowledge_dir`, `agent_skills_dir`, `agent_local_dir`, `canonical_language`, and `default_group_id`; if several exist, ask which installation to use.
3. Read the marked Knowledge Workflow block in root `AGENTS.md`.
4. Read relevant installed docs only:
   - `<knowledge_dir>/README.md`
   - `<knowledge_dir>/schemas/common.md`
   - relevant `<knowledge_dir>/schemas/*.md`
   - `<knowledge_dir>/tasks/WORKFLOW.md`
   - `<knowledge_dir>/planning/WORKFLOW.md`
   - relevant `<agent_skills_dir>/<skill-name>/SKILL.md`
5. For member-scoped questions, use `git config user.name` as the member id; read public member sections first and local workspace rules only when personal execution style matters.

If no manifest exists, give pre-install help only. Recommend defaults such as `knowledge/`, `.agents/skills/`, `.agents/.local/`, and `default-team` as examples, require an explicit canonical language for init, and route setup to `knowledge-workflow:init`.

## Quick Router

Use this first. Check that the recommended installed skill path exists before saying it is available.

| User asks about                              | Recommend                                                      | Boundary                                                         |
| -------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Workflow usage or onboarding                 | `knowledge-workflow:help`                                      | Explain only.                                                    |
| New installation                             | `knowledge-workflow:init`                                      | Ask for canonical language; dry-run first.                       |
| Where information belongs                    | `knowledge-intake`                                             | Write only after capture approval.                               |
| Approved knowledge write or promotion        | `knowledge-capture`                                            | Use schemas before writing.                                      |
| Add a project member                         | `knowledge-capture`                                            | Confirm member id, public profile, and group membership updates. |
| Add a group, team, board, or working group   | `knowledge-capture`                                            | Confirm group id, scope, owners, and members.                    |
| Non-task knowledge quality                   | `knowledge-schema-audit`                                       | Read-only findings.                                              |
| Task metadata or readiness                   | `task-metadata-audit`                                          | Read-only findings.                                              |
| Project, delivery, decisions, or risk status | `knowledge-status-report`                                      | Read-only report with sources.                                   |
| Delivery planning                            | `delivery-planning`                                            | Dry-run Kanban changes only.                                     |
| Pick next accepted task                      | `next-task-selection`                                          | Recommend; do not start by default.                              |
| Approved board edit                          | `kanban-maintenance`                                           | Requires explicit maintainer approval.                           |
| Take a card into personal work               | `workspace-worklist:intake-task`                               | Current member local workspace only.                             |
| Continue one local item                      | `workspace-worklist:run-next`                                  | One executable item.                                             |
| Run several local items                      | `workspace-worklist:run-loop`                                  | Needs explicit budget; parallel needs budget.                    |
| Advance accepted tasks toward review         | `workspace-worklist:run-goal`                                  | Stop at review readiness by default.                             |
| Implement selected delivery work             | `delivery-implementation`                                      | Code, tests, and knowledge together.                             |
| Review before Done                           | `delivery-review`                                              | Required before Done when delivery changed.                      |
| Scope or source conflict                     | `knowledge-workflow:help`, then owning skill after user choice | Report conflicts; do not silently choose.                        |

## Placement

Use this table when the user asks where something should live.

| Content                                     | Place                                                           | Owning path                                    |
| ------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| Raw observation or rough idea               | current member `local/scratch/`                                 | `knowledge-intake` if it may matter later      |
| Structured personal draft                   | current member `local/drafts/`                                  | promote only after user approval               |
| Personal executable action                  | current member `local/WORKLIST.md`                              | `workspace-worklist`                           |
| Public member summary, handoff, or research | `workspace/<member-id>/summaries/`, `handoffs/`, or `research/` | `knowledge-capture` when writing shared files  |
| Project member profile                      | `members/<member-id>.md`                                        | update group `members` when membership applies |
| Group, team, review board, or working group | `groups/<group-id>.md`                                          | confirm members before writing                 |
| Discovery, market, customer, or assumption  | `discovery/`                                                    | `knowledge-capture`                            |
| Product behavior or requirement             | `product/`                                                      | `knowledge-capture`                            |
| UI, flow, visual design, or design asset    | `design/` and `assets/design/<feature-name>/`                   | `knowledge-capture`                            |
| Concept, architecture, decision, guideline  | matching canonical area                                         | `knowledge-capture`                            |
| Valuable but unconfirmed candidate          | `proposals/`                                                    | convert before using as fact or delivery input |
| Potential delivery work                     | `tasks/items/`                                                  | audit before planning                          |
| Approved delivery status                    | `planning/KANBAN.md`                                            | `kanban-maintenance` after approval            |

Project facts come from canonical knowledge and code. Shared workspace material is context. Local workspace material is personal execution state.

## Members And Groups

Use `knowledge-capture` for approved member and group creation.

- Member profiles live in `members/<member-id>.md` and should use `members/templates/member.md.tpl`.
- Group documents live in `groups/<group-id>.md` and should use `groups/templates/group.md.tpl`.
- When creating a member, ask the user to choose groups manually or infer likely target groups from public responsibilities and ask for confirmation; record confirmed membership in the selected group documents' `members` lists.
- When creating a group, ask the user to choose members manually or infer candidate members from public responsibilities and ask for confirmation.
- `groups/*.md` frontmatter `members` is the structured membership source of truth. Do not write group membership into member profile frontmatter.
- Keep private personal information out of both member and group documents.

## Core Flow

Use this compact flow when explaining idea-to-delivery:

```text
raw/local note
-> knowledge-intake
-> optional proposal
-> canonical knowledge or task item
-> task-metadata-audit
-> delivery-planning dry run
-> approved kanban-maintenance
-> workspace-worklist intake/execution
-> delivery-implementation
-> delivery-review
-> approved Done move
```

Do not skip conversion steps: proposals are not facts, loose task items are not accepted work, and Kanban edits need explicit approval.

## WORKLIST And Execution

Use these rules for `WORKLIST.md`, "continue", "run next", "run loop", local logs, handoffs, worktrees, or subagents:

- Determine the current member with `git config user.name`.
- Default to `run-next` for one item unless the user authorizes `run-loop` or `run-goal`.
- `run-loop` needs `max-items`; parallel execution also needs `parallel-work-items` and independent items.
- `run-goal` coordinates accepted Kanban/worklist tasks toward review readiness; it is not open-ended discovery.
- Before execution, validate that the selected item is still relevant, not blocked, scoped, current, and safe under the requested approval mode.
- Stop or switch skills before crossing into Kanban edits, task metadata changes, shared knowledge writes, another member's workspace, commits, publishing, deletion, dependency installation, or elevated execution.
- Keep Agent runtime worktrees under `<agent_local_dir>/worktrees/`; keep `<agent_local_dir>/` out of git.
- Use formal shared handoff files only for cross-member, long-lived, complex, or explicitly requested handoffs.

Failure classes for local execution: `needs-user`, `blocked`, `out-of-scope`, `failed`, `done-with-warnings`. Do not recommend silent retry, unlimited retry, or continuing after high-risk or unclear failures.

## Delivery Gates

Use these rules for task items, `KANBAN.md`, Ready, Doing, Reviewing, Blocked, Done, or Cancelled:

- `tasks/items/` holds durable task context and acceptance criteria.
- `planning/KANBAN.md` tracks delivery status; cards stay thin and link to task items.
- `delivery-planning` proposes board changes; `kanban-maintenance` applies approved changes.
- `next-task-selection` selects accepted Kanban cards, not loose task items.
- Starting from a card should use `workspace-worklist:intake-task` when local execution tracking is useful.
- Move to `Doing`, `Reviewing`, `Blocked`, `Done`, or `Cancelled` only through approved board maintenance.
- `delivery-review` is the gate before `Done` when implementation, acceptance criteria, source knowledge, or required checks changed.
- `Done` requires delivered work, relevant checks or documented skips, updated durable knowledge when needed, completed local log, review acceptance, and approved board movement.
- `readiness` is execution readiness, not delivery completion state; Kanban records `Doing`, `Reviewing`, `Blocked`, `Done`, and `Cancelled`.
- Before `Reviewing -> Done`, reverse-look up tasks blocked by the completed task and propose downstream readiness or board follow-up when blockers are resolved.

## Optional Superpowers Guidance

Recommend Superpowers only as execution-method support when available. It is not a managed workflow dependency, manifest state, or replacement for Knowledge Workflow ownership.

| Workflow need                                                 | Optional Superpowers skill                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Shape unclear feature, product, design, or implementation     | `superpowers:brainstorming`                                                  |
| Write a multi-step implementation plan                        | `superpowers:writing-plans`                                                  |
| Implement feature, bugfix, refactor, or behavior change       | `superpowers:test-driven-development`                                        |
| Investigate a bug or unclear failure                          | `superpowers:systematic-debugging`                                           |
| Verify before completion, commit, PR, or Done-readiness claim | `superpowers:verification-before-completion`                                 |
| Isolate work or run authorized parallel Agents                | `superpowers:using-git-worktrees`, `superpowers:subagent-driven-development` |

Knowledge Workflow still owns knowledge placement, task items, Kanban state, WORKLIST routing, approval gates, and delivery review. Put personal Superpowers plans under `<knowledge_dir>/workspace/<member-id>/local/drafts/` unless the user approves promotion to task items or proposals.

## Status Reports

For project status, delivery progress, decisions, requirements, ownership, or risks, recommend `knowledge-status-report`.

Ask it to choose the narrowest useful scope, state `Reliability: high | medium | low`, label counts as `field-based`, `board-based`, `git-based`, or `inferred`, and list source paths. If the user asks to report and fix, report first; route approved fixes to the owning skill.

## Scope Precedence

When sources conflict, recommend applying this order and reporting conflicts that affect facts, delivery scope, permissions, review, ownership, or another member:

```text
root AGENTS.md and repository safety rules
> knowledge schemas, workflow rules, and accepted decisions
> canonical project knowledge and code
> shared workspace summaries, handoffs, and research
> personal local notes, worklists, logs, and local AGENTS.md
> current conversation
```

Lower-scope material can trigger updates, but it does not replace committed project knowledge until the user approves capture or maintenance.

## Premature Actions

Call out these unsafe jumps:

- raw idea directly to Kanban
- proposal treated as fact, accepted decision, task item, or delivery commitment
- local notes used as team planning source
- localized file used as canonical source
- board edit without approved maintenance
- work assigned to another member started without second confirmation
- multi-item or parallel execution without explicit budget
- Done move without review when delivery changed
- changing `knowledge_dir`, `agent_skills_dir`, `agent_local_dir`, `canonical_language`, or `default_group_id` after init during internal testing

## Installation Help

For workflow installation questions:

- `init` creates a new internal-test installation.
- Root `AGENTS.md` receives only the marked workflow block.
- The final `### Project-Specific Knowledge Workflow` heading inside that block is protected local project space.
- The manifest is workflow state created by init.
- Existing installs are help-only during internal testing; use a fresh test repository or explicit manual cleanup for validation.
- Supported Markdown knowledge text extensions are `.md` and `.mdx`; supported Markdown template extensions are `.md.tpl` and `.mdx.tpl`.
- Template files are Markdown templates, not project facts, task inputs, delivery candidates, or graph nodes.
- Editor settings are optional and unmanaged. If the user asks for editor setup, recommend associating `*.md.tpl` and `*.mdx.tpl` with Markdown-compatible editing, excluding `**/*.md.tpl` and `**/*.mdx.tpl` from Foam graph scanning, and configuring any available Markdown formatter such as Prettier to parse those template files as Markdown.

## Answer Shape

Prefer this structure:

```md
## Recommended Path

Use `<skill-name>` first.

## Why

Short reason tied to the workflow rule.

## Example

Concrete prompt or path.

## Do Not Do Yet

Premature or unsafe actions.

## Next Prompt

"Use <skill> to ..."
```

Keep answers practical. If the user is choosing between two valid paths, explain the tradeoff and recommend one default. If the user asks for action while still in help mode, recommend the mode or skill switch instead of performing it.

## Examples

Question:

```text
I found a UX issue during debugging. Where should it go?
```

Answer:

```md
## Recommended Path

Use `knowledge-intake` first. Keep the raw note in the current member's `local/scratch/` unless the user already approves a canonical update.

## Why

Raw observations are not team facts until routed and approved.

## Next Prompt

"Use knowledge-intake to decide whether this UX issue should become product knowledge, design knowledge, a task item, or a local note."
```

Question:

```text
I picked a card from KANBAN. What should I do now?
```

Answer:

```md
## Recommended Path

Use `workspace-worklist:intake-task`.

## Why

Kanban tracks team delivery state; WORKLIST tracks personal execution.

## Do Not Do Yet

Do not move the card to `Doing` without approved Kanban maintenance.

## Next Prompt

"Use workspace-worklist:intake-task to take this Kanban card into my local WORKLIST, check readiness and blockers, and prepare the Doing update dry-run if appropriate."
```

Question:

```text
Should this bugfix use TDD?
```

Answer:

```md
## Recommended Path

Use `delivery-implementation` for the accepted delivery task. If Superpowers is available, use `superpowers:test-driven-development` as execution-method guidance.

## Why

Knowledge Workflow owns task context, checks, knowledge updates, and review gates. Superpowers can improve implementation discipline without replacing delivery ownership.

## Next Prompt

"Use delivery-implementation for this bugfix, and apply superpowers:test-driven-development before changing behavior when Superpowers is available."
```

Question:

```text
Can Superpowers run two work items in parallel?
```

Answer:

```md
## Recommended Path

Use `workspace-worklist:run-loop` or `workspace-worklist:run-goal` only after the user confirms a parallel budget. If Superpowers is available, use its worktree or subagent guidance as support.

## Why

Knowledge Workflow owns item selection, dependency checks, WORKLIST updates, approvals, logs, integration, and Kanban state.

## Do Not Do Yet

Do not dispatch parallel work before checking independence, file/resource conflicts, approval needs, and whether the items are accepted workflow work.
```
