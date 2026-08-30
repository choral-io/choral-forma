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
    - "tasks/generalize-task-specific-read-operations"
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
2. Wrong assumption baseline: try a naive content group config that treats `space` as an intrinsic object or puts `template` at the top level; confirm `check` reports the expected diagnostic.
3. Guided first content group: load `forma-cli-core` and `forma-workspace-bootstrap`; use `workspace.first-slice-config` and further references as needed to define a `notes` content group and template.
4. First content write: create notes, list the `notes` content group, inspect one note, and render a configured notes view.
5. Health interpretation: observe isolated-page health warnings before links exist; add explicit links and confirm health passes.
6. Scenario-driven design: given a human request such as "I run a small consulting practice and need to track clients, engagements, meeting notes, and decisions", the Agent clarifies missing requirements and proposes only the first slice instead of building a full taxonomy immediately.
7. Domain-language mapping: for the accepted first slice, the Agent maps human terms to a configured space, schema fields, template inputs, and optional guideline without using `notes`, `tasks`, `members`, or `project` unless the human chose those terms.

## Steps

1. Run `forma init --name "Zero Start Knowledge" --json` against an empty directory.
2. Run `forma skills get forma-cli-core`.
3. Confirm the built-in skill tells the Agent to load relevant embedded docs before authoring the first content group.
4. Run `forma skills get forma-workspace-bootstrap` and `forma docs get workspace.first-slice-config`; load schema, template, view, or full configuration references as needed for the accepted slice.
5. Confirm bootstrap guidance reuses accepted requirements and approval, clarifies unresolved choices, and keeps proposed writes within the accepted scope.
6. For the baseline scenario, write an intentionally wrong config and confirm `forma check --json` reports the expected diagnostic.
7. For the guided scenario, define a taxonomy with `projection: contentGroups`, a `kind: term` + `taxonomy: spaces` node, and a template referenced by `create.template`.
8. Run `forma config summary --json` and confirm the resolved config reports the expected entry under `contentGroups`. Use `config inspect --json` only if the summary is insufficient or authored configuration needs debugging.
9. Run `forma check --json`.
10. Preview creation with `forma create notes --input ... --preview --json`, then create the two approved notes without `--preview`.
11. Run `forma list --space notes --json`, `forma inspect notes/first-note.md --json`, and `forma view render .forma/views/notes --json`.
12. Run `forma workspace health --json` before links exist and record isolated-page warnings as relationship feedback.
13. Add links between the notes and rerun `forma workspace health --json`.
14. For the scenario-driven design case, require an accepted first-slice scope and verification path before adding content groups or supporting files.

## Expected Results

- `forma init` creates only `.forma.md` and `.agents/skills/forma-cli/SKILL.md`.
- The Agent does not assume `notes`, `tasks`, `members`, or `space` are built-in domain concepts.
- The wrong config reports `config.unknownNodeKind`; a warning still counts as detecting the unsupported node, even when the command exits successfully.
- The Agent clarifies missing requirements and implements only an approved first slice without asking again about settled choices.
- The Agent maps human domain language to Forma artifacts without presenting `task`, `member`, `note`, or `project` as built-ins.
- The guided content group appears under `contentGroups` in `config summary`.
- `check`, `create`, `list`, `inspect`, and `view render` pass for the guided content group.
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

### 2026-06-27 Generic View Render Run

Temporary workspace: `/private/tmp/forma-empty-workspace.SJQISD`.

Scenario observations:

- `forma init --name "Scenario Workspace" --json`: passed and wrote only `.forma.md` plus `.agents/skills/forma-cli/SKILL.md`.
- Added one guideline, one `notes` space, one note template, one table view, and one sample note using only files included from `.forma.md`.
- `forma check --json`: passed.
- `forma skills list --json`: passed and discovered the built-in `forma-cli-core` skill plus the workspace guideline skill.
- `forma list --space notes --json`: passed and returned `notes/first-note.md`.
- `forma inspect notes/first-note.md --json`: passed and returned the space guideline.
- `forma view render .forma/views/notes --json`: passed and returned a table projection for the notes view.
- `forma workspace health --json` reported isolated-page relationship warnings for the single note. This is acceptable first-slice feedback, not a failed bootstrap.

### 2026-06-29 No-Example Grant Applications Run

Temporary workspace: `/private/tmp/forma-no-example-phase1.JfWlhJ`.

Scenario observations:

- `forma init --name "Grant Applications" --json`: passed and wrote only `.forma.md` plus `.agents/skills/forma-cli/SKILL.md`.
- The first slice was modeled as a single `applications` space with `title`, `summary`, `sponsor`, `status`, `dueDate`, `amountRequested`, and `tags` fields.
- Funder records, investigators, budget documents, and compliance reviews were explicitly deferred as relationships instead of modeled as first-slice spaces.
- The config used `kind: taxonomy`, `kind: term`, `taxonomy: spaces`, and `create.template`; `forma config inspect --json` passed and reported `spaces.applications`.
- `forma check --json`: passed after correct config and sample content.
- `forma create applications ... --json`: passed for two sample application records.
- `forma list --space applications --json`: passed and returned both records.
- `forma inspect applications/stem-outreach-expansion.md --json`: passed and returned the configured metadata.
- `forma workspace health --json` initially reported isolated-page warnings.
- After adding explicit Markdown links between the two application records, `forma workspace health --json`: passed.
- A deliberately wrong config using `kind: space` and top-level `template` now reports `config.unknownNodeKind` with `status: warning`.
- No example workspace content was loaded or copied.

Context budget evidence:

```text
122  skills/forma-cli/SKILL.md
477  docs/agents/forma-cli-core.md
1027 docs/agents/workspace-bootstrap.md
```
