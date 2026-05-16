<!-- knowledge-workflow:start -->

## Knowledge Workflow

### Core Rules

- Treat `{{knowledge_dir}}/` and code as project facts; treat `{{knowledge_dir}}/planning/KANBAN.md` as delivery status.
- Before writing knowledge, read `{{knowledge_dir}}/schemas/common.md` and the relevant area schema under `{{knowledge_dir}}/schemas/`.
- Before changing delivery cards, read `{{knowledge_dir}}/tasks/WORKFLOW.md`.
- Determine the current member id with `git config user.name`; do not infer it from OS, machine, shell, or chat names.
- When member context matters, prefer section-scoped reads from `{{knowledge_dir}}/members/<member-id>.md`; read the full file only when editing, auditing, or resolving ambiguity.
- If a workflow acts on the current member's workspace, worklist, or personal execution style, read `{{knowledge_dir}}/workspace/<member-id>/local/AGENTS.md` when it exists.
- Apply knowledge scope precedence from `{{knowledge_dir}}/schemas/common.md` when project knowledge, shared workspace material, personal local notes, and current conversation conflict.
- Stop and report conflicts that affect facts, delivery scope, permissions, review, ownership, or another member instead of silently choosing one source.
- Treat `canonical_language: {{canonical_language}}` in `{{knowledge_dir}}/.workflow/manifest.yml` as the canonical knowledge language for this repository.
- Treat `default_group_id: {{default_group_id}}` in `{{knowledge_dir}}/.workflow/manifest.yml` as the default responsibility group.
- Keep localized files as translations only, and never store secrets or private notes in `{{knowledge_dir}}/`.
- Use `{{knowledge_dir}}/guidelines/` for cross-area writing, terminology, language, documentation, and process guidelines.
- Treat `{{knowledge_dir}}/proposals/` as an optional review buffer. Proposals are not project facts, accepted decisions, task items, or delivery commitments until converted into the appropriate canonical document.
- Normative workflow documents, schemas, guidelines, and AGENTS knowledge rules may link to schemas, workflows, templates, examples, or other normative/reference documents required to apply the rule, but should not proactively link to product, design, concept, architecture, decision, planning, or task fact documents as general related knowledge. Fact documents may link back to the guidelines they follow.
- Treat `{{knowledge_dir}}/workspace/<member-id>/local/` as local-only personal state; never stage or commit it.
- Treat `{{agent_local_dir}}/` as local-only Agent runtime state; never stage or commit it.
- Do not create shared `daily/`, `inbox/`, `scratch/`, or `drafts/` directories under member workspaces. Use `local/scratch/` for raw personal captures, `local/drafts/` for structured personal drafts, `local/WORKLIST.md` for executable personal work, `summaries/` for edited summaries, `handoffs/` for handoffs, and `research/` for shareable investigations.
- Do not assign work by writing into another member's workspace. Use task items with `assignees` and approved Kanban updates for delegated team work.

### Project Skills

- Knowledge discussion: `{{agent_skills_dir}}/knowledge-intake/SKILL.md`
- Approved knowledge write: `{{agent_skills_dir}}/knowledge-capture/SKILL.md`
- Schema audit: `{{agent_skills_dir}}/knowledge-schema-audit/SKILL.md`
- Task audit: `{{agent_skills_dir}}/task-metadata-audit/SKILL.md`
- Status report: `{{agent_skills_dir}}/knowledge-status-report/SKILL.md`
- Personal worklist: `{{agent_skills_dir}}/workspace-worklist/SKILL.md`
- Planning dry-run: `{{agent_skills_dir}}/delivery-planning/SKILL.md`
- Pick next task: `{{agent_skills_dir}}/next-task-selection/SKILL.md`
- Board update: `{{agent_skills_dir}}/kanban-maintenance/SKILL.md`
- Implement: `{{agent_skills_dir}}/delivery-implementation/SKILL.md`
- Review: `{{agent_skills_dir}}/delivery-review/SKILL.md`

Open the relevant repository-local `SKILL.md` before acting. Start with intake when the user only mentions a possible knowledge change; use capture only after the user asks to write. Audit skills are read-only.

Default sequence:

```text
knowledge discussion -> knowledge-intake
approved knowledge write -> knowledge-capture
schema audit -> knowledge-schema-audit
task audit -> task-metadata-audit
project/knowledge status report -> knowledge-status-report
personal worklist / team task intake / run-next / run-loop / run-goal / plan-only / worklist grooming -> workspace-worklist
planning dry-run -> delivery-planning
pick next -> next-task-selection
board update -> kanban-maintenance
implement -> delivery-implementation
review -> delivery-review
```

Combine skills only when the request crosses boundaries. Apply audit findings through the maintenance or implementation skill that owns the affected area.

### Optional Superpowers Guidance

When available, Superpowers may guide execution method only: brainstorming, planning, TDD, debugging, verification, worktrees, or authorized parallel Agents. Knowledge Workflow still owns knowledge routing, task items, Kanban state, WORKLIST ownership, approval gates, and delivery review. Keep Superpowers plans under `{{knowledge_dir}}/workspace/<member-id>/local/drafts/` unless approved for promotion; keep runtime worktrees under `{{agent_local_dir}}/worktrees/`.

### Formatting And Checks

- Do not define the knowledge workflow as depending on a specific runtime, language, package manager, shell, or script file.
- When doing actual project work, Agents may detect and use tools already available in the project or environment.
- If reusable workflow documentation needs a script example, provide both Bash and PowerShell versions and mark them as optional examples, not requirements.
- For knowledge-only changes, use or suggest whatever Markdown formatter/checker is already available in this project for `{{knowledge_dir}}/**/*.md`.

### Git And Safety

- Commit only the files intentionally changed for the current task.
- Leave unrelated dirty files untouched.
- Before staging knowledge changes, confirm the staged diff excludes `{{knowledge_dir}}/workspace/*/local/**` and `{{agent_local_dir}}/**`.

### Project-Specific Knowledge Workflow

Add project-specific knowledge workflow rules here. This protected local subsection must remain the final `###` heading inside the `Knowledge Workflow` block.

Project-specific rules may specialize workflow behavior, but they must not weaken core safety, ownership, privacy, local-only, approval, or review rules.

<!-- knowledge-workflow:end -->
