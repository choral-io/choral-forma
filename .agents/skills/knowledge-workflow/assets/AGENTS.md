<!-- knowledge-workflow:start -->

## Knowledge Workflow

### Required Context

- Knowledge directory: `{{knowledge_dir}}/`.
- Treat `{{knowledge_dir}}/` and code as project facts; treat `{{knowledge_dir}}/planning/KANBAN.md` as delivery status.
- Read `{{knowledge_dir}}/.workflow/manifest.yml` before using workflow skills; use its `knowledge_dir`, `agent_skills`, `agent_local_dir`, `canonical_language: {{canonical_language}}`, and `default_group_id: {{default_group_id}}` values for workflow paths.
- Determine the current member id with `git config user.name`; do not infer it from OS, machine, shell, or chat names.
- Before writing knowledge, read `{{knowledge_dir}}/schemas/common.md` and the relevant `{{knowledge_dir}}/schemas/*.md`.
- Before changing delivery cards, read `{{knowledge_dir}}/tasks/WORKFLOW.md`.
- When member context matters, prefer section-scoped reads from `{{knowledge_dir}}/members/<member-id>.md`; read the full file only when editing, auditing, or resolving ambiguity.
- If a workflow acts on the current member's workspace, worklist, or personal execution style, read `{{knowledge_dir}}/workspace/<member-id>/local/AGENTS.md` when it exists.

### Source And Privacy Boundaries

- Apply scope precedence from `{{knowledge_dir}}/schemas/common.md`; stop and report conflicts that affect facts, delivery scope, permissions, review, ownership, or another member.
- Keep localized files as translations only; do not store secrets or private notes in `{{knowledge_dir}}/`.
- Treat `{{knowledge_dir}}/proposals/` as a review buffer, not as project facts, accepted decisions, task items, or delivery commitments until converted.
- Treat `{{knowledge_dir}}/workspace/<member-id>/local/` and `{{agent_local_dir}}/` as local-only state; never stage or commit them.
- Use member workspace sharing paths deliberately: `summaries/` for edited summaries, `handoffs/` for handoffs, and `research/` for shareable investigations. Keep raw captures and personal drafts under `local/`.
- Do not assign work by writing into another member's workspace. Use task items with `assignees` and approved Kanban updates for delegated team work.

### Skill Routing

Use the platform's skill loader when available. If the manifest records `agent_skills.mode: project`, project-local collaboration skills are installed under the manifest `agent_skills.dir`.

| Need                                               | Skill                     |
| -------------------------------------------------- | ------------------------- |
| Workflow help, setup, or project policy            | `knowledge-workflow`      |
| Knowledge intake or routing                        | `knowledge-intake`        |
| Approved knowledge write                           | `knowledge-capture`       |
| Schema audit                                       | `knowledge-schema-audit`  |
| Task metadata audit                                | `task-metadata-audit`     |
| Status report                                      | `knowledge-status-report` |
| Personal worklist, run-next, run-loop, or run-goal | `workspace-worklist`      |
| Planning dry-run                                   | `delivery-planning`       |
| Pick next accepted task                            | `next-task-selection`     |
| Board update                                       | `kanban-maintenance`      |
| Implementation                                     | `delivery-implementation` |
| Review before Done                                 | `delivery-review`         |

Start with intake when the user only mentions a possible knowledge change; use capture only after the user asks to write. Audit skills are read-only. Use `knowledge-workflow:policy` to explain, audit, design, or update project-specific Agent policy.

### Delivery And Local Execution

- Accepted delivery work is tracked by thin cards in `{{knowledge_dir}}/planning/KANBAN.md` linked to task items under `{{knowledge_dir}}/tasks/items/`.
- Use `delivery-planning` for proposed task/card changes and `kanban-maintenance` only after approval.
- Use `workspace-worklist:intake-task` when taking a Kanban card into the current member's local execution flow.
- `run-goal` coordinates accepted Kanban/worklist tasks toward review readiness; it is not open-ended product discovery.
- `auto-review` is a workflow approval mode, not a sandbox or host-permission mode. If project policy is missing or partial, keep vague auto-review to low-risk actions and suggest `knowledge-workflow:policy auto-review` for stable policy.
- `delivery-review` is required before moving changed delivery work to Done.
- Optional execution-method tools, including Superpowers, may help with planning, TDD, debugging, verification, worktrees, or authorized parallel agents, but they do not replace Knowledge Workflow ownership, gates, or review.

### Formatting, Git, And Safety

- The workflow must not depend on a specific runtime, language, package manager, shell, or script file.
- When doing actual project work, Agents may detect and use tools already available in the project or environment.
- For knowledge-only changes, use or suggest the project's available Markdown formatter/checker for supported knowledge files: `{{knowledge_dir}}/**/*.md`, `{{knowledge_dir}}/**/*.mdx`, `{{knowledge_dir}}/**/*.md.tpl`, and `{{knowledge_dir}}/**/*.mdx.tpl`.
- Commit only files intentionally changed for the current task; leave unrelated dirty files untouched.
- Before staging knowledge changes, confirm the staged diff excludes `{{knowledge_dir}}/workspace/*/local/**` and `{{agent_local_dir}}/**`.

### Project-Specific Knowledge Workflow

Add project-specific knowledge workflow rules here. This protected local subsection must remain the final `###` heading inside the `Knowledge Workflow` block.

Project-specific rules may specialize workflow behavior, but they must not weaken core safety, ownership, privacy, local-only, approval, or review rules. Use `knowledge-workflow:policy` to explain, audit, or update project-specific Agent policy; policy mode is read-only unless the user asks to update or save policy.

<!-- knowledge-workflow:end -->
