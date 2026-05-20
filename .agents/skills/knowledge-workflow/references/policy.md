# Policy

Use this reference for `knowledge-workflow:policy`.

Policy mode explains and manages project-specific Agent behavior rules inside root `AGENTS.md` -> `Project-Specific Knowledge Workflow`. It is read-only by default. Do not configure policy during init, help, or ordinary delivery unless the user asks for it or accepts a recommendation after a workflow finds missing project policy.

## Topics

Supported policy topics:

- `auto-review`: what the main Agent may approve after self-review.
- approval gates: what requires user confirmation.
- protected surfaces: project areas or change types that need stricter handling.
- validation baseline: minimum checks per change scope.
- Kanban automation: when board edits are propose-only or approved maintenance.
- git/worktree automation: pull, branch, worktree, reset, cleanup, and sync boundaries.
- source stability: default `focused` checks and project-specific `strict` escalation.
- parallel/subagent execution: when parallel workers or reviewer/planner agents are allowed.

If the user asks for an unsupported policy topic, treat it as a project-specific Agent policy only when it affects Agent behavior, approvals, execution, review, safety, or workflow gates. Otherwise route to help or knowledge-capture.

## Trigger

Use this mode when:

- the user asks what the project policy says, how it applies, whether a policy exists, or whether an action is allowed by policy;
- the user asks to audit policy coverage or identify missing policy;
- the user asks to design, configure, update, audit, or save project workflow policy;
- `workspace-worklist:run-goal` or `run-loop` wants `auto-review`, but `Project-Specific Knowledge Workflow` lacks enough execution boundaries and the user chooses to configure them.

If the user asks general workflow education without referencing this project's policy, use help mode instead.

## Read And Preserve

1. Read root `AGENTS.md`.
2. Locate the marked Knowledge Workflow block and its explicit knowledge directory.
3. Read `<knowledge_dir>/.workflow/manifest.yml` for `knowledge_dir`, `agent_skills`, and `agent_local_dir`.
4. Locate the block's final `### Project-Specific Knowledge Workflow` subsection.
5. Preserve all existing project-specific rules unless the user explicitly changes them.
6. Write only inside `Project-Specific Knowledge Workflow`; do not edit managed workflow text.

If the marked block or project-specific subsection is missing, stop and recommend workflow init or manual repair.

## Explain Or Audit

For policy questions, answer from current project policy and workflow baseline.

Output:

```md
## Policy Answer

<direct answer>

## Sources

- root AGENTS.md -> Project-Specific Knowledge Workflow
- relevant workflow baseline or skill reference

## Effective Rule

<merged rule from baseline + project policy + prompt when applicable>

## Gaps

- none | missing/partial policy to configure

## Next Step

<optional: use knowledge-workflow:policy <topic> to define or update stable policy>
```

Do not produce a write dry-run unless the user asks to update or save policy.

## Auto-Review Topic

Ask only the missing questions needed for the policy:

| Decision                  | What to capture                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Low-risk automation       | Local logs, local worklist edits, read-only checks, formatting, or other project-approved basics |
| Medium-risk scopes        | Paths or change types where auto-review may proceed after main-Agent review                      |
| Protected surfaces        | Areas that always require explicit confirmation                                                  |
| Confirmation actions      | Commits, publishing, dependency changes, migrations, deletion, external transmission, etc.       |
| Validation baseline       | Minimum checks per allowed scope                                                                 |
| Kanban and git boundaries | Whether board edits, pulls, branch/worktree operations, or sync actions may be automated         |
| Source stability          | Whether the default is `focused` or project-specific stricter rules                              |

Keep the policy short. Prefer project-specific categories over long file lists when categories are clear.

## Dry Run Shape

Before editing, output:

```md
## Policy Dry Run

### Topic

auto-review | approval-gates | protected-surfaces | validation-baseline | kanban-automation | git-worktree-automation | source-stability | parallel-subagents | other

### Existing Policy

none | partial | defined

### Proposed Project-Specific Addition

<markdown to insert or replace>

### Still Requires Confirmation

- ...

### Validation

- AGENTS marked block found
- final Project-Specific subsection found
- edit limited to Project-Specific subsection
```

## Suggested Auto-Review Section

Use a `#### Auto-Review Execution Policy` heading inside `Project-Specific Knowledge Workflow` unless the project already has an equivalent heading.

Example:

```md
#### Auto-Review Execution Policy

- Auto-review is optional and applies only when the user requests it for a run.
- Vague auto-review allows only low-risk local actions: local worklist/log updates, read-only checks, and formatting files already approved for the current task.
- Medium-risk auto-review is allowed only for <project-defined scopes> after the main Agent reviews scope, diff, validation, and policy sources.
- Protected surfaces that always require explicit confirmation: <project-defined categories>.
- Kanban edits remain propose-only unless the user explicitly authorizes approved maintenance for the run.
- Commits, publishing, dependency installation, deletion, migrations, secrets, permissions, and external transmission require explicit confirmation unless this project adds a narrower task-level exception.
- Validation baseline: <project-defined checks per scope>.
- Source stability uses `focused` by default; use `strict` for protected surfaces, unclear freshness, worker dispatch, or user-requested strict runs.
```

Do not include placeholder text in the saved policy. Ask the user or infer from existing project instructions before saving.
