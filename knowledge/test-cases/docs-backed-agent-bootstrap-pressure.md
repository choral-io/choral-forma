---
schemaVersion: 1
kind: test-case
title: Docs Backed Agent Bootstrap Pressure
summary: Pressure test that Forma CLI embedded docs and skills can guide an Agent from an empty project to a valid first content group.
scope: project
type: pressure
status: draft
priority: P0
automation: manual-agent
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

# Docs Backed Agent Bootstrap Pressure

## Purpose

Validate that the project-local `forma-cli` skill, built-in `forma-cli-core` skill, and embedded product docs can guide an Agent from an empty project to a valid first content group without relying on starter-kit assumptions or built-in domain concepts.

## Preconditions

- The Agent has access to the project-local `forma-cli` skill.
- The target directory starts empty.
- The Agent can run `forma` or the project-local equivalent `cargo run -q -p forma-cli --`.

## Test Data

Run these scenarios separately:

1. Empty bootstrap: initialize an empty directory and inspect the generated files.
2. Wrong assumption baseline: try a naive content group config that treats `space` as an intrinsic object or puts `template` at the top level; confirm `check` catches the error.
3. Guided first content group: load `forma-cli-core`, then `workspace.configuration`, `workspace.spaces`, `workspace.templates`, and `agents.workspace-bootstrap`; define a `notes` content group and template from those docs.
4. First content write: create two notes, list the `notes` content group, and inspect one note.
5. Health interpretation: observe isolated-page health warnings before links exist; add explicit links and confirm health passes.

## Steps

1. Run `forma init --name "Zero Start Knowledge" --json` against an empty directory.
2. Run `forma skills get forma-cli-core`.
3. Confirm the built-in skill tells the Agent to load relevant embedded docs before authoring the first content group.
4. Run `forma docs get workspace.configuration`, `forma docs get workspace.spaces`, `forma docs get workspace.templates`, and `forma docs get agents.workspace-bootstrap`.
5. For the baseline scenario, write an intentionally wrong config and confirm `forma check --json` fails for the expected reason.
6. For the guided scenario, write a `kind: term` + `taxonomy: spaces` config node and a template referenced by `create.template`.
7. Run `forma config inspect --json` and confirm the effective config reports the expected entry under `spaces`.
8. Run `forma check --json`.
9. Create two notes with `forma create notes --input ... --json`.
10. Run `forma list --space notes --json` and `forma inspect notes/first-note.md --json`.
11. Run `forma knowledge health --json` before links exist and record isolated-page warnings as relationship feedback.
12. Add links between the notes and rerun `forma knowledge health --json`.

## Expected Results

- `forma init` creates only `.forma.yml` and `.agents/skills/forma-cli/SKILL.md`.
- The Agent does not assume `notes`, `tasks`, `members`, or `space` are built-in domain concepts.
- The wrong config fails clearly, proving the pressure scenario catches the previous top-level `template` mistake.
- The guided content group appears under `spaces` in `config inspect`.
- `check`, `create`, `list`, and `inspect` pass for the guided content group.
- Isolated-page `knowledge health` warnings are treated as relationship feedback, not failed bootstrap.
- After adding explicit links, `knowledge health` passes.

## Evidence Or Execution Notes

Record the temporary workspace path, commands run, failure messages, verification output, and any docs or skill changes made in response.

### 2026-06-27 Manual Run

Temporary workspace: `/private/tmp/forma-pressure.JO0ol7`.

Baseline and pressure observations:

- `forma init --name "Zero Start Knowledge" --json`: passed and wrote only `.forma.yml` plus `.agents/skills/forma-cli/SKILL.md`.
- Generated `forma-cli-core` guidance told the Agent to load `workspace.configuration`, `workspace.spaces`, `workspace.templates`, and `agents.workspace-bootstrap` before authoring the first content group.
- A deliberately wrong config using `kind: space`, `id: notes`, and top-level `template` failed `forma check --json` with `config.parseFailed` and `missing field template`, proving the scenario catches the previous mistaken model.
- The guided config using `kind: term`, `taxonomy: spaces`, and `create.template` passed `config inspect --json` and appeared under `spaces.notes`.
- `forma check --json`: passed.
- `forma create notes ... --json`: passed for two notes.
- `forma list --space notes --json`: passed and returned both notes.
- `forma inspect notes/first-note.md --json`: passed.
- `forma knowledge health --json` before links reported isolated-page warnings.
- After adding explicit links between the two notes, `forma knowledge health --json`: passed.

Docs changes made during this run:

- `docs/agents/forma-cli-core.md` now points Agents to the embedded docs needed before authoring the first content group.
- `docs/agents/workspace-bootstrap.md` now includes the step-by-step first content category workflow and isolated-page warning interpretation.
- `docs/workspace/templates.md` now describes templates as `create.template` on a configured content group instead of as a built-in space mechanism.
