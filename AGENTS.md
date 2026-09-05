# Repository Guidelines

## Product Boundaries

Choral Forma is a files-first Markdown workspace in Public Preview. Markdown and explicit configuration own content and semantics; derived indexes and caches must be rebuildable. Core owns behavior shared by CLI, RPC, WebApp, static export, and editor integrations.

This repository's `knowledge/`, Task, member, and handoff conventions are configurable examples, not Forma built-ins. Product-facing docs and interfaces use neutral content-organization language. Explicit configuration determines inputs; `.gitignore` and a directory named `local` do not provide runtime privacy.

Reuse accepted design and inspect relevant later decisions before changing it. Routine fixes need no new proposal; unresolved product behavior, external contracts, or architecture decisions need a concrete proposal within the user's authorized scope.

## Navigation

- `crates/`: Core, RPC, CLI/server, and LSP; `packages/`: shared contracts, graph rendering, and WebApp.
- `docs/`: canonical product docs and built-in help/skill projections; `knowledge/`: repository product, architecture, and delivery records.
- `extensions/`: editor adapters; `examples/`: runnable workspace fixtures; `scripts/`: build, validation, and release tooling.
- `skills/`: canonical project skill sources; `.agents/skills/`: installed entrypoints.

Read applicable nested `AGENTS.md` files before editing their scope, including ignored local rules.

## Guideline Routing

Use the repository source CLI: `cargo run -q -p forma-cli -- <arguments>` (through `mise exec --` when needed). In pointers below, `skills get <id>` means arguments to that invocation. Load the default projection first; use `--full` for its referenced branch. Discover unknown IDs with `skills list --json`.

| Task condition | Guideline skill ID |
| --- | --- |
| Configuration semantics, paths, classification, or cross-surface contracts | `forma-product-model-and-configuration-fidelity` |
| Workspace loading, snapshots, caches, performance, or static generation | `forma-runtime-cache-and-performance` |
| WebApp components, state, layout, interaction, or visual verification | `webapp-engineering-and-visual-validation` |
| Workspace inspection, content placement, or shared knowledge writes | `workspace-operations` |
| Unclear knowledge request | `workspace-onboarding-and-routing` |
| Shared Markdown authoring / write authorization | `markdown-authoring` / `proposal-and-dry-run` |
| Named Task selection, execution, review, or state changes | `task-selection` |
| Handoff, resumption, or personal worklists | `local-worklist-and-execution` |
| Release version, candidate, tag, publication, or release evidence | `release-execution-and-verification` |

Ordinary source reading and known engineering skill loading need no full workspace bootstrap. Follow `workspace-operations` for configuration/health baselines, selective loading, member resolution, and shared-content verification. Dependency changes additionally read `knowledge/guidelines/dependency-governance.md`.

## Verification

Use `mise run <task>` and `mise exec -- pnpm <command>`; current scripts and version authorities are in `mise.toml`, `package.json`, `.node-version`, `rust-toolchain.toml`, and `Cargo.toml`. Installation and whole-repository formatting are deliberate setup/maintenance actions, not default checks.

| Change | Evidence |
| --- | --- |
| Markdown or Agent instructions | Targeted formatting and references; workspace checks and affected skill projections when managed content changes |
| Core/RPC/LSP | Affected crate tests and consumer/operation contracts; broaden to `mise run check` for shared behavior or complete code delivery |
| WebApp | Affected type/lint/behavior checks and build; visual validation follows its guideline |
| Release | Exact-candidate local and CI gates plus platform/artifact evidence from the release guideline; local success does not replace publication verification |

Reuse passing evidence until changes, failures, or unresolved risks justify rerunning. Report unrelated baseline failures and environmental limits separately.

## Authority And Delivery

Shared knowledge, configuration, Task state, commits, and publication require task authorization. Reuse existing approval within the same scope; a preview is not an extra approval round. Preserve unrelated changes and private material. Keep `knowledge/workspace/*/local/`, `.forma/local/`, worktrees, generated caches, and browser state out of commits.

Use Conventional Commit prefixes. Report the outcome, verification, and remaining work; a handoff does not accept a Task. Follow its existing audience and location when updating it.
