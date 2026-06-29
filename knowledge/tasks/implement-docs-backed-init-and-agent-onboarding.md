---
schemaVersion: 1
kind: task
scope: project
title: "Implement Docs-Backed Init And Agent Onboarding"
summary: "Create a minimal Forma init flow and embedded product docs so internal team members can start from an empty project and use Agent-guided workspace setup."
type: task
priority: P0
value: H
module: cli
effort: L
status: reviewing
readiness: ready
owners:
    - "members/tiscs"
assignees:
    - "members/tiscs"
reviewers:
    - "members/tiscs"
tags:
    - forma
    - cli
    - docs
    - agents
    - onboarding
    - internal-test
blockedBy: []
relatedTo:
    - "product/product-direction"
    - "product/forma-p0-starter-spec"
    - "architecture/forma-p0-operation-api-spec"
    - "tasks/run-starter-kit-agent-pressure-validation"
    - "user-stories/agent-maintains-project-knowledge"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: "Forma CLI onboarding, embedded docs, Agent skill guidance, internal team adoption"
---

# Implement Docs-Backed Init And Agent Onboarding

## Goal

Make the next internal-test stage usable by other team members who install `forma` and start from an empty or ordinary project directory.

The first usable path should be:

1. Install `forma`.
2. Run `forma init` in a project directory.
3. Get a minimal valid Forma workspace plus an Agent runtime entrypoint.
4. Ask an Agent to load the Forma CLI skill and help define the actual knowledge structure.
5. Iterate on spaces, templates, views, and guidelines with `forma check`, `forma workspace health`, and `forma serve`.

This stage should optimize for fast internal adoption and feedback collection, not for a complete starter-kit registry or production-grade onboarding wizard.

## Product Direction

`forma init` should be bootstrap-only in this stage.

It should create the smallest project state needed for Forma and Agents to take over:

- `.forma.md`
- `.agents/skills/forma-cli/SKILL.md`

It should not create:

- `skills/forma-cli/SKILL.md`
- `AGENTS.md`
- starter-kit sample content
- default `notes`, `tasks`, `members`, or `guidelines` structures
- remote starter-kit registry state

The generated `.agents/skills/forma-cli/SKILL.md` is an Agent runtime entrypoint, not a canonical skills.sh source. The canonical product documentation and Agent guidance should come from embedded product docs shipped in the `forma` binary.

## Docs Source Model

Add a committed `docs/` directory for product-facing Forma documentation.

`docs/` is different from `knowledge/`:

- `knowledge/` records how this repository develops, decides, plans, and delivers Forma.
- `docs/` documents how users and Agents use Forma as a product.

Initial docs structure:

```text
docs/
  index.md
  getting-started.md
  cli/
    init.md
    config.md
    check.md
    serve.md
    skills.md
  workspace/
    configuration.md
    spaces.md
    schemas.md
    templates.md
    views.md
    guidelines.md
  agents/
    forma-cli-core.md
    workspace-bootstrap.md
    knowledge-maintenance.md
```

Docs may use frontmatter to support CLI and skill projection:

```yaml
---
id: workspace.configuration
title: Workspace Configuration
summary: Define the minimal `.forma.md` and imported config node model.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
    - skill
commands:
    - forma init
    - forma config inspect
order: 20
---
```

Initial required frontmatter fields:

- `id`
- `title`
- `summary`
- `audience`
- `surfaces`
- `order`

Optional fields:

- `commands`
- `skill`
- `related`

Docs should use stable headings when a surface needs a specific excerpt:

- `## Overview`
- `## CLI Help`
- `## Agent Guidance`
- `## Reference`
- `## Examples`

First implementation can keep extraction simple: use full Markdown for skills, and use `## CLI Help` or `summary` for concise help output when present.

## Embedded Docs Runtime

Build release binaries with `docs/` embedded.

Implementation direction:

- Add a docs asset embedding path in a core or CLI crate.
- Parse doc frontmatter and Markdown body into a small docs registry.
- Use stable doc `id` as identity.
- Preserve original Markdown for Agent-facing output.
- Fail build or tests when required docs are missing, duplicate ids exist, or required frontmatter is invalid.

The embedded docs registry should be reusable by:

- `forma help` or a future docs/help command surface;
- `forma skills list`;
- `forma skills get forma-cli-core`;
- `forma init` when generating the Agent runtime entrypoint.

## CLI Surface

### `forma init`

Initial command:

```sh
forma init [--name <name>] [--language <tag>] [--timezone <tz>] [--json]
```

Behavior:

- Resolve target workspace from current directory or global `--workspace`.
- Refuse to overwrite existing `.forma.md` unless a later force/review design is accepted.
- Write minimal `.forma.md`.
- Write `.agents/skills/forma-cli/SKILL.md`.
- Create parent directories as needed.
- Print changed paths and next commands.
- In JSON mode, return an operation-style result with planned/written paths and diagnostics.

Minimal `.forma.md`:

```yaml
schemaVersion: 1

workspace:
    name: "Untitled Forma Workspace"
    canonicalLanguage: "en"
    supportedLanguages:
        - "en"
    timezone: "UTC"

runtime:
    values:
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot

imports:
    - ".forma/*.md"
    - ".forma/spaces/*.md"
    - ".forma/views/*.md"
    - ".forma/local/*.md"
```

Acceptance behavior:

- `forma config inspect --json` passes after init.
- `forma check --json` passes or returns only intentional empty-workspace info/warnings.
- `forma skills list --json` returns built-in `forma-cli-core`.
- `forma skills get forma-cli-core` gives enough Agent guidance to continue workspace setup.

### `forma help` / docs help

Current clap help should remain available.

The first docs-backed surface can be either:

```sh
forma help <topic>
```

or:

```sh
forma docs list
forma docs get <id>
```

Prefer the smallest implementation that does not fight clap. If replacing or extending clap help creates too much risk, add `forma docs` first and later integrate selected docs into command help.

### `forma skills`

`forma skills list` should include built-in skills derived from embedded docs.

`forma skills get forma-cli-core` should be generated from `docs/agents/forma-cli-core.md` and related docs sections, not from a Rust string literal maintained separately from product documentation.

## Skill And Pressure-Test Plan

Use the `writing-skills` RED-GREEN-REFACTOR model for Agent guidance.

### RED: Baseline Failures

Before improving the embedded Agent guidance, run pressure scenarios against the current skill/docs behavior and record failures.

Required baseline scenarios:

1. Empty project bootstrap:
    - Prompt: "I installed Forma in an empty repo. Set up the smallest usable knowledge workspace."
    - Expected current failure: Agent lacks enough configuration rules or invents paths/structures.
2. Scenario-driven workspace design:
    - Prompt: "Create a lightweight project knowledge base for product decisions and tasks, but do not copy the starter-kit."
    - Expected current failure: Agent overfits to starter-kit or old repository-specific paths.
3. Config maintenance:
    - Prompt: "Add a new space with create support and a table view."
    - Expected current failure: Agent cannot reliably write `.forma/spaces/*.md`, templates, and view config without examples.
4. Agent boundary:
    - Prompt: "Install whatever files are needed so future Agents can use Forma here."
    - Expected current failure: Agent may create `skills/forma-cli/SKILL.md` or edit `AGENTS.md` unnecessarily.

Record:

- commands run;
- files proposed or written;
- incorrect assumptions;
- missing docs or unclear rules;
- exact Agent rationalizations where useful.

### GREEN: Minimal Docs And Skill Guidance

Add only the docs and embedded skill guidance needed to pass the baseline scenarios:

- `docs/agents/forma-cli-core.md`
- `docs/agents/workspace-bootstrap.md`
- `docs/workspace/configuration.md`
- `docs/workspace/spaces.md`
- `docs/workspace/templates.md`
- `docs/workspace/views.md`
- `docs/workspace/guidelines.md`
- `docs/cli/init.md`

The Agent guidance must explicitly state:

- run from workspace root or pass `--workspace`;
- use `forma init` only for bootstrap;
- do not create `skills/forma-cli/SKILL.md` during init;
- do not create or modify `AGENTS.md` during init;
- derive workspace structure from Human goals;
- use workspace-relative POSIX paths rooted at `.forma.md`;
- validate after each configuration slice.

### REFACTOR: Close Loopholes

Re-run the same scenarios and add targeted guidance for any new rationalizations:

- copying starter-kit content without request;
- treating `.forma/` as a hidden knowledge store;
- inventing local-only path semantics;
- treating `tasks` as a built-in Forma concept;
- editing shared project content without approval;
- skipping `forma check` or `workspace health`.

## Implementation Slices

### Slice 1: Docs Source And Registry

- Add `docs/` with the initial docs listed above.
- Add parser tests for frontmatter, duplicate ids, and required fields.
- Add embedded docs registry using release-safe compile-time assets.
- Keep docs parsing independent from workspace config parsing.

### Slice 2: Built-In Skill From Docs

- Keep built-in `forma-cli-core` content in `docs/agents/forma-cli-core.md`.
- Update `skills list/get` to read the embedded docs registry.
- Keep output shape compatible with existing `skills.list` and `skills.get`.
- Add tests proving built-in skill still works without `.forma.md`.

### Slice 3: Minimal `forma init`

- Reintroduce `init` as a new implementation, not the removed old initializer.
- Add operation/request/result types if needed.
- Add CLI tests for empty directory, existing `.forma.md`, JSON output, and generated files.
- Make initialized empty workspace valid enough for `config inspect`, `check`, and `skills`.

### Slice 4: Help/Docs Surface

- Add the smallest docs-backed read surface.
- Prefer `forma docs list/get` if direct `forma help <topic>` integration is too risky for the first pass.
- Add command tests for stable topic lookup and missing topic diagnostics.

### Slice 5: Internal Adoption Validation

- Create a disposable empty project.
- Install or use the release binary.
- Run `forma init`.
- Ask an Agent to load the generated `.agents/skills/forma-cli/SKILL.md`.
- Have the Agent build a small scenario-specific knowledge workspace without copying starter-kit content.
- Verify with:
    - `forma config inspect --json`
    - `forma check --json`
    - `forma workspace health --json`
    - `forma serve` smoke test when local server approval is available

## Out Of Scope

- Remote starter-kit registry.
- Copying `examples/getting-started-workspace` through `forma init`.
- Full interactive wizard.
- WebApp editing flows.
- MCP server.
- Policy runtime enforcement.
- Automatic migration of existing knowledge bases.
- Automatic edits to `AGENTS.md`.
- Generating canonical `skills/forma-cli/SKILL.md`.

## Acceptance Criteria

- A user can run `forma init` in an empty project and get a valid minimal Forma workspace.
- The generated Agent runtime skill is enough to lead an Agent to `forma skills get forma-cli-core`.
- Embedded docs provide enough configuration guidance for an Agent to add spaces, templates, views, and guidelines without copying starter-kit content.
- `forma skills get forma-cli-core` is backed by embedded `docs/` content.
- The docs registry has tests for required metadata and duplicate ids.
- Internal pressure scenarios demonstrate improved Agent behavior after the docs-backed skill changes.
- Repository checks pass after implementation.

## Review Focus

- Does `docs/` stay product-facing and avoid becoming a second project knowledge base?
- Is `forma init` narrow enough for fast internal adoption?
- Does the embedded docs model avoid maintaining separate duplicated help, skill, and docs text?
- Can Agent guidance reliably bootstrap a workspace from Human goals?
- Are the pressure scenarios strong enough to catch overfitting to the current starter-kit?

## Implementation Notes

Initial implementation completed the bootstrap-only slice:

- Added product-facing `docs/` source files for getting started, CLI usage, workspace configuration, spaces, schemas, templates, views, guidelines, and Agent guidance.
- Added an embedded docs registry in `forma-core`.
- Moved built-in `forma-cli-core` output to `docs/agents/forma-cli-core.md` through the embedded docs registry.
- Added `forma docs list` and `forma docs get <id>` as the first docs-backed help surface.
- Reintroduced `forma init` as a new minimal bootstrap command.
- Added JSON-RPC `init` wiring for operation-model consistency.
- Removed the previous standalone built-in skill code asset.

RED baseline evidence:

- In an empty temporary project, `forma init --json` failed because the subcommand did not exist.
- In an empty temporary project, `forma config inspect --json`, `forma check --json`, and `forma create notes ... --json` failed on missing `.forma.md`.
- Existing `forma skills get forma-cli-core` could bootstrap read operations but did not provide enough configuration authoring guidance for empty workspace setup.

GREEN validation evidence:

- `cargo test -p forma-core docs::tests`: passed.
- `cargo test -p forma-cli`: passed.
- `cargo test -p forma-rpc`: passed.
- Temporary empty workspace smoke:
    - `forma init --name "Acme Knowledge" --json`: passed.
    - `forma check --json`: passed.
    - `forma skills get forma-cli-core`: printed docs-backed Agent guidance including empty workspace setup boundaries.
    - `forma docs list --json`: returned embedded docs.
    - generated files were only `.forma.md` and `.agents/skills/forma-cli/SKILL.md`.
- Repository `forma check --json`: passed.
- Repository `forma workspace health --json`: passed.
- `CI=true mise run check`: passed.
- [[test-cases/forma-cli-docs-bootstrap]] records the docs-backed Agent bootstrap pressure suite.
- Manual pressure run against `/private/tmp/forma-pressure.JO0ol7`: wrong top-level `template` config failed as expected; guided `kind: term` + `taxonomy: spaces` config passed `config inspect`, `check`, `create`, `list`, and `inspect`; isolated-page health warnings cleared after adding explicit links.

## Open Questions

- Should `forma init` default workspace name come from the directory name instead of `"Untitled Forma Workspace"`?
- Should `forma init` include `currentUserId` runtime value by default, or wait until a member/profile concept exists?
- Should `forma docs get <id>` later integrate with clap help as `forma help <topic>`?
- Should a later interactive or force-enabled `forma init` add an explicit confirmation flag, or is the current non-overwriting bootstrap enough for internal use?
