# Choral Forma

Choral Forma is an early-stage exploration of a lightweight,
editor-independent team knowledge application.

The project is currently knowledge-first: product direction, reusable concepts,
decisions, planning, and delivery workflow live in repository Markdown before
application code is introduced. The long-term product direction is to keep
Markdown files and explicit schemas as the source of truth, rather than hiding
team knowledge in a proprietary store.

The current `knowledge/` directory is the development knowledge base for this
repository. It guides Choral Forma project development, planning, and delivery;
it is not the same thing as a future Choral Forma user workspace, and its
workflow rules should not be treated as automatic product requirements.

## Current Status

This repository is in its initial setup phase. It contains:

- A repository-backed knowledge base under `knowledge/`.
- Workflow schemas for product, concepts, decisions, planning, tasks, members,
  and workspace material.
- Project-local Agent skills under `.agents/skills/` for knowledge workflow,
  planning, review, and maintenance.
- Editor integration for VS Code, Foam, Obsidian-readable Markdown, and Zed.
- Mise tasks for formatting and checking knowledge Markdown.

There is no application runtime or build system yet.

## Repository Layout

- `knowledge/`: shared project knowledge and workflow rules.
- `knowledge/product/`: product direction and user-facing behavior.
- `knowledge/concepts/`: reusable vocabulary and domain concepts.
- `knowledge/planning/`: Kanban board and planning workflow.
- `knowledge/tasks/`: task workflow and task item templates.
- `.agents/skills/`: project-local Agent workflow skills.
- `.agents/.local/`: local-only Agent runtime state, ignored by git.
- `AGENTS.md`: repository instructions for AI agents.
- `CLAUDE.md`: symlink to `AGENTS.md` for Claude Code compatibility.
- `mise.toml`: project tool and task configuration.

## Getting Started

Install the configured tools:

```sh
mise install
```

Check Markdown formatting:

```sh
mise run check:knowledge
```

Format Markdown:

```sh
mise run format:knowledge
```

## Working With Knowledge

Start with [knowledge/README.md](knowledge/README.md) for the knowledge base
structure and source-of-truth rules.

Product context begins in
[knowledge/product/choral-forma.md](knowledge/product/choral-forma.md). The
initial reusable concepts are in [knowledge/concepts/](knowledge/concepts/).

Keep durable project facts in `knowledge/`. Keep local personal notes and Agent
runtime state out of git.

## Commit Messages

Commit messages must start with a type-enum prefix such as `chore:`, `docs:`,
`feat:`, `fix:`, `refactor:`, or `test:`.
