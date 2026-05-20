<!-- knowledge-workflow:start -->

## Knowledge Workflow

### Required Context

- Knowledge directory: `{{knowledge_dir}}/`.
- Read `{{knowledge_dir}}/.workflow/manifest.yml` before workflow work; use its `knowledge_dir`, `agent_skills`, `agent_local_dir`, `canonical_language: {{canonical_language}}`, and `default_group_id: {{default_group_id}}` values.
- Determine the current member id with `git config user.name`; do not infer it from OS, machine, shell, or chat names.
- Before writing knowledge, read `{{knowledge_dir}}/schemas/common.md` and the relevant `{{knowledge_dir}}/schemas/*.md`; before changing delivery cards, read `{{knowledge_dir}}/tasks/WORKFLOW.md`.
- When member context matters, prefer section-scoped reads from `{{knowledge_dir}}/members/<member-id>.md`; read `{{knowledge_dir}}/workspace/<member-id>/local/AGENTS.md` when acting on that member's local workspace, worklist, or personal execution style.

### Boundaries

- Treat `{{knowledge_dir}}/` and code as project facts; treat `{{knowledge_dir}}/planning/KANBAN.md` as delivery status.
- Apply scope precedence from `{{knowledge_dir}}/schemas/common.md`; stop and report conflicts that affect facts, delivery scope, permissions, review, ownership, or another member.
- Treat `{{knowledge_dir}}/proposals/` as a review buffer, not as facts, decisions, task items, or delivery commitments until converted.
- Keep localized files as translations only; never store secrets or private notes in `{{knowledge_dir}}/`.
- Treat `{{knowledge_dir}}/workspace/<member-id>/local/` and `{{agent_local_dir}}/` as local-only state; never stage or commit them.
- Share member workspace material through `summaries/`, `handoffs/`, and `research/`; keep raw captures and personal drafts under `local/`.
- Do not assign work by writing into another member's workspace. Use task items with `assignees` and approved Kanban updates.

### Skill Usage

- Use the platform skill loader; when `agent_skills.mode: project`, load collaboration skills from manifest `agent_skills.dir`.
- Use `knowledge-assistant` for workflow help, routing, recovery, and policy explanation; otherwise use the specific Skill whose description matches the request.
- Use `knowledge-intake` before unapproved knowledge writes, `knowledge-capture` only after approval, audit skills read-only, and `knowledge-workflow-admin` only by explicit maintainer choice.

### Delivery And Local Execution

- Accepted delivery work is tracked by thin cards in `{{knowledge_dir}}/planning/KANBAN.md` linked to task items under `{{knowledge_dir}}/tasks/items/`.
- Use `delivery-planning` for proposed task/card changes, `kanban-maintenance` only after approval, and `delivery-review` before moving changed delivery work to Done.
- Use `workspace-worklist:intake-task` when taking a Kanban card into the current member's local execution flow.
- `run-goal` coordinates accepted Kanban/worklist tasks toward review readiness; it is not open-ended product discovery.
- `auto-review` is a workflow approval mode, not a sandbox or host-permission mode. If project policy is missing or partial, keep vague auto-review to low-risk actions and ask a maintainer to define stable policy.
- Optional execution-method tools, including Superpowers, may help with planning, TDD, debugging, verification, worktrees, or authorized parallel agents, but they do not replace Knowledge Workflow ownership, gates, or review.

### Formatting, Git, And Safety

- The workflow must not depend on a specific runtime, language, package manager, shell, or script file.
- When doing actual project work, Agents may detect and use tools already available in the project or environment.
- For knowledge-only changes, use or suggest the project's available Markdown formatter/checker for supported knowledge files: `{{knowledge_dir}}/**/*.md`, `{{knowledge_dir}}/**/*.mdx`, `{{knowledge_dir}}/**/*.md.tpl`, and `{{knowledge_dir}}/**/*.mdx.tpl`.
- Commit only files intentionally changed for the current task; leave unrelated dirty files untouched.
- Before staging knowledge changes, confirm the staged diff excludes `{{knowledge_dir}}/workspace/*/local/**` and `{{agent_local_dir}}/**`.

### Project-Specific Knowledge Workflow

Add project-specific knowledge workflow rules here. This protected local subsection must remain the final `###` heading inside the `Knowledge Workflow` block.

Project-specific rules may specialize workflow behavior, but they must not weaken core safety, ownership, privacy, local-only, approval, or review rules. Use `knowledge-assistant` to explain or audit project-specific Agent policy. Maintainers must manually choose the workflow administration skill when the user asks to update or save policy.

<!-- knowledge-workflow:end -->
