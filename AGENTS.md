# Repository Guidelines

## Project Overview

Choral Forma is a new project for exploring a lightweight, editor-independent team knowledge application. The repository remains intentionally knowledge-first: product direction, concepts, decisions, task planning, and delivery workflow should be captured in `knowledge/`, while current application code is still only a minimal scaffold.

The long-term product should treat repository Markdown as the source of truth. Application code, when added, should read from and write to explicit files and schemas rather than creating a hidden proprietary knowledge store.

The current `knowledge/` directory is the development knowledge base for this repository. It guides Choral Forma project development, planning, and delivery; it is not the same thing as a future Choral Forma user workspace, and its workflow rules should not be treated as automatic product requirements.

## Current Repository Layout

- `knowledge/`: repository-backed project knowledge, schemas, task items, planning workflow, proposals, and member workspaces.
- `.agents/skills/`: project-local Agent skills for knowledge workflow, planning, review, worklists, and audits.
- `.agents/.local/`: local-only Agent runtime state; ignored by git.
- `.claude/skills`: symlink to `.agents/skills` for Claude Code compatibility.
- `CLAUDE.md`: symlink to `AGENTS.md` for Claude Code compatibility.
- `crates/`: Rust workspace crates for the future Forma core, RPC model, and CLI.
- `packages/`: pnpm workspace packages for shared TypeScript code and the future WebApp.
- `.vscode/` and `.zed/`: editor integration for Markdown, Foam, and Prettier.
- `mise.toml`: project tool and task configuration.

## Tooling

Use mise for project tools and tasks:

```sh
mise install
pnpm install
mise run check:knowledge
mise run format:knowledge
mise run check:rust
mise run test:rust
mise run check:web
mise run build:web
mise run check
```

Tool versions are declared in the idiomatic project files: Node.js and pnpm in root `package.json`, and Rust in `rust-toolchain.toml` plus `Cargo.toml` `rust-version`. `mise.toml` enables mise to read those files and provides project tasks. Prettier is a project-local dev dependency in root `package.json`, installed through pnpm.

## Coding And Product Work

- Prefer small, explicit files and schemas over hidden application state.
- Keep product assumptions, requirements, design notes, and decisions in `knowledge/` before implementation.
- Keep Rust crates aligned with the accepted architecture in `knowledge/decisions/forma-p0-core-architecture.md`.
- Keep Web packages aligned with the accepted architecture in `knowledge/architecture/forma-core-technical-direction.md`.
- Do not commit secrets, local worklists, local Agent state, or personal editor caches.
- Keep `knowledge/` Foam-compatible and Obsidian-readable, but do not rely on editor-specific plugin syntax for project facts.

## Git And Commits

- Commit messages must start with a type-enum prefix such as `chore:`,
  `docs:`, `feat:`, `fix:`, `refactor:`, or `test:`.

<!-- knowledge-workflow:start -->

## Knowledge Workflow

### Required Context

- Knowledge directory: `knowledge/`.
- Treat `knowledge/` and code as project facts; treat `knowledge/planning/KANBAN.md` as delivery status.
- Read `knowledge/.workflow/manifest.yml` before using workflow skills; use its `knowledge_dir`, `agent_skills`, `agent_local_dir`, `canonical_language: en`, and `default_group_id: default-team` values for workflow paths.
- Determine the current member id with `git config user.name`; do not infer it from OS, machine, shell, or chat names.
- Before writing knowledge, read `knowledge/schemas/common.md` and the relevant `knowledge/schemas/*.md`.
- Before changing delivery cards, read `knowledge/tasks/WORKFLOW.md`.
- When member context matters, prefer section-scoped reads from `knowledge/members/<member-id>.md`; read the full file only when editing, auditing, or resolving ambiguity.
- If a workflow acts on the current member's workspace, worklist, or personal execution style, read `knowledge/workspace/<member-id>/local/AGENTS.md` when it exists.

### Source And Privacy Boundaries

- Apply scope precedence from `knowledge/schemas/common.md`; stop and report conflicts that affect facts, delivery scope, permissions, review, ownership, or another member.
- Keep localized files as translations only; do not store secrets or private notes in `knowledge/`.
- Treat `knowledge/proposals/` as a review buffer, not as project facts, accepted decisions, task items, or delivery commitments until converted.
- Treat `knowledge/workspace/<member-id>/local/` and `.agents/.local/` as local-only state; never stage or commit them.
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

- Accepted delivery work is tracked by thin cards in `knowledge/planning/KANBAN.md` linked to task items under `knowledge/tasks/items/`.
- Use `delivery-planning` for proposed task/card changes and `kanban-maintenance` only after approval.
- Use `workspace-worklist:intake-task` when taking a Kanban card into the current member's local execution flow.
- `run-goal` coordinates accepted Kanban/worklist tasks toward review readiness; it is not open-ended product discovery.
- `auto-review` is a workflow approval mode, not a sandbox or host-permission mode. If project policy is missing or partial, keep vague auto-review to low-risk actions and suggest `knowledge-workflow:policy auto-review` for stable policy.
- `delivery-review` is required before moving changed delivery work to Done.
- Optional execution-method tools, including Superpowers, may help with planning, TDD, debugging, verification, worktrees, or authorized parallel agents, but they do not replace Knowledge Workflow ownership, gates, or review.

### Formatting, Git, And Safety

- The workflow must not depend on a specific runtime, language, package manager, shell, or script file.
- When doing actual project work, Agents may detect and use tools already available in the project or environment.
- For knowledge-only changes, use or suggest the project's available Markdown formatter/checker for supported knowledge files: `knowledge/**/*.md`, `knowledge/**/*.mdx`, `knowledge/**/*.md.tpl`, and `knowledge/**/*.mdx.tpl`.
- Commit only files intentionally changed for the current task; leave unrelated dirty files untouched.
- Before staging knowledge changes, confirm the staged diff excludes `knowledge/workspace/*/local/**` and `.agents/.local/**`.

### Project-Specific Knowledge Workflow

- This protected local subsection must remain the final `###` heading inside the `Knowledge Workflow` block.
- Project-specific rules may specialize workflow behavior, but they must not weaken core safety, ownership, privacy, local-only, approval, or review rules.
- Use `knowledge-workflow:policy` to explain, audit, or update project-specific Agent policy; policy mode is read-only unless the user asks to update or save policy.
- Choral Forma is a lightweight, editor-independent team knowledge application concept. Keep repository knowledge Markdown-first so the future app can treat files as the source of truth.
- Use `mise run format:knowledge` for knowledge Markdown formatting and `mise run check:knowledge` for check-only validation.
- Foam is the recommended short-term editor integration; do not make project knowledge depend on Foam-only or Obsidian-plugin-only syntax.

<!-- knowledge-workflow:end -->
