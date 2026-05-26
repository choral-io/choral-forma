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
mise run check:pnpm
mise run format:pnpm
mise run check:rust
mise run test:rust
mise run build:pnpm
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

This repository uses Knowledge Workflow.

Resolve `<knowledge_dir>` from repository root `.knowledge-workflow` when present. If it is absent, use default `knowledge` only when `knowledge/.workflow/runtime.md` and `knowledge/.workflow/manifest.yml` both exist. Then read `<knowledge_dir>/.workflow/runtime.md` before workflow work. Runtime, manifest, rules, schemas, and Skill instructions are the source of truth.

Core boundaries:

- Do not guess workflow paths, current member id, or local-only paths.
- Do not write shared knowledge, Kanban, task metadata, or workflow state without the owning Skill and required approval.
- Keep `<knowledge_dir>/.workflow/local.yml`, `<knowledge_dir>/.feedback/`, `<knowledge_dir>/workspace/*/local/`, and worktree contents under `<worktrees_dir>/` local-only.
- When Knowledge Workflow guides Superpowers brainstorming or writing-plans output, prefer `<knowledge_dir>/workspace/<member-id>/local/superpowers/specs/` for specs and `<knowledge_dir>/workspace/<member-id>/local/superpowers/plans/` for plans unless the user explicitly specifies another safe path; local-only Superpowers output must not be committed.
- Use `knowledge-assistant` for workflow help, routing, recovery, and project rules explanation; otherwise use the specific Skill whose description matches the request.
- Use `knowledge-workflow-admin` only for explicit maintainer setup, check, migration, manifest, or approved configuration work.

### Project-Specific Rules

Project-specific rules may specialize workflow behavior, but they must not weaken runtime, safety, ownership, privacy, local-only, approval, or review rules.

- Use `mise run format:pnpm` for pnpm-managed formatting and `mise run check:pnpm` for check-only validation of non-Rust files.
- Keep `knowledge/` Foam-compatible and Obsidian-readable, but do not make project knowledge depend on Foam-only or Obsidian-plugin-only syntax for project facts.

<!-- knowledge-workflow:end -->
