---
scope: project
type: planning
title: Project Knowledge Space Alignment Plan
summary: Align the Choral Forma project workspace with the software product R&D workspace model while keeping product knowledge under knowledge/.
owners:
    - "members/tiscs"
tags:
    - forma
    - knowledge
    - migration
    - workspace-alignment
sources:
    - "planning/repository-knowledge-content-migration-report"
    - "guidelines/forma-workspace-operations"
    - "guidelines/content-maintenance"
---

# Project Knowledge Space Alignment Plan

## Purpose

This plan adapts the software product R&D workspace model back into the Choral Forma project workspace without copying the example template one-to-one.

Choral Forma is a mixed product-knowledge and product-code repository. Product facts, research, decisions, planning, release evidence, task state, and Agent operating guidance should remain under `knowledge/`. Product-facing documentation may still live under `docs/`, and implementation remains under `crates/` and `packages/`.

## Target Shape

The target project workspace should keep these canonical spaces:

- `knowledge/product/` for product direction, scope, and behavior.
- `knowledge/research/` for discovery evidence, user feedback, competitive notes, and product insights.
- `knowledge/concepts/` for durable vocabulary and product abstractions.
- `knowledge/architecture/` for technical direction, contracts, and system design.
- `knowledge/design/` for UX, interaction, and product surface design.
- `knowledge/decisions/` for accepted product, architecture, and workflow tradeoffs.
- `knowledge/user-stories/` for actor and workflow stories that connect product intent to delivery.
- `knowledge/tasks/` for delivery work and board state.
- `knowledge/validation/` for acceptance cases, pressure tests, release checks, and verification evidence.
- `knowledge/releases/` for release scope, rollout records, and cutline evidence.
- `knowledge/metrics/` for product, quality, and delivery readiness signals.
- `knowledge/experiments/` for hypothesis-driven product or workflow learning loops.
- `knowledge/proposals/` for reviewable content, task, decision, and operation proposals before canonical conversion.
- `knowledge/planning/` for roadmaps, migration plans, audits, and temporary planning reports.
- `knowledge/guidelines/` for Human and Agent operating guidance.
- `knowledge/members/` for shared member records.
- `knowledge/workspace/` for shared member workspace entry pages and explicitly non-canonical support material.

## Current Gaps

The current Forma project workspace already covers most product R&D spaces, but two naming and flow gaps remain:

- `knowledge/discovery/` should become `knowledge/research/` because the content is product research and discovery evidence.
- `knowledge/test-cases/` should become `knowledge/validation/` because the content now includes acceptance checks, pressure validation, release evidence, and Agent workflow verification.

The current guidelines also need to reflect the evidence flow used by the product R&D example:

`research -> product/user-stories -> design/architecture -> tasks -> validation/metrics -> releases/decisions`

## Non-Goals

- Do not move product knowledge outside `knowledge/`.
- Do not make `docs/` the canonical product knowledge workspace.
- Do not treat `.forma/local/` as a knowledge-content location; it is only for local Forma configuration or machine-specific overrides.
- Do not delete `planning/` or `proposals/`; they are useful for this project even though they are not part of the minimal product R&D example.
- Do not mechanically rename files before `.forma` config, types, templates, and references are ready.

## Migration Slices

### Slice 1: Guideline Alignment

Update repository guidelines before moving files or changing active spaces:

- Add `research/` and `validation/` placement rules to `knowledge/guidelines/forma-workspace-operations.md`.
- Update `knowledge/guidelines/content-maintenance.md` target selection language from `discovery` and `test case` toward `research` and `validation`.
- Keep `planning/` and `proposals/` project-specific, with clear boundaries from `tasks/`, `releases/`, and canonical product records.
- Clarify that `.forma/local/` is local configuration only, while local notes and private drafts stay outside shared knowledge unless approved for promotion.
- State that the renamed spaces are the target model until the directory migrations complete, so Humans and Agents do not treat temporary old path names as product concepts.

Verification gate:

- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`

### Slice 2: Discovery To Research Atomic Migration

Move the discovery space in one narrow batch instead of creating a temporary duplicate space:

- Move `.forma/spaces/discovery.md` to `.forma/spaces/research.md`.
- Move `knowledge/discovery/**` to `knowledge/research/**`.
- Update the space title, description, include patterns, create directory, template references, and display order as needed.
- Add a `research` entryRef type if relationship fields need a typed reference.
- Update active guidelines and planning references that mention the old discovery space.

Verification gate:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- Targeted `rg` checks for active `knowledge/discovery` and `Discovery` path/config references.

### Slice 3: Test Cases To Validation Atomic Migration

Move the test-case space in one narrow batch because releases, user stories, templates, and entryRef types all depend on the same terminology:

- Move `.forma/spaces/test-cases.md` to `.forma/spaces/validation.md`.
- Move `.forma/spaces/templates/test-case.md` to `.forma/spaces/templates/validation.md` or another explicit validation template name.
- Move `knowledge/test-cases/**` to `knowledge/validation/**`.
- Replace the `test-case` entryRef type with a `validation` entryRef type.
- Replace `relatedTestCases` fields with `relatedValidation` where the relationship means broader validation evidence.
- Update releases, user stories, metrics, experiments, tasks, templates, and current guidelines in the same slice.
- Preserve file names unless a file-specific rename has clear product value.
- Audit existing dirty `knowledge/test-cases/**` changes before this slice starts, because there are already local modifications in that tree.

Verification gate:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- Targeted `rg` checks for active `knowledge/test-cases`, `test-case`, and `relatedTestCases` references.

### Slice 4: Reference Cleanup

Clean product wording and durable relationships after paths are stable:

- Update release, task, metric, experiment, and user-story relationship fields to use `validation` terminology.
- Keep historical prose that intentionally refers to old starter-kit or validation-suite names, but avoid old path references in active config and current operating guidance.
- Update planning reports only where old names would mislead current users or Agents.

Verification gate:

- `cargo run -q -p forma-cli -- check --json`
- `cargo run -q -p forma-cli -- workspace health --json`
- `cargo run -q -p forma-cli -- view render .forma/views/task-board --json`

## Acceptance Criteria

- Current project knowledge remains under `knowledge/`.
- `research` and `validation` are the active names in Forma config, templates, guidelines, and new content.
- `planning` remains for plans, audits, migration reports, and roadmaps.
- `proposals` remains for reviewable changes before canonical conversion.
- Shared project content does not link to `.forma/local/` or member local-only paths.
- Forma check and workspace health pass after each migration slice.
