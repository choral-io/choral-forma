---
schemaVersion: 1
kind: planning
title: No-Example Workspace Bootstrap Phase 1 Plan
summary: Make Forma capable of guiding Human and Agent users from an initialized empty workspace to a usable first content system without relying on examples.
scope: project
type: plan
owners:
    - "members/tiscs"
tags:
    - forma
    - agents
    - bootstrap
    - workspace-design
    - context-pressure
sources:
    - "planning/forma-cli-knowledge-workflow-replacement-validation"
    - "planning/project-knowledge-space-alignment-plan"
    - "test-cases/forma-cli-docs-bootstrap"
    - "test-cases/docs-backed-agent-bootstrap-pressure"
    - "test-cases/scenario-driven-workspace-bootstrap-pressure"
    - "test-cases/forma-cli-skill-context-budget-pressure"
    - "guidelines/forma-workspace-operations"
    - "guidelines/content-maintenance"
---

# No-Example Workspace Bootstrap Phase 1 Plan

## Goal

Phase 1 should prove that Forma can guide a Human and an Agent from an initialized empty workspace to one useful content system without copying an example workspace or assuming this repository's product R&D model.

The default path must be:

1. initialize minimal Forma files;
2. discover the Human's first durable content workflow;
3. translate that workflow into one configured space, one template, and optional first guideline or view;
4. create and verify one or two entries;
5. explain health diagnostics in the Human's domain language.

Examples can remain available for later acceleration, but Phase 1 success must not depend on loading or copying them.

## Current Gap

The current foundation is close but still thin for first-time Human and Agent users:

- `forma-cli-core` is useful as a command router, but it cannot carry the detailed design workflow without becoming too large.
- `agents.workspace-bootstrap` contains the first-slice flow, but it mixes workflow guidance with a worked example and is not yet treated as the primary no-example contract.
- Existing pressure tests cover docs-backed bootstrap and skill context budgets, but the evaluation criteria are not yet wired into a concrete implementation sequence.
- Product-facing docs and Agent-facing skills can easily grow until simple operations load too much context.

## Operating Principles

- No examples in the Phase 1 default path. Examples are learning references or Phase 2 accelerators, not Phase 1 inputs.
- First slice before full taxonomy. A usable first workspace can be one configured space, one template, and two entries.
- Human language first, Forma config second. The Agent should restate the content group, fields, relationships, and verification path before editing config.
- Skills route, docs explain. `forma-cli-core` should stay short and route Agents to the detailed doc only when empty-workspace setup or config authoring is actually requested.
- Context pressure is a product constraint. Any change to docs, skills, init output, or embedded guidance must record what an Agent has to load and whether that loaded set is still acceptable.

## Usable Standard

Phase 1 is usable when a Human and Agent can complete this flow without examples:

1. The Human describes a real domain in ordinary language, such as research notes, customer records, service runbooks, grant applications, or writing drafts.
2. The Agent asks enough short questions to choose one first content group.
3. The Agent proposes a first-slice dry run with:
    - space id and title;
    - directory and include pattern;
    - required and optional fields;
    - relationship fields, or a decision to defer them;
    - template path and input values;
    - optional guideline or view;
    - files to create;
    - verification commands.
4. After approval, the Agent creates the minimal config and content files.
5. `config inspect`, `check`, `create`, `list`, `inspect`, and `workspace health` provide understandable evidence.
6. Isolated-page health warnings are explained as relationship feedback unless the Human expected a connected graph.

## Context Pressure Budget

The implementation should keep the Agent's loaded context layered:

| Layer | Purpose | Budget Target |
| --- | --- | --- |
| Project-local `skills/forma-cli/SKILL.md` | Repo-specific command entrypoint and trust boundary | Short enough to load on every Forma task |
| Built-in `forma-cli-core` | Required bootstrap checks and routing | Short router; no long examples |
| `agents.workspace-bootstrap` | Empty-workspace first-slice workflow | Detailed enough to execute, but still a single focused workflow doc |
| Workspace reference docs | Configuration, spaces, schemas, templates, views, guidelines | Loaded only when the specific artifact is being authored |
| Examples | Learning reference or fast-start material | Not loaded in Phase 1 default path |

Every Phase 1 edit that touches Agent-facing guidance must record:

- which skill and doc pages an Agent must load for the target workflow;
- whether ordinary read-only workspace operations avoid bootstrap docs;
- approximate word counts for changed Agent-facing docs;
- whether any worked example should move behind an explicit reference boundary.

## Implementation Slices

### Slice 1: Make The No-Example Contract Explicit

Files:

- `docs/agents/forma-cli-core.md`
- `docs/agents/workspace-bootstrap.md`
- `knowledge/test-cases/forma-cli-docs-bootstrap.md`

Steps:

1. State that no-example bootstrap is the default for empty workspace setup.
2. Keep `forma-cli-core` as a router: bootstrap checks, docs to load, trust boundary, and no embedded worked example.
3. Make `agents.workspace-bootstrap` the detailed no-example workflow contract.
4. Update the docs bootstrap evaluation suite so the no-example path is a named Phase 1 gate.
5. Record word counts for `skills/forma-cli/SKILL.md`, `docs/agents/forma-cli-core.md`, and `docs/agents/workspace-bootstrap.md`.

Done when:

- an Agent can identify the no-example path from `forma-cli-core`;
- ordinary health/read tasks still do not need `agents.workspace-bootstrap`;
- `forma-cli-skill-context-budget-pressure` remains valid.

### Slice 2: Add A First-Slice Dry-Run Format

Files:

- `docs/agents/workspace-bootstrap.md`
- `docs/workspace/spaces.md`
- `docs/workspace/templates.md`
- `docs/workspace/schemas.md`

Steps:

1. Add a compact first-slice proposal format to `agents.workspace-bootstrap`.
2. Require the proposal before shared config or content writes.
3. Include explicit deferral language for cross-space references until both sides exist.
4. Confirm reference docs describe the same `kind: taxonomy`, `kind: term`, `taxonomy: spaces`, and `create.template` model.
5. Keep large examples out of the default flow; if a worked example remains, label it as optional reference material.

Done when:

- the Agent can produce a dry run before edits;
- the dry run has enough detail for Human approval;
- the doc path does not require loading examples.

### Slice 3: Strengthen Human-Facing Post-Init Guidance

Files:

- `docs/cli/init.md`
- CLI init output implementation after locating the exact source file
- generated or embedded Agent runtime skill content, if the implementation owns it

Steps:

1. Inspect the current `forma init` output and generated files.
2. Add short next steps that point to the no-example first-slice path.
3. Avoid promising a full generator or prebuilt workspace model.
4. Keep the output concise enough that it does not duplicate `agents.workspace-bootstrap`.
5. Re-run init pressure checks in an empty temporary workspace.

Done when:

- `forma init` still creates only the minimal bootstrap files expected by the pressure tests;
- the next action is clear to a Human or Agent;
- init output does not become a second long bootstrap document.

### Slice 4: Rebalance Detailed Examples And References

Files:

- `docs/agents/workspace-bootstrap.md`
- optional new reference doc only if the current doc becomes too large
- `knowledge/test-cases/scenario-driven-workspace-bootstrap-pressure.md`

Steps:

1. Review whether the current worked first-slice example creates unnecessary context pressure.
2. If it does, move it behind an explicit optional reference boundary or separate reference doc.
3. Keep the default bootstrap doc focused on questions, translation pattern, dry-run format, and verification sequence.
4. Confirm scenario prompts still test generic domains instead of copying the example.

Done when:

- the default bootstrap doc remains executable without a long copied example;
- examples are discoverable only when the user asks to learn from examples or fast-start.

### Slice 5: Run The Phase 1 Pressure Gate

Files:

- `knowledge/test-cases/forma-cli-docs-bootstrap.md`
- `knowledge/test-cases/docs-backed-agent-bootstrap-pressure.md`
- `knowledge/test-cases/scenario-driven-workspace-bootstrap-pressure.md`
- `knowledge/test-cases/forma-cli-skill-context-budget-pressure.md`

Steps:

1. Run the ordinary read-only workspace scenario and confirm it loads only lightweight guidance.
2. Run a fresh empty-workspace bootstrap without examples.
3. Run a wrong-config baseline and confirm `check` catches the expected issue.
4. Run at least one scenario-driven domain that is not project management, notes, or this repository's product workflow.
5. Record commands, temporary paths, loaded docs, approximate word counts, diagnostics, and any docs changed as a result.

Done when:

- the Phase 1 path works without examples;
- context pressure is measured rather than assumed;
- failures produce concrete doc or CLI follow-up tasks.

## Verification Commands

Use the source-current CLI during implementation:

```sh
cargo run -q -p forma-cli -- skills get forma-cli-core
cargo run -q -p forma-cli -- docs get agents.workspace-bootstrap
cargo run -q -p forma-cli -- docs get agents.workspace-maintenance
cargo run -q -p forma-cli -- docs get workspace.configuration
cargo run -q -p forma-cli -- docs get workspace.spaces
cargo run -q -p forma-cli -- docs get workspace.schemas
cargo run -q -p forma-cli -- docs get workspace.templates
wc -w skills/forma-cli/SKILL.md docs/agents/forma-cli-core.md docs/agents/workspace-bootstrap.md
cargo run -q -p forma-cli -- check --json
cargo run -q -p forma-cli -- workspace health --json
```

If CLI init behavior, embedded docs, or generated runtime skill content changes, also run the docs-backed bootstrap pressure tests in a temporary empty workspace.

If Rust code or embedded-doc packaging changes, run:

```sh
cargo test -p forma-core
```

## Execution Notes

### 2026-06-29 Slice 1 And Slice 2 First Pass

Completed the first documentation pass for Slice 1 and Slice 2:

- `forma-cli-core` now names no-example bootstrap as the default empty-workspace path.
- `forma-cli-core` separates always-loaded checks, read-only commands, and config-authoring setup so ordinary health/read workflows do not load bootstrap docs.
- `agents.workspace-bootstrap` now includes a first-slice dry-run format before shared config or content writes.
- The worked first-slice example is reduced to an optional pattern reference instead of a long copyable default.
- `forma-cli-docs-bootstrap` is now explicitly the Phase 1 no-example bootstrap gate and records concrete context budget targets.

Current Agent-facing word-count baseline:

```text
122  skills/forma-cli/SKILL.md
477  docs/agents/forma-cli-core.md
1027 docs/agents/workspace-bootstrap.md
```

No `forma init` runtime behavior was changed in this pass. The current implementation already creates the minimal bootstrap files, so Slice 3 should start with docs and pressure evidence before touching Rust output or generated skill content.

### 2026-06-29 No-Example Pressure Run

Ran the Phase 1 path against a fresh temporary grant applications workspace without loading or copying examples.

Result:

- Happy path passed from `forma init` through first-slice config, two created entries, list, inspect, check, and workspace health.
- Initial isolated-page health warnings were expected relationship feedback and disappeared after adding explicit links.
- The pressure run exposed a runtime gap: an imported config node with `kind: space` and top-level `template` was silently ignored.
- Added `config.unknownNodeKind` diagnostics for unknown imported config node kinds, while preserving recognized `taxonomy`, `term`, `types`, and `view` nodes.
- Re-ran the wrong-config baseline and confirmed `forma check --json` now reports `config.unknownNodeKind` with `status: warning`.

Temporary workspace: `/private/tmp/forma-no-example-phase1.JfWlhJ`.

## Non-Goals

- Do not build a full workspace generator in Phase 1.
- Do not introduce a product-specific `task`, `member`, `note`, or `project` model.
- Do not make examples part of the default bootstrap path.
- Do not recreate the old `knowledge-workflow` skill family one-for-one.
- Do not add broad policy runtime before there is a concrete write-operation consumer.

## Acceptance Criteria

Phase 1 is complete when:

- a no-example bootstrap path is explicit in Agent-facing guidance;
- the first-slice dry-run format is documented and used before edits;
- `forma init` leaves the Human or Agent with a clear next action;
- the existing docs bootstrap pressure suite includes context pressure evidence;
- simple workspace read operations still avoid loading detailed bootstrap docs;
- examples remain optional accelerators rather than required inputs;
- repository `check` and `workspace health` pass after the content changes.

## Phase 1 Completion Gate

Phase 1 is complete when these evidence records exist and pass:

- no-example grant applications first-slice run;
- lab calibration discovery and first-slice run;
- wrong-config baseline reports `config.unknownNodeKind`;
- read-only context pressure test confirms ordinary health/read workflows do not load discovery, bootstrap, schema, template, or example docs;
- repository `check`, `workspace health`, and `cargo test -p forma-core` pass.

Phase 2 may start only after the no-example path remains usable without examples. Phase 2 examples are accelerators for humans who explicitly ask for a fast start, not dependencies of default workspace setup.

## Phase 2 Completion Gate

Phase 2 is complete when:

- no-example bootstrap remains the default path;
- workspace design discovery produces a design brief before first-slice config;
- examples are loaded only after explicit human request or accepted no-example design brief;
- example-assisted flows require a dry run before writing files;
- ordinary read or health workflows load only the project-local skill and `forma-cli-core`;
- first-slice bootstrap uses the short `workspace.first-slice-config` reference by default;
- context budget evidence is recorded for core, discovery, bootstrap, first-slice config, and accelerator docs;
- `cargo test -p forma-core`, `forma check --json`, and `forma workspace health --json` pass.

## Follow-Up

After Phase 1 passes, Phase 2 can decide how examples should accelerate setup without becoming the default source of truth. That later work can include example selection, copy/adapt flows, and starter workspaces, but only after the no-example baseline is proven usable.
