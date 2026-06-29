# Choral Forma

Choral Forma is an early-stage exploration of a lightweight, editor-independent Markdown content workspace.

The project is files-first: product direction, reusable concepts, decisions, planning, and delivery workflow live in repository Markdown while the application reads and writes explicit Markdown files and schemas. The long-term product direction is to keep Markdown files and explicit schemas as the source of truth, rather than hiding workspace content in a proprietary store.

The current `knowledge/` directory is this repository's project content workspace. It guides Choral Forma project development, planning, and delivery; it is not the same thing as a generic future user workspace, and operational guidance is now managed through Forma and `forma-cli`.

Product-facing Forma docs, examples, UI copy, and CLI guidance should default to neutral terms such as workspace, content, entry, space, view, template, schema, and guideline. Terms like `knowledge`, `task`, `member`, or `project` describe this repository's dogfooding workspace or an example configuration, not Forma built-ins.

## Current Status

This repository is in P0 public-alpha stabilization. It is source-visible for early evaluation and installation, but it is not a production release. Public issue tracking is open for alpha feedback; external pull requests are not accepted before beta.

It contains:

- A repository-backed project workspace under `knowledge/`.
- Configured space schemas for product, concepts, decisions, planning, tasks, members, and workspace material.
- A project-local Forma CLI Agent skill with canonical source under `skills/` and an installed Agent entrypoint under `.agents/skills/`.
- Editor integration for VS Code, Zed, and the read-only Forma WebApp.
- A Rust workspace for the `forma` binary under `crates/`.
- A pnpm web workspace for the local read-only WebApp under `packages/`.
- Project tool versions declared through `package.json` and `rust-toolchain.toml`, with mise tasks for Rust and web checks.

The current application code implements the P0 read, inspect, check, render, serve, create, resource-preview, reference-navigation, and read-only WebApp surfaces. It is an alpha candidate for early feedback, not a production release.

## Repository Layout

- `knowledge/`: shared project content and repository operating guidance.
- `knowledge/product/`: product direction and user-facing behavior.
- `knowledge/concepts/`: reusable vocabulary and domain concepts.
- `knowledge/planning/`: planning notes and board-related knowledge.
- `knowledge/tasks/`: task items and task-related templates.
- `crates/forma-core/`: Rust core engine for config, schema, parsing, indexing, diagnostics, rendering, create flows, and workspace file operations.
- `crates/forma-rpc/`: shared operation dispatcher and minimal JSON-RPC 2.0 adapter model.
- `crates/forma-cli/`: Rust `forma` binary, CLI handlers, local HTTP server, and embedded WebApp asset serving.
- `packages/shared/`: shared TypeScript RPC client and operation result types.
- `packages/webapp/`: Vite React read-only Forma WebApp for browsing configured workspaces.
- `examples/`: committed example Forma workspaces for learning and demos.
- `skills/`: canonical project-local Agent skill sources that follow the skills.sh-style `skills/<name>/SKILL.md` layout.
- `.agents/skills/`: installed Agent runtime entrypoints aligned with the canonical skill sources.
- `.claude/skills`: symlink to `.agents/skills` for Claude Code compatibility.
- `AGENTS.md`: repository instructions for AI agents.
- `CLAUDE.md`: symlink to `AGENTS.md` for Claude Code compatibility.
- `mise.toml`: project tool and task configuration.

## Getting Started

Install the configured tools with mise:

```sh
mise install
```

Mise is a convenience path, not a hard requirement. The project version sources are `package.json` for Node.js and pnpm, and `rust-toolchain.toml` plus `Cargo.toml` for Rust.

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

## Run Example Workspaces

Example workspaces are separate from this repository's `knowledge/` project workspace:

- `examples/minimal-workspace/` is the smallest committed workspace shape.
- `examples/getting-started-workspace/` is the guided product demo and reader/view fixture.

Check the example workspace:

```sh
forma --workspace examples/minimal-workspace check --json
forma --workspace examples/getting-started-workspace check --json
```

Serve the read-only WebApp and RPC backend from an example workspace:

```sh
cargo run -p forma-cli -- --workspace examples/getting-started-workspace serve
```

Then open the printed local URL in a browser. Release builds embed the WebApp assets in the `forma` binary; development builds may show the embedded asset placeholder until `packages/webapp` has been built.

## Start An Empty Workspace

Use `forma init` in an empty or ordinary project directory to create the minimal Forma bootstrap:

```sh
forma init --name "Acme Workspace"
```

The command writes only `.forma.md` and `.agents/skills/forma-cli/SKILL.md`, and refuses to overwrite existing bootstrap files. It does not copy example workspace content, create default spaces, edit `AGENTS.md`, or generate canonical `skills/` sources.

After initialization, use the embedded Agent guide and checks:

```sh
forma skills get forma-cli-core
forma check --json
forma docs list
```

## Installing Forma

P0 releases are distributed as GitHub Release artifacts. Release builds embed the built WebApp assets into the Rust binary, so end users do not need Node.js, pnpm, Vite, or another frontend runtime to run `forma serve`.

The release workflow builds standalone `forma` archives for:

- `forma-linux-x64.tar.gz`;
- `forma-macos-arm64.tar.gz`;
- `forma-macos-x64.tar.gz`;
- `forma-windows-x64.zip`.

Each artifact is paired with a `.sha256` checksum file.

### Install Scripts

Unix-like systems:

```sh
curl -fsSL https://raw.githubusercontent.com/choral-io/choral-forma/main/install.sh | sh -s -- v0.1.0-alpha.10
```

Windows PowerShell:

```powershell
$script = iwr https://raw.githubusercontent.com/choral-io/choral-forma/main/install.ps1 -UseBasicParsing
& ([scriptblock]::Create($script.Content)) -Version v0.1.0-alpha.10
```

During the alpha stage, install a pinned release tag. GitHub does not expose prereleases through the `latest` release endpoint used by some installers and tools. Update the tag in these examples before publishing each new alpha release. Set `FORMA_INSTALL_DIR` to override the install directory.

### mise GitHub Backend

Forma release assets are also intended to work with mise's GitHub backend:

```sh
# Installing from GitHub Releases requires internet access. If the current
# environment is sandboxed without network access, run these install steps
# outside the sandbox, then use the installed shim from sandboxed sessions.
mise use github:choral-io/choral-forma@0.1.0-alpha.10
mise install github:choral-io/choral-forma@0.1.0-alpha.10
forma --version
```

A project or user config can declare the same tool:

```toml
[tools]
"github:choral-io/choral-forma" = "0.1.0-alpha.10"
```

Mise normally autodetects the matching GitHub Release asset from OS and architecture. During the alpha stage, pin a release version because `latest` does not resolve prerelease-only repositories. GitHub release tags use the `v0.1.0-alpha.10` form, while mise normalizes the GitHub backend tool version to `0.1.0-alpha.10`. If autodetection is not enough for a team's environment, add platform-specific `asset_pattern` values as described in the [mise GitHub backend documentation](https://mise.jdx.dev/dev-tools/backends/github.html).

After installation, verify that the CLI is available:

```sh
forma --version
```

## CI And Release Baseline

GitHub Actions runs three baseline check jobs:

- workspace Markdown formatting;
- Web package type checks and builds;
- Rust formatting, checks, and tests after building embedded WebApp assets.

## Working With Project Content

Use the local Forma config as the active project workspace context:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- `cargo run -q -p forma-cli -- list --space tasks --json`
- `cargo run -q -p forma-cli -- inspect <path> --json`
- `cargo run -q -p forma-cli -- inspect --space tasks <entry-id> --json`
- `cargo run -q -p forma-cli -- view render .forma/views/task-board --json`

For project context, start with [knowledge/README.md](knowledge/README.md). Keep durable project facts in `knowledge/` and keep local personal notes and Agent runtime state out of git.

## Commit Messages

Commit messages must start with a type-enum prefix such as `chore:`, `docs:`, `feat:`, `fix:`, `refactor:`, or `test:`.
