# Repository Guidelines

## Project Overview

Choral Forma is a project for exploring a lightweight, editor-independent team knowledge application. The repository remains intentionally knowledge-first: product direction, concepts, decisions, task planning, and delivery workflow should be captured in `knowledge/`, while application code should keep Markdown files and explicit schemas as the source of truth.

The product should treat repository Markdown as the source of truth. Application code should read from and write to explicit files and schemas rather than creating a hidden proprietary knowledge store.

The current `knowledge/` directory is the development knowledge base for this repository. It guides Choral Forma project development, planning, and delivery; it is not the same thing as a future Choral Forma user workspace, and its repository-specific operating guidance should not be treated as automatic product requirements.

## Current Repository Layout

- `knowledge/`: repository-backed project knowledge, schemas, task items, planning notes, proposals, and member workspaces.
- `.agents/skills/`: project-local Forma CLI knowledge-operation entrypoint.
- `.worktrees/`: local-only worktrees; `.worktrees/.gitignore` remains trackable.
- `.claude/skills`: symlink to `.agents/skills` for Claude Code compatibility.
- `CLAUDE.md`: symlink to `AGENTS.md` for Claude Code compatibility.
- `crates/`: Rust workspace crates for the Forma core, RPC model, CLI, local HTTP server, and embedded WebApp serving.
- `packages/`: pnpm workspace packages for shared TypeScript code and the WebApp.
- `.vscode/` and `.zed/`: editor integration for Markdown and Prettier.
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
- Keep `knowledge/` readable as plain Markdown, but do not rely on editor-specific plugin syntax for project facts.

## Git And Commits

- Commit messages must start with a type-enum prefix such as `chore:`, `docs:`, `feat:`, `fix:`, `refactor:`, or `test:`.

## Forma Knowledge Management

This repository uses Forma-managed knowledge runtime in the repository Markdown and `.forma` config.

- Source of truth:
    - Markdown documents under `knowledge/`
    - `.forma.yml`
    - `.forma/spaces/*.md` (as configured workspace spaces)
    - `.forma/views/*.md` (where applicable)
- Use these bootstrap checks before knowledge reads or workflow actions:
    - `cargo run -q -p forma-cli -- config inspect --json`
    - `cargo run -q -p forma-cli -- knowledge health --json`
- Before task, review, proposal, or shared knowledge write operations, read configured guideline files declared in `.forma.yml`.
- Use the project-local `forma-cli` skill for:
    - knowledge health checks;
    - task list/inspect and board review;
    - review prep and knowledge-readability diagnosis.
- Do not write shared knowledge, task metadata, `.forma` config, or repository operating state without explicit user approval.
- Keep local-only state out of commits: `knowledge/workspace/*/local/`, `.forma/local/local.yml`, generated caches, worktrees, and browser state.
