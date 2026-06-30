---
schemaVersion: 1
kind: test-case
title: Forma CLI Docs Bootstrap Evaluation Suite
summary: Test suite for validating docs-backed Forma CLI and Agent bootstrap from an empty project.
scope: project
type: suite
status: active
priority: P0
automation: mixed
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - docs
    - agent
    - bootstrap
coversUserStories:
    - "user-stories/agent-maintains-project-knowledge"
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
---

# Forma CLI Docs Bootstrap Evaluation Suite

## Purpose

Validate that Forma CLI, embedded product docs, and Agent-facing skill output can guide Human and Agent collaboration from an empty project to a valid first content workflow.

## Pressure Tests

- [[test-cases/docs-backed-agent-bootstrap-pressure]]
- [[test-cases/scenario-driven-workspace-bootstrap-pressure]]
- [[test-cases/forma-cli-skill-context-budget-pressure]]
- [[test-cases/workspace-design-discovery-pressure]]

## Gate Usage

This suite is the Phase 1 no-example bootstrap gate. It should prove that an Agent can start from an empty initialized workspace, design one first content slice from human domain language, and verify it without loading or copying examples.

Run this suite before considering changes ready for review when the change affects:

- `docs/agents/**`;
- `docs/workspace/**` pages used by empty-workspace setup;
- `forma skills` output or embedded skill projection;
- `forma init` output or generated Agent runtime skill content.

Minimum evidence:

- wrong-config baseline reports the expected diagnostic;
- guided `kind: term` + `taxonomy: spaces` content group setup passes;
- scenario-driven bootstrap asks clarifying questions and implements only the first confirmed slice;
- ordinary workspace operations load the lightweight Skill and core guide without pulling all bootstrap docs into context;
- `check`, `create`, `list`, `inspect`, and `view render` pass for the guided content group;
- isolated-page health warnings are reported as relationship feedback and can be cleared by adding explicit links.
- context pressure evidence records the loaded skills/docs and approximate word counts for Agent-facing guidance.

Context budget targets:

- project-local `skills/forma-cli/SKILL.md` stays under 200 words;
- `forma-cli-core` stays under 500 words and contains no worked examples;
- `agents.workspace-design-discovery` stays under 900 words unless a split reference doc is introduced;
- `agents.workspace-bootstrap` stays under 1,100 words unless a split reference doc is introduced;
- ordinary read or health workflows load only the project-local skill and `forma-cli-core`.

## Evaluation Boundary

- Focus on docs-backed bootstrap from empty projects.
- Do not require `examples/getting-started-workspace` or this repository's project knowledge structure.
- Treat configured content groups as user-defined patterns, not built-in Forma domain objects.
- Treat Skill context as a budget. Keep the project-local Skill and built-in core guide as routers; load detailed docs only for matching workflows.

## Evidence Or Execution Notes

### 2026-06-29 No-Example Grant Applications Run

Temporary workspace: `/private/tmp/forma-no-example-phase1.JfWlhJ`.

Scenario:

- Human domain: grant application tracking.
- First slice: `applications`.
- Deferred relationships: funder records, investigators, budget documents, and compliance reviews.
- Examples were not loaded or copied.

Loaded guidance:

- `skills/forma-cli/SKILL.md`
- `forma skills get forma-cli-core`
- `forma docs get agents.workspace-bootstrap`
- `forma docs get workspace.configuration`
- `forma docs get workspace.spaces`
- `forma docs get workspace.schemas`
- `forma docs get workspace.templates`

Context budget evidence:

```text
122  skills/forma-cli/SKILL.md
477  docs/agents/forma-cli-core.md
1027 docs/agents/workspace-bootstrap.md
```

Verification results:

- `forma init --name "Grant Applications" --json`: passed and wrote only `.forma.md` plus `.agents/skills/forma-cli/SKILL.md`.
- `forma skills list --json`: passed and returned only the built-in `forma-cli-core` skill.
- `forma config inspect --json`: passed after correct config and reported `spaces.applications`.
- `forma check --json`: passed after correct config and sample content.
- `forma create applications ... --json`: passed for two application entries.
- `forma list --space applications --json`: passed and returned both entries.
- `forma inspect applications/stem-outreach-expansion.md --json`: passed and returned the configured metadata.
- `forma workspace health --json`: initially reported isolated-page warnings, which matched the expected first-slice relationship feedback.
- After adding explicit links between the two applications, `forma workspace health --json`: passed.

Wrong-config baseline:

- A deliberately wrong imported config node using `kind: space` and top-level `template` originally passed silently during the pressure run.
- Runtime diagnostics were updated so the same baseline now reports `config.unknownNodeKind` with `status: warning` and expected kinds `taxonomy, term, types, or view`.

Execution note:

- A shell quoting issue turned `--input amountRequested="$75000"` into an empty value because `$75000` was expanded by the shell. The temporary sample files were corrected manually. Future command examples that include dollar amounts should quote or escape `$` carefully.
