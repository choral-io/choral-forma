# Repository Guidelines

## Project Overview

Choral Forma is a project for exploring a lightweight, editor-independent Markdown content workspace. The repository remains intentionally files-first: product direction, concepts, decisions, task planning, and delivery workflow should be captured in `knowledge/`, while application code should keep Markdown files and explicit schemas as the source of truth.

The product should treat repository Markdown as the source of truth. Application code should read from and write to explicit files and schemas rather than creating a hidden proprietary content store.

The current `knowledge/` directory is this repository's project content workspace. It guides Choral Forma project development, planning, and delivery; it is not the same thing as a future Choral Forma user workspace, and its repository-specific operating guidance should not be treated as automatic product requirements.

Product-facing Forma docs, examples, UI copy, and CLI guidance should use neutral content-organization language: workspace, content, entry, space, view, template, schema, and guideline. Terms like `knowledge`, `task`, `member`, or `project` are allowed when describing this repository's dogfooding workspace or an example configuration, but they must not be presented as Forma built-ins.

## Current Repository Layout

- `knowledge/`: repository-backed project content, schemas, task items, planning notes, proposals, and member workspaces.
- `skills/`: canonical project-local Agent skill sources that follow the skills.sh-style `skills/<name>/SKILL.md` layout.
- `.agents/skills/`: installed Agent runtime entrypoints aligned with the canonical skill sources.
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

## Forma Workspace Management

This repository uses Forma-managed workspace runtime in the repository Markdown and `.forma` config.

- Source of truth:
    - Markdown documents under `knowledge/`
    - `.forma.md`
    - `.forma/spaces/*.md` (as configured workspace spaces)
    - `.forma/views/*.md` (where applicable)
- Use these bootstrap checks before project workspace reads or workflow actions:
    - `cargo run -q -p forma-cli -- config inspect --json`
    - `cargo run -q -p forma-cli -- workspace health --json`
- Before task, review, proposal, or shared project content write operations, read configured guideline files declared in `.forma.md`.
- Use the project-local `forma-cli` skill for:
    - workspace health checks;
    - task list/inspect and board review;
    - review prep and content-readability diagnosis.
- Do not write shared project content, task metadata, `.forma` config, or repository operating state without explicit user approval.
- Keep local-only state out of commits according to repository workflow guidance and Git hygiene. In this repository that includes `knowledge/workspace/*/local/`, `.forma/local/` when present, generated caches, worktrees, and browser state. Forma runtime should not infer knowledge semantics from `.gitignore`.
