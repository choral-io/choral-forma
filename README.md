# Choral Forma

Choral Forma is an early-stage exploration of a lightweight,
editor-independent team knowledge application.

The project is currently knowledge-first: product direction, reusable concepts,
decisions, planning, and delivery workflow live in repository Markdown while the
application code remains a minimal scaffold. The long-term product direction is
to keep Markdown files and explicit schemas as the source of truth, rather than
hiding team knowledge in a proprietary store.

The current `knowledge/` directory is the development knowledge base for this
repository. It guides Choral Forma project development, planning, and delivery;
it is not the same thing as a future Choral Forma user workspace, and its
workflow rules should not be treated as automatic product requirements.

## Current Status

This repository is in P0 internal-test stabilization. It contains:

- A repository-backed knowledge base under `knowledge/`.
- Workflow schemas for product, concepts, decisions, planning, tasks, members,
  and workspace material.
- Project-local Agent skills under `.agents/skills/` for knowledge workflow,
  planning, review, and maintenance.
- Editor integration for VS Code, Foam, Obsidian-readable Markdown, and Zed.
- A Rust workspace for the `forma` binary under `crates/`.
- A pnpm web workspace for the local read-only WebApp under `packages/`.
- Project tool versions declared through `package.json` and
  `rust-toolchain.toml`, with mise tasks for knowledge, Rust, and web checks.

The current application code implements the P0 read, inspect, check, index,
render, serve, create, resource-preview, reference-navigation, and read-only
WebApp surfaces. It is an internal-test candidate, not a production release.

## Repository Layout

- `knowledge/`: shared project knowledge and workflow rules.
- `knowledge/product/`: product direction and user-facing behavior.
- `knowledge/concepts/`: reusable vocabulary and domain concepts.
- `knowledge/planning/`: Kanban board and planning workflow.
- `knowledge/tasks/`: task workflow and task item templates.
- `crates/forma-core/`: Rust core engine for config, schema, parsing, indexing,
  diagnostics, rendering, create flows, and workspace file operations.
- `crates/forma-rpc/`: shared operation dispatcher and minimal JSON-RPC 2.0
  adapter model.
- `crates/forma-cli/`: Rust `forma` binary, CLI handlers, local HTTP server, and
  embedded WebApp asset serving.
- `packages/shared/`: shared TypeScript RPC client and operation result types.
- `packages/webapp/`: Vite React read-only WebApp for browsing configured Forma
  workspaces.
- `.agents/skills/`: project-local Agent workflow skills.
- `.agents/.local/`: local-only Agent runtime state, ignored by git.
- `AGENTS.md`: repository instructions for AI agents.
- `CLAUDE.md`: symlink to `AGENTS.md` for Claude Code compatibility.
- `mise.toml`: project tool and task configuration.

## Getting Started

Install the configured tools with mise:

```sh
mise install
```

Mise is a convenience path, not a hard requirement. The project version sources
are `package.json` for Node.js and pnpm, and `rust-toolchain.toml` plus
`Cargo.toml` for Rust.

Check non-Rust files:

```sh
mise run check:pnpm
```

Format non-Rust files:

```sh
mise run format:pnpm
```

Install JavaScript dependencies:

```sh
pnpm install
```

Run Rust checks and tests:

```sh
mise run check:rust
mise run test:rust
```

Build the pnpm workspace:

```sh
mise run build:pnpm
```

Run all checks:

```sh
mise run check
```

## Installing Forma

P0 releases are distributed as GitHub Release artifacts. Release builds embed
the built WebApp assets into the Rust binary, so end users do not need Node.js,
pnpm, Vite, or another frontend runtime to run `forma serve`.

The release workflow builds standalone `forma` archives for:

- `forma-linux-x64.tar.gz`;
- `forma-macos-arm64.tar.gz`;
- `forma-macos-x64.tar.gz`;
- `forma-windows-x64.zip`.

Each artifact is paired with a `.sha256` checksum file.

### Install Scripts

Unix-like systems:

```sh
curl -fsSL https://raw.githubusercontent.com/choral-io/choral-forma/main/install.sh | sh
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/choral-io/choral-forma/main/install.ps1 -UseBasicParsing | iex
```

The scripts install the latest GitHub Release by default. Pass a release tag to
pin a version, or set `FORMA_INSTALL_DIR` to override the install directory.

### mise GitHub Backend

Forma release assets are also intended to work with mise's GitHub backend:

```sh
mise use -g github:choral-io/choral-forma
```

A project or user config can declare the same tool:

```toml
[tools]
"github:choral-io/choral-forma" = "latest"
```

Mise normally autodetects the matching GitHub Release asset from OS and
architecture. If autodetection is not enough for a team's environment, add
platform-specific `asset_pattern` values as described in the
[mise GitHub backend documentation](https://mise.jdx.dev/dev-tools/backends/github.html).

## CI And Release Baseline

GitHub Actions runs three baseline check jobs:

- knowledge Markdown formatting;
- Web package type checks and builds;
- Rust formatting, checks, and tests after building embedded WebApp assets.

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
