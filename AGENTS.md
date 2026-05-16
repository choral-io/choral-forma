# Repository Guidelines

## Project Overview

Choral Forma is a new project for exploring a lightweight, editor-independent team knowledge application. The initial repository state is intentionally knowledge-first: product direction, concepts, decisions, task planning, and delivery workflow should be captured in `knowledge/` before code structure is introduced.

The long-term product should treat repository Markdown as the source of truth. Application code, when added, should read from and write to explicit files and schemas rather than creating a hidden proprietary knowledge store.

The current `knowledge/` directory is the development knowledge base for this repository. It guides Choral Forma project development, planning, and delivery; it is not the same thing as a future Choral Forma user workspace, and its workflow rules should not be treated as automatic product requirements.

## Current Repository Layout

- `knowledge/`: repository-backed project knowledge, schemas, task items, planning workflow, proposals, and member workspaces.
- `.agents/skills/`: project-local Agent skills for knowledge workflow, planning, review, worklists, and audits.
- `.agents/.local/`: local-only Agent runtime state; ignored by git.
- `.claude/skills`: symlink to `.agents/skills` for Claude Code compatibility.
- `CLAUDE.md`: symlink to `AGENTS.md` for Claude Code compatibility.
- `.vscode/` and `.zed/`: editor integration for Markdown, Foam, and Prettier.
- `mise.toml`: project tool and task configuration.

## Tooling

Use mise for project tools and tasks:

```sh
mise install
mise run check:knowledge
mise run format:knowledge
```

`mise.toml` currently manages `npm:prettier` only. Do not add a package manager, runtime, build system, or application framework until the project actually needs one.

## Coding And Product Work

- Prefer small, explicit files and schemas over hidden application state.
- Keep product assumptions, requirements, design notes, and decisions in `knowledge/` before implementation.
- If code is introduced later, document the intended architecture in `knowledge/architecture/` and update this file with concrete build/test commands.
- Do not commit secrets, local worklists, local Agent state, or personal editor caches.
- Keep `knowledge/` Foam-compatible and Obsidian-readable, but do not rely on editor-specific plugin syntax for project facts.

## Git And Commits

- Commit messages must start with a type-enum prefix such as `chore:`,
  `docs:`, `feat:`, `fix:`, `refactor:`, or `test:`.

<!-- knowledge-workflow:start -->

## Knowledge Workflow

### Core Rules

- Treat `knowledge/` and code as project facts; treat `knowledge/planning/KANBAN.md` as delivery status.
- Before writing knowledge, read `knowledge/schemas/common.md` and the relevant area schema under `knowledge/schemas/`.
- Before changing delivery cards, read `knowledge/tasks/WORKFLOW.md`.
- Determine the current member id with `git config user.name`; do not infer it from OS, machine, shell, or chat names.
- When member context matters, prefer section-scoped reads from `knowledge/members/<member-id>.md`; read the full file only when editing, auditing, or resolving ambiguity.
- If a workflow acts on the current member's workspace, worklist, or personal execution style, read `knowledge/workspace/<member-id>/local/AGENTS.md` when it exists.
- Apply knowledge scope precedence from `knowledge/schemas/common.md` when project knowledge, shared workspace material, personal local notes, and current conversation conflict.
- Stop and report conflicts that affect facts, delivery scope, permissions, review, ownership, or another member instead of silently choosing one source.
- Treat `canonical_language: en` in `knowledge/.workflow/manifest.yml` as the canonical knowledge language for this repository.
- Treat `default_group_id: default-team` in `knowledge/.workflow/manifest.yml` as the default responsibility group.
- Keep localized files as translations only, and never store secrets or private notes in `knowledge/`.
- Use `knowledge/guidelines/` for cross-area writing, terminology, language, documentation, and process guidelines.
- Treat `knowledge/proposals/` as an optional review buffer. Proposals are not project facts, accepted decisions, task items, or delivery commitments until converted into the appropriate canonical document.
- Normative workflow documents, schemas, guidelines, and AGENTS knowledge rules may link to schemas, workflows, templates, examples, or other normative/reference documents required to apply the rule, but should not proactively link to product, design, concept, architecture, decision, planning, or task fact documents as general related knowledge. Fact documents may link back to the guidelines they follow.
- Treat `knowledge/workspace/<member-id>/local/` as local-only personal state; never stage or commit it.
- Treat `.agents/.local/` as local-only Agent runtime state; never stage or commit it.
- Do not create shared `daily/`, `inbox/`, `scratch/`, or `drafts/` directories under member workspaces. Use `local/scratch/` for raw personal captures, `local/drafts/` for structured personal drafts, `local/WORKLIST.md` for executable personal work, `summaries/` for edited summaries, `handoffs/` for handoffs, and `research/` for shareable investigations.
- Do not assign work by writing into another member's workspace. Use task items with `assignees` and approved Kanban updates for delegated team work.

### Project Skills

- Knowledge discussion: `.agents/skills/knowledge-intake/SKILL.md`
- Approved knowledge write: `.agents/skills/knowledge-capture/SKILL.md`
- Schema audit: `.agents/skills/knowledge-schema-audit/SKILL.md`
- Task audit: `.agents/skills/task-metadata-audit/SKILL.md`
- Status report: `.agents/skills/knowledge-status-report/SKILL.md`
- Personal worklist: `.agents/skills/workspace-worklist/SKILL.md`
- Planning dry-run: `.agents/skills/delivery-planning/SKILL.md`
- Pick next task: `.agents/skills/next-task-selection/SKILL.md`
- Board update: `.agents/skills/kanban-maintenance/SKILL.md`
- Implement: `.agents/skills/delivery-implementation/SKILL.md`
- Review: `.agents/skills/delivery-review/SKILL.md`

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

When available, Superpowers may guide execution method only: brainstorming, planning, TDD, debugging, verification, worktrees, or authorized parallel Agents. Knowledge Workflow still owns knowledge routing, task items, Kanban state, WORKLIST ownership, approval gates, and delivery review. Keep Superpowers plans under `knowledge/workspace/<member-id>/local/drafts/` unless approved for promotion; keep runtime worktrees under `.agents/.local/worktrees/`.

### Formatting And Checks

- Do not define the knowledge workflow as depending on a specific runtime, language, package manager, shell, or script file.
- When doing actual project work, Agents may detect and use tools already available in the project or environment.
- If reusable workflow documentation needs a script example, provide both Bash and PowerShell versions and mark them as optional examples, not requirements.
- For knowledge-only changes, use or suggest whatever Markdown formatter/checker is already available in this project for `knowledge/**/*.md`.

### Git And Safety

- Commit only the files intentionally changed for the current task.
- Leave unrelated dirty files untouched.
- Before staging knowledge changes, confirm the staged diff excludes `knowledge/workspace/*/local/**` and `.agents/.local/**`.

### Project-Specific Knowledge Workflow

- Choral Forma is a lightweight, editor-independent team knowledge application concept. Keep repository knowledge Markdown-first so the future app can treat files as the source of truth.
- Use `mise run format:knowledge` for knowledge Markdown formatting and `mise run check:knowledge` for check-only validation.
- Foam is the recommended short-term editor integration; do not make project knowledge depend on Foam-only or Obsidian-plugin-only syntax.

<!-- knowledge-workflow:end -->
