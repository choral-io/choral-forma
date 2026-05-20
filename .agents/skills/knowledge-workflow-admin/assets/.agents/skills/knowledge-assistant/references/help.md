# Help Mode

Use help mode to answer workflow questions and recommend the next process step. Help mode is strictly read-only: it explains, diagnoses, routes, and suggests prompts; it never modifies repository files or workflow state.

If the user asks this skill to write, install, move, create, update, run, or otherwise change state, refuse the action inside this skill. Provide a concrete prompt for the owning write-capable skill only when the requested action is clear enough.

## Read Order

Read only what the question needs:

1. Read the marked Knowledge Workflow block in root `AGENTS.md`.
2. Extract the explicit knowledge directory from that block, then read `<knowledge_dir>/.workflow/manifest.yml`.
3. Use the manifest `knowledge_dir`, `agent_skills`, `agent_local_dir`, `canonical_language`, and `default_group_id`.
4. Read relevant installed docs only:
    - `<knowledge_dir>/README.md`
    - `<knowledge_dir>/schemas/common.md`
    - relevant `<knowledge_dir>/schemas/*.md`
    - `<knowledge_dir>/tasks/WORKFLOW.md`
    - `<knowledge_dir>/planning/WORKFLOW.md`
5. For member-scoped questions, use `git config user.name` as the member id; read public member sections first and local workspace rules only when personal execution style matters.

If the block or manifest is missing, give pre-install help only. Recommend defaults such as `knowledge/`, external skills reuse, `.agents/.local/`, and `default-team` as examples, require an explicit canonical language for init, and route setup to the maintainer-run repository knowledge maintenance process.

## Intent And Prompt Suggestions

Infer the user's likely intent from the current request, selected file, active path, mentioned workflow object, and current repository context. Do not wait for the user to name a mode when the next safe route is clear.

Include a `Next Prompt` only when the user's intent and execution direction are clear enough that a copy-ready prompt would reduce friction. Do not add one to broad explanations, yes/no answers, tradeoff discussions, or ambiguous questions. When included, the prompt should name the owning skill or mode. If the request is write-capable, the prompt is a suggestion for the user to run manually; do not continue into that skill in the same invocation.

## Quick Router

Use this first. Check that the recommended skill is loadable by the current Agent before saying it is available. If the manifest records `agent_skills.mode: project`, the project-local copy should exist under `agent_skills.dir`.

| User asks about                                                                                     | Recommend                                                  | Boundary                                                               |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Workflow usage or onboarding                                                                        | `knowledge-assistant`                                      | Explain only.                                                          |
| New installation                                                                                    | maintainer-run repository knowledge maintenance process    | Ask for canonical language; dry-run first.                             |
| Project-specific Agent policy                                                                       | `knowledge-assistant`                                      | Explain or audit read-only; writes require maintainer workflow.        |
| Auto-review policy setup                                                                            | maintainer-run repository knowledge maintenance process    | Only needed when the team wants repeatable auto-review automation.     |
| Where information belongs                                                                           | `knowledge-intake`                                         | Write only after capture approval.                                     |
| Approved knowledge write or promotion                                                               | `knowledge-capture`                                        | Use schemas before writing.                                            |
| Add a project member                                                                                | `knowledge-capture`                                        | Confirm member id, public profile, and group membership updates.       |
| Add a group, team, board, or working group                                                          | `knowledge-capture`                                        | Confirm group id, scope, owners, and members.                          |
| Non-task knowledge quality                                                                          | `knowledge-schema-audit`                                   | Read-only findings.                                                    |
| Task metadata or readiness                                                                          | `task-metadata-audit`                                      | Read-only findings.                                                    |
| Project, delivery, decisions, or risk status                                                        | `knowledge-status-report`                                  | Read-only report with sources.                                         |
| Weekly delivery, knowledge health, proposal/decision queue, member workload, or blocked work report | `knowledge-status-report`                                  | Use the matching predefined report template.                           |
| Delivery planning                                                                                   | `delivery-planning`                                        | Dry-run Kanban changes only.                                           |
| Sprint planning document                                                                            | `knowledge-capture`                                        | Store in `planning/sprints/`; use delivery-planning for board changes. |
| Schema, guideline, or workflow rule change                                                          | `knowledge-capture`                                        | Shared workflow knowledge; audit first when impact is unclear.         |
| Pick next accepted task                                                                             | `next-task-selection`                                      | Recommend; do not start by default.                                    |
| Approved board edit                                                                                 | `kanban-maintenance`                                       | Requires explicit maintainer approval.                                 |
| Take a card into personal work                                                                      | `workspace-worklist:intake-task`                           | Current member local workspace only.                                   |
| Continue one local item                                                                             | `workspace-worklist:run-next`                              | One executable item.                                                   |
| Run several local items                                                                             | `workspace-worklist:run-loop`                              | Needs explicit budget; parallel needs budget.                          |
| Advance accepted tasks toward review                                                                | `workspace-worklist:run-goal`                              | Stop at review readiness by default.                                   |
| Implement selected delivery work                                                                    | `delivery-implementation`                                  | Code, tests, and knowledge together.                                   |
| Review before Done                                                                                  | `delivery-review`                                          | Required before Done when delivery changed.                            |
| Scope or source conflict                                                                            | `knowledge-assistant`, then owning skill after user choice | Report conflicts; do not silently choose.                              |
| Stuck, failed, obsolete, or unclear current work                                                    | `knowledge-assistant`, then owning skill after diagnosis   | Diagnose state first; do not retry, move cards, or rewrite facts yet.  |

## Placement

Use this table when the user asks where something should live.

| Content                                     | Place                                                           | Owning path                                                                   |
| ------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Raw observation or rough idea               | current member `local/scratch/`                                 | `knowledge-intake` if it may matter later                                     |
| Structured personal draft                   | current member `local/drafts/`                                  | promote only after user approval                                              |
| Personal executable action                  | current member `local/WORKLIST.md`                              | `workspace-worklist`                                                          |
| Public member summary, handoff, or research | `workspace/<member-id>/summaries/`, `handoffs/`, or `research/` | `knowledge-capture` when writing shared files                                 |
| Project member profile                      | `members/<member-id>.md`                                        | update group `members` when membership applies                                |
| Group, team, review board, or working group | `groups/<group-id>.md`                                          | confirm members before writing                                                |
| Discovery, market, customer, or assumption  | `discovery/`                                                    | `knowledge-capture`                                                           |
| Product behavior or requirement             | `product/`                                                      | `knowledge-capture`                                                           |
| UI, flow, visual design, or design asset    | `design/` and `assets/design/<feature-name>/`                   | `knowledge-capture`                                                           |
| Non-design supporting asset                 | `assets/<area-or-topic>/` with a canonical note that links it   | `knowledge-capture`                                                           |
| Concept, architecture, decision, guideline  | matching canonical area                                         | `knowledge-capture`                                                           |
| Sprint or planning-period document          | `planning/sprints/`                                             | `knowledge-capture` for the document; `delivery-planning` for board proposals |
| Valuable but unconfirmed candidate          | `proposals/`                                                    | convert before using as fact or delivery input                                |
| Potential delivery work                     | `tasks/items/`                                                  | audit before planning                                                         |
| Approved delivery status                    | `planning/KANBAN.md`                                            | `kanban-maintenance` after approval                                           |

Project facts come from canonical knowledge and code. Shared workspace material is context. Local workspace material is personal execution state.

## Members And Groups

Use `knowledge-capture` for approved member and group creation.

- Member profiles live in `members/<member-id>.md` and should use `members/templates/member.md.tpl`.
- Group documents live in `groups/<group-id>.md` and should use `groups/templates/group.md.tpl`.
- When creating a member, ask the user to choose groups manually or infer likely target groups from public responsibilities and ask for confirmation; record confirmed membership in the selected group documents' `members` lists.
- When creating a group, ask the user to choose members manually or infer likely target members from public responsibilities and ask for confirmation.
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
- `run-goal` coordinates accepted Kanban/worklist tasks toward review readiness; it is not open-ended discovery. It composes `next-task-selection`, `workspace-worklist`, `delivery-implementation`, `delivery-review`, and approved `kanban-maintenance` under a confirmed run contract.
- For `run-goal` or `auto-review`, merge execution policy from skill baseline, root `AGENTS.md` `Project-Specific Knowledge Workflow`, and the current prompt. The skill baseline is the hard floor; project and prompt policy may narrow scope or authorize automation only inside that floor.
- `auto-review` is a Knowledge Workflow approval mode, not an Agent application or sandbox permission mode. It does not assume, require, replace, or bypass runtime permission prompts; when runtime access is broad, the workflow run contract remains the Agent's self-limiting boundary.
- If project-specific execution policy is missing or partial, say so before starting. In that case, vague `auto-review` allows only low-risk automation; medium-risk work needs explicit task-level confirmation unless the prompt supplies clear temporary boundaries for this run. If the team wants repeatable automation, recommend the maintainer-run repository knowledge maintenance process.
- Default `run-goal` source stability to focused checks: repository state, selected task context, `Sources`, `blocked_by`, required links, and likely dirty-file overlap. Use strict checks only for high-risk, unclear, protected, worker-dispatched, or user-requested cases.
- Before execution, classify selected item validity as `valid`, `already-done`, `superseded`, `blocked`, `withdrawn`, or `unclear`.
- Stop or switch skills before crossing into Kanban edits, task metadata changes, shared knowledge writes, another member's workspace, commits, publishing, deletion, dependency installation, or elevated execution.
- Keep Agent runtime worktrees under `<agent_local_dir>/worktrees/`; keep `<agent_local_dir>/` out of git.
- Use formal shared handoff files only for cross-member, long-lived, complex, or explicitly requested handoffs.

Failure classes for local execution: `needs-user`, `blocked`, `out-of-scope`, `failed`, `done-with-warnings`. Do not recommend silent retry, unlimited retry, or continuing after high-risk or unclear failures.

## Recovery Questions

Use this when the user asks what to do after a workflow stalls, fails, becomes stale, or appears inconsistent.

Start by identifying the state boundary:

| Situation                                               | First response                                                                  | Next owner after diagnosis                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| WORKLIST item may be obsolete, already done, or unclear | Validate against current knowledge, Kanban, git state, and linked sources.      | `workspace-worklist:groom`, `run-next`, or `knowledge-capture` after approval      |
| Local execution failed or partially completed           | Classify as `needs-user`, `blocked`, `out-of-scope`, `failed`, or warning.      | `workspace-worklist:log`, `delivery-implementation`, or `delivery-review`          |
| Kanban card appears in the wrong column                 | Compare card state, linked task metadata, blockers, and review evidence.        | `task-metadata-audit` then approved maintenance                                    |
| Task readiness conflicts with current facts             | Audit `readiness`, `blocked_by`, Sources, acceptance criteria, and board state. | `task-metadata-audit`; write fixes only after route                                |
| Proposal, decision, or requirement seems superseded     | Treat the newer source as a candidate update, not an automatic replacement.     | `knowledge-intake` or `knowledge-capture`                                          |
| Handoff is missing context or no longer actionable      | Ask for the missing receiver, source task, current state, and expected action.  | `knowledge-capture` for shared handoff update                                      |
| Auto-review or run-goal policy is missing during a run  | Continue only under conservative low-risk boundaries or ask for confirmation.   | maintainer-run repository knowledge maintenance process if stable policy is wanted |
| Required skill, manifest, or workflow file is missing   | Report the missing runtime context; do not guess paths as facts.                | `knowledge-assistant` or maintainer-run repository knowledge maintenance process   |

Recovery answer shape:

1. State what is known and which source proves it.
2. State what is uncertain or conflicting.
3. Pick the narrowest safe next skill.
4. Name the actions that should not happen yet.
5. Give a concrete next prompt.

Do not hide recovery work inside normal execution. If the recovery changes shared facts, task metadata, Kanban state, another member's handoff, or policy, switch to the owning skill and require the same approval gate as a normal change.

## Delivery Gates

Use these rules for task items, `KANBAN.md`, Ready, Doing, Reviewing, Blocked, Done, or Cancelled:

- `tasks/items/` holds durable task context and acceptance criteria.
- `planning/KANBAN.md` tracks delivery status; cards stay thin and link to task items.
- `delivery-planning` proposes board changes; `kanban-maintenance` applies approved changes.
- `next-task-selection` selects accepted Kanban cards, not loose task items, and outputs a candidate score table when ranking alternatives.
- Starting from a card should use `workspace-worklist:intake-task` when local execution tracking is useful.
- `delivery-implementation` should produce or confirm an implementation plan before editing, then provide review readiness evidence before delivery review.
- Move to `Doing`, `Reviewing`, `Blocked`, `Done`, or `Cancelled` only through approved board maintenance.
- `delivery-review` is the gate before `Done` when implementation, acceptance criteria, source knowledge, or required checks changed.
- `Done` requires delivered work, relevant checks or documented skips, updated durable knowledge when needed, completed local log, review acceptance, and approved board movement.
- `readiness` is execution readiness, not delivery completion state; Kanban records `Doing`, `Reviewing`, `Blocked`, `Done`, and `Cancelled`.
- At `reviewing-ready`, report possible downstream follow-up only. After `delivery-review` accepts the task, reverse-look up tasks blocked by the completed task and propose downstream readiness or board follow-up when blockers are resolved.

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

Use predefined report templates for weekly delivery, knowledge health, proposal/decision queue, member workload, and blocked work reports.

## Proposals

Use proposals as a review buffer, not as facts or delivery commitments.

- `proposed -> reviewing`: reviewer or owner starts evaluation.
- `reviewing -> accepted`: owner or maintainer approves the direction.
- `accepted -> converted`: canonical document, task item, or decision exists.
- `reviewing -> rejected` or `reviewing -> superseded`: record rationale and replacement when present.

Accepted proposals remain non-canonical until converted. Task proposals must become task items before delivery planning.

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

## Project Policy

Use `knowledge-assistant` to understand or audit project-specific Agent behavior policy in root `AGENTS.md`. Ask a maintainer to use the maintainer-run repository knowledge maintenance process only to define, update, or save policy.

Policy topics include auto-review, approval gates, protected surfaces, validation baseline, Kanban automation, git/worktree automation, source stability, and parallel/subagent execution.

Assistant policy answers are read-only. Do not ask teams to configure auto-review unless they request auto-review or another workflow discovers that auto-review policy is missing and the user chooses to define a stable policy.

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
- changing `knowledge_dir`, `agent_skills.mode`, `agent_skills.dir`, `agent_local_dir`, `canonical_language`, or `default_group_id` after init during internal testing

## Installation Help

For workflow installation questions, answer read-only and route maintainer work to the maintainer-run repository knowledge maintenance process:

- Maintainer workflow administration creates a new internal-test installation.
- Init reuses externally available workflow skills by default when the current Agent can load the complete required set.
- Project-local collaboration skills remain available through an explicit install choice when external skills are missing or the user wants the repository to carry local copies.
- Root `AGENTS.md` receives only the marked workflow block.
- The final `### Project-Specific Knowledge Workflow` heading inside that block is protected local project space.
- The manifest is workflow state created by init.
- Existing installs are help-only during internal testing; use a fresh test repository or explicit manual cleanup for validation.
- Supported Markdown knowledge text extensions are `.md` and `.mdx`; supported Markdown template extensions are `.md.tpl` and `.mdx.tpl`.
- Template files are Markdown templates, not project facts, task inputs, delivery candidates, or graph nodes.
- Editor settings are optional and unmanaged. If the user asks for editor setup, recommend associating `*.md.tpl` and `*.mdx.tpl` with Markdown-compatible editing, excluding `**/*.md.tpl` and `**/*.mdx.tpl` from Foam graph scanning, and configuring any available Markdown formatter such as Prettier to parse those template files as Markdown.

## Answer Shape

Use this structure unless the user explicitly asks for another format:

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

If the recommendation depends on an assumption, include `## Assumption` and state the exact assumption in one sentence. If the user asked this skill to write or mutate state, include `## Boundary` and state that `knowledge-assistant` is read-only before giving any prompt.

Keep answers practical. If the user is choosing between two valid paths, explain the tradeoff and recommend one default. If the user asks for action while still in help mode, recommend the mode or skill switch instead of performing it. Omit `Next Prompt` when it would be repetitive or when the next step still needs a decision.

## Examples

Question:

```text
Create a task for this requirement.
```

Answer:

```md
## Boundary

`knowledge-assistant` is read-only, so I will not create the task item or edit the Kanban board from this help request.

## Recommended Path

Use `knowledge-intake` first if the requirement still needs routing; use `knowledge-capture` only after you decide it should become a task item.

## Why

Task creation changes shared project knowledge and may affect delivery planning, so it belongs to the write-capable knowledge workflow.

## Next Prompt

"Use knowledge-intake to evaluate this requirement and recommend whether it should become product knowledge, a proposal, or a task item. If it is ready for capture, draft the exact knowledge-capture prompt."
```

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

Question:

```text
The next WORKLIST item may already be obsolete. What should I do?
```

Answer:

```md
## Recommended Path

Use `knowledge-assistant` for diagnosis, then `workspace-worklist:groom` if the item should be updated locally.

## Why

An obsolete WORKLIST item is personal execution state until it affects shared task metadata, Kanban state, or canonical knowledge.

## Example

Known: the item is in the current member's WORKLIST.
Uncertain: whether linked task, Kanban card, source requirement, or code state already resolved it.
Check: linked sources, current Kanban card, relevant task item, and likely git/code state.

## Do Not Do Yet

Do not run the item, rewrite shared facts, or move Kanban before confirming whether the work is still valid.

## Next Prompt

"Use workspace-worklist:groom to validate this WORKLIST item against its linked task, Kanban card, and current repo state, then propose whether to keep, update, move, or close it."
```

Question:

```text
This Kanban card seems to be in the wrong column.
```

Answer:

```md
## Recommended Path

Use `task-metadata-audit` first, then `kanban-maintenance` only after an approved board-change plan.

## Why

Column drift can come from task metadata, blockers, review evidence, or an incomplete previous maintenance step. Audit is read-only; board movement is a separate approved action.

## Example

Known: the card's current column.
Uncertain: whether the linked task is ready, blocked, reviewing-ready, accepted, or cancelled.
Check: linked task item, `readiness`, `blocked_by`, acceptance evidence, review status, and current Kanban card.

## Do Not Do Yet

Do not move the card directly from help or audit output.

## Next Prompt

"Use task-metadata-audit to compare this card's column with the linked task metadata, blockers, and review evidence. If a board change is needed, prepare a kanban-maintenance dry run."
```

Question:

```text
Auto-review was requested, but this project has no stable auto-review policy.
```

Answer:

```md
## Recommended Path

Use conservative `workspace-worklist:run-goal` or `run-loop` behavior for this run, or ask a maintainer to define stable auto-review policy if the team wants stable reusable policy.

## Why

`auto-review` is a Knowledge Workflow approval mode. Without project policy, vague auto-review is limited to low-risk actions such as local logs, local WORKLIST updates, read-only checks, and formatting already-approved files.

## Do Not Do Yet

Do not treat broad sandbox access as workflow approval, and do not auto-approve medium-risk edits without project policy or explicit task-level prompt policy.

## Next Prompt

"Ask a maintainer to audit the current Project-Specific Knowledge Workflow and propose a concise auto-review policy dry run."
```

Question:

```text
Run goal until 18:00 to advance my assigned Ready tasks to review.
```

Answer:

```md
## Recommended Path

Use `workspace-worklist:run-goal` with an explicit run contract.

## Why

`run-goal` coordinates accepted Kanban/worklist tasks toward review readiness. It is not open-ended discovery.

## Example

Candidate source: assigned `Ready` and `Doing` cards. Include `Reviewing` only for review or closest-to-Done goals.
Stop-at: deadline or review readiness.
Kanban policy: propose-only unless approved maintenance is explicitly allowed.
Review policy: delivery-review before Done.
Source stability: focused by default; strict only when risk or policy requires it.
Policy sources: skill baseline + Project-Specific Knowledge Workflow + this prompt.
Auto-review: low-risk only unless project policy or explicit task-level prompt policy allows medium-risk automation for the affected scope.

## Do Not Do Yet

Do not start new work after the deadline, edit Kanban without approved maintenance, run medium-risk auto-review without policy support, or start another member's assigned task without second confirmation.

## Next Prompt

"Use workspace-worklist:run-goal for my assigned Ready/Doing tasks until 18:00. Confirm the run contract, use next-task-selection for candidates, stop at review readiness, and propose board updates instead of editing them unless I approve maintenance."
```
