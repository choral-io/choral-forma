# Repository Guidelines

## Project Overview

Choral Forma is a new project for exploring a lightweight, editor-independent team knowledge application. The repository remains intentionally knowledge-first: product direction, concepts, decisions, task planning, and delivery workflow should be captured in `knowledge/`, while current application code is still only a minimal scaffold.

The long-term product should treat repository Markdown as the source of truth. Application code, when added, should read from and write to explicit files and schemas rather than creating a hidden proprietary knowledge store.

The current `knowledge/` directory is the development knowledge base for this repository. It guides Choral Forma project development, planning, and delivery; it is not the same thing as a future Choral Forma user workspace, and its workflow rules should not be treated as automatic product requirements.

## Current Repository Layout

- `knowledge/`: repository-backed project knowledge, schemas, task items, planning workflow, proposals, and member workspaces.
- `.agents/skills/`: project-local Agent skills for knowledge workflow, planning, review, worklists, and audits.
- `.worktrees/`: local-only worktrees; `.worktrees/.gitignore` remains trackable.
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
- Read `knowledge/.workflow/manifest.yml` before workflow work; use its `knowledge_dir`, `agent_skills.required`, `worktree_dir`, and `canonical_language: en` values.
- Determine the current member id with `git config user.name`; do not infer it from OS, machine, shell, or chat names.
- Before writing knowledge, read `knowledge/schemas/common.md` and the relevant `knowledge/schemas/*.md`; before changing delivery cards, read `knowledge/planning/WORKFLOW.md`.
- When member context matters, prefer section-scoped reads from `knowledge/members/<member-id>.md`; read `knowledge/workspace/<member-id>/local/AGENTS.md` when acting on that member's local workspace, worklist, or personal execution style.

### Boundaries

- Treat `knowledge/` and code as project facts; treat `knowledge/planning/KANBAN.md` as delivery status.
- Apply scope precedence from `knowledge/schemas/common.md`; stop and report conflicts that affect facts, delivery scope, permissions, review, ownership, or another member.
- Treat `knowledge/proposals/` as a review buffer, not as facts, decisions, task items, or delivery commitments until converted.
- Keep localized files as translations only; never store secrets or private notes in `knowledge/`.
- Treat `knowledge/workspace/<member-id>/local/` and worktree contents under `.worktrees/` as local-only state; never stage or commit them. The managed `.worktrees/.gitignore` may be tracked.
- Share member workspace material through `summaries/`, `handoffs/`, and `research/`; keep raw captures and personal drafts under `local/`.
- Do not assign work by writing into another member's workspace. Use task items with `assignees` and approved Kanban updates.

### Skill Usage

- Use the platform Skill loader. Required Skills are external runtime capabilities listed in manifest `agent_skills.required`; do not copy or manage Skill files inside this repository.
- Use `knowledge-assistant` for workflow help, routing, recovery, and project rules explanation; otherwise use the specific Skill whose description matches the request.
- Use `knowledge-intake` before unapproved knowledge writes, `knowledge-capture` only after approval, audit skills read-only, and `knowledge-workflow-admin` only by explicit maintainer choice.

### Delivery And Local Execution

- Accepted delivery work is tracked by thin cards in `knowledge/planning/KANBAN.md` linked to task items under `knowledge/tasks/`.
- Use `delivery-planning` for proposed task/card changes, `kanban-maintenance` only after approval, and `delivery-review` before moving changed delivery work to Done.
- Use `workspace-worklist:intake-task` when taking a Kanban card into the current member's local execution flow.
- `run-goal` coordinates accepted Kanban/worklist tasks toward review readiness; it is not open-ended product discovery.
- `auto-review` is a workflow approval mode, not a sandbox or host-permission mode. If project rules are missing or partial, keep broad or unspecified auto-review to low-risk actions and ask a maintainer to define a stable rule set.
- Optional execution-method tools, including Superpowers, may help with planning, TDD, debugging, verification, worktrees, or authorized parallel agents, but they do not replace Knowledge Workflow ownership, gates, or review.

### Formatting, Git, And Safety

- The workflow must not depend on a specific runtime, language, package manager, shell, or script file.
- When doing actual project work, Agents may detect and use tools already available in the project or environment.
- For knowledge-only changes, use or suggest the project's available Markdown formatter/checker for supported knowledge and template files: `knowledge/**/*.md` and `knowledge/**/*.mdx`.
- Commit only files intentionally changed for the current task; leave unrelated dirty files untouched.
- Before staging knowledge changes, confirm the staged diff excludes `knowledge/workspace/*/local/**` and worktree contents under `.worktrees/`, except the managed `.worktrees/.gitignore`.

### Project-Specific Rules

- Choral Forma is a lightweight, editor-independent team knowledge application concept. Keep repository knowledge Markdown-first so the future app can treat files as the source of truth.
- Use `mise run format:knowledge` for knowledge Markdown formatting and `mise run check:knowledge` for check-only validation.
- Foam is the recommended short-term editor integration; do not make project knowledge depend on Foam-only or Obsidian-plugin-only syntax for project facts.

<!-- knowledge-workflow:end -->
