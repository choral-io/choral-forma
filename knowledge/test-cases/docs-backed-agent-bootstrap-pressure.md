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

Validate that the project-local `forma-cli` skill, built-in `forma-cli-core` skill, and embedded product docs can guide an Agent from an empty project and a human business description to a valid first content workflow without relying on starter-kit assumptions or built-in domain concepts.

## Preconditions

- The Agent has access to the project-local `forma-cli` skill.
- The target directory starts empty.
- The Agent can run `forma` or the project-local equivalent `cargo run -q -p forma-cli --`.

## Test Data

Run these scenarios separately:

1. Empty bootstrap: initialize an empty directory and inspect the generated files.
2. Wrong assumption baseline: try a naive content group config that treats `space` as an intrinsic object or puts `template` at the top level; confirm `check` catches the error.
3. Guided first content group: load `forma-cli-core`, then `workspace.configuration`, `workspace.spaces`, `workspace.schemas`, `workspace.templates`, and `agents.workspace-bootstrap`; define a `notes` content group and template from those docs.
4. First content write: create two notes, list the `notes` content group, and inspect one note.
5. Health interpretation: observe isolated-page health warnings before links exist; add explicit links and confirm health passes.
6. Scenario-driven design: given a human request such as "I run a small consulting practice and need to track clients, engagements, meeting notes, and decisions", the Agent asks clarifying questions and proposes only the first slice instead of building a full taxonomy immediately.
7. Domain-language mapping: for the accepted first slice, the Agent maps human terms to a configured space, schema fields, template inputs, and optional guideline without using `notes`, `tasks`, `members`, or `project` unless the human chose those terms.

## Steps

1. Run `forma init --name "Zero Start Knowledge" --json` against an empty directory.
2. Run `forma skills get forma-cli-core`.
3. Confirm the built-in skill tells the Agent to load relevant embedded docs before authoring the first content group.
4. Run `forma docs get workspace.configuration`, `forma docs get workspace.spaces`, `forma docs get workspace.schemas`, `forma docs get workspace.templates`, and `forma docs get agents.workspace-bootstrap`.
5. Confirm `agents.workspace-bootstrap` asks for real examples, useful fields, relationships, operating rules, and local/private boundaries before writing config.
6. For the baseline scenario, write an intentionally wrong config and confirm `forma check --json` fails for the expected reason.
7. For the guided scenario, write a `kind: term` + `taxonomy: spaces` config node and a template referenced by `create.template`.
8. Run `forma config inspect --json` and confirm the effective config reports the expected entry under `spaces`.
9. Run `forma check --json`.
10. Create two notes with `forma create notes --input ... --json`.
11. Run `forma list --space notes --json` and `forma inspect notes/first-note.md --json`.
12. Run `forma workspace health --json` before links exist and record isolated-page warnings as relationship feedback.
13. Add links between the notes and rerun `forma workspace health --json`.
14. For the scenario-driven design case, require the Agent to propose one first content group, one template, and one verification path before adding additional spaces.

## Expected Results

- `forma init` creates only `.forma.md` and `.agents/skills/forma-cli/SKILL.md`.
- The Agent does not assume `notes`, `tasks`, `members`, or `space` are built-in domain concepts.
- The wrong config fails clearly, proving the pressure scenario catches the previous top-level `template` mistake.
- The Agent asks clarifying questions and confirms the first slice before writing config.
- The Agent maps human domain language to Forma artifacts without presenting `task`, `member`, `note`, or `project` as built-ins.
- The guided content group appears under `spaces` in `config inspect`.
- `check`, `create`, `list`, and `inspect` pass for the guided content group.
- Isolated-page `workspace health` warnings are treated as relationship feedback, not failed bootstrap.
- After adding explicit links, `workspace health` passes.

## Evidence Or Execution Notes

Record the temporary workspace path, commands run, failure messages, verification output, and any docs or skill changes made in response.

### 2026-06-27 Manual Run

Temporary workspace: `/private/tmp/forma-pressure.JO0ol7`.

Baseline and pressure observations:

- `forma init --name "Zero Start Knowledge" --json`: passed and wrote only `.forma.md` plus `.agents/skills/forma-cli/SKILL.md`.
- Generated `forma-cli-core` guidance told the Agent to load `workspace.configuration`, `workspace.spaces`, `workspace.schemas`, `workspace.templates`, and `agents.workspace-bootstrap` before authoring the first content group.

### 2026-06-27 Scenario Mapping Run

Temporary workspace: `/private/tmp/forma-bootstrap-pressure.9ci4aa`.

Scenario observations:

- `forma init --name "Consulting Workspace" --json`: passed and wrote only `.forma.md` plus `.agents/skills/forma-cli/SKILL.md`.
- The consulting-practice first slice was modeled as a single `clients` space with `name`, `summary`, `status`, `primaryContact`, and `tags` fields.
- The config used `kind: term`, `taxonomy: spaces`, and `create.template`; `forma config inspect --json` passed and reported `spaces.clients`.
- `forma check --json`: passed.
- `forma create clients ... --json`: passed for two sample clients.
- `forma list --space clients --json`: passed and returned both sample clients.
- `forma inspect clients/acme-clinic.md --json`: passed.
- `forma workspace health --json` reported isolated-page relationship warnings, which are acceptable for this first disconnected slice.
- A deliberately wrong config using `kind: space`, `id: notes`, and top-level `template` failed `forma check --json` with `config.parseFailed` and `missing field template`, proving the scenario catches the previous mistaken model.
- The guided config using `kind: term`, `taxonomy: spaces`, and `create.template` passed `config inspect --json` and appeared under `spaces.notes`.
- `forma check --json`: passed.
- `forma create notes ... --json`: passed for two notes.
- `forma list --space notes --json`: passed and returned both notes.
- `forma inspect notes/first-note.md --json`: passed.
- `forma workspace health --json` before links reported isolated-page warnings.
- After adding explicit links between the two notes, `forma workspace health --json`: passed.

Docs changes made during this run:

- `docs/agents/forma-cli-core.md` now points Agents to the embedded docs needed before authoring the first content group.
- `docs/agents/workspace-bootstrap.md` now includes the step-by-step first content category workflow and isolated-page warning interpretation.
- `docs/workspace/templates.md` now describes templates as `create.template` on a configured content group instead of as a built-in space mechanism.
