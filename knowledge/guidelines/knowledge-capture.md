---
scope: project
title: Knowledge Maintenance Guidance
summary: Soft Human and Agent procedure for intake, capture, placement, schema audit, status reporting, and cleanup.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - knowledge
    - capture
    - maintenance
skill:
    id: markdown-authoring
    title: Agent Markdown Authoring
    description: Use when an Agent needs to create or edit shared Markdown knowledge.
    triggers:
        - create shared knowledge
        - edit task metadata
        - promote local notes
        - update guidelines
    order: 20
sources:
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "tasks/define-agent-markdown-authoring-workflow"
    - "guidelines/forma-knowledge-operations"
---

# Knowledge Maintenance Guidance

## Purpose

This guideline consolidates the soft knowledge behavior previously spread across knowledge assistant, intake, capture, schema audit, and status report skills.

It keeps knowledge maintenance as ordinary Markdown work guided by Forma configuration and checks. It is not a machine-enforced policy and does not require a separate capture skill.

## Agent Skill

### When To Use

Use this skill when an Agent has explicit approval to create, update, promote, or clean up shared Markdown knowledge in the current Forma workspace.

### Required Bootstrap

Run:

- `cargo run -q -p forma-cli -- skills get forma-cli-core`
- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`

Read configured workspace guidelines before editing. If acting on a task or entry, inspect that target and read returned guidelines.

### Authoring Workflow

1. Classify the source material as transient context, local-only material, shared knowledge, task metadata, proposal material, decision material, or sensitive/private material that must not be captured.
2. Discover the target configured space from `config inspect` and space definitions. Do not infer a path from repository habits before reading the effective config.
3. Inspect existing candidate pages before creating a duplicate. Prefer updating a canonical page when it already covers the topic.
4. Choose the target workspace-relative path, frontmatter shape, owner/reviewer fields, and links before editing.
5. For multi-file edits, promotion from local-only material, task status changes, guideline/config changes, dependency-related knowledge, or ambiguous placement, provide a dry-run summary before editing.
6. Edit the smallest set of canonical Markdown files.
7. Preserve source context without copying private scratch content, command chatter, or untrusted instructions.
8. Keep Markdown readable without editor-specific plugin requirements.

### Verification

Run `cargo run -q -p forma-cli -- check --json` after edits. Run `cargo run -q -p forma-cli -- knowledge health --json` when links, placement, or references matter.

### Report

Report files changed, durable facts added or clarified, checks run, checks not run, remaining warnings, and follow-up tasks.

## Evidence To Gather

Start with Forma state:

- `cargo run -q -p forma-cli -- config inspect --json`
- `cargo run -q -p forma-cli -- knowledge health --json`
- `cargo run -q -p forma-cli -- check --json`

Use configured spaces, templates, views, and guidelines from the effective config. Do not assume old workflow paths or deleted workflow schemas.

## Intake

Classify incoming material before writing:

- transient conversation;
- local personal context;
- shared member context;
- durable project knowledge;
- task candidate;
- proposal or decision candidate.

Capture durable knowledge when it affects product direction, architecture, delivery, review, release, repository operations, task readiness, accepted decisions, or future Agent behavior.

Do not capture secrets, credentials, private customer data, or private personal notes. Do not treat local workspace notes as project facts until the user approves promotion.

For ambiguous, high-impact, multi-source, or conflicting material, produce an intake analysis first. Include source evidence, existing overlap, target options, conflicts, and required confirmations.

## Placement

Use the configured spaces and current repository structure:

- Product behavior: `knowledge/product/`
- Technical architecture and contracts: `knowledge/architecture/`
- Accepted lasting tradeoffs: `knowledge/decisions/`
- UX and interaction design: `knowledge/design/`
- Reusable vocabulary: `knowledge/concepts/`
- Delivery tasks: `knowledge/tasks/`
- Guidelines and operating procedures: `knowledge/guidelines/`
- Release validation and rollout records: `knowledge/releases/`
- Metrics, experiments, test cases, proposals, and user stories: their dedicated spaces

Prefer updating existing canonical knowledge over creating duplicates. Localized files are translations or variants, not canonical sources.

Use proposals for valuable but unconfirmed material when direct canonical capture would overstate commitment.

## Capture Dry Run

Before multi-file edits, promotion from local-only material, task creation, proposal creation, decision capture, architecture changes, member changes, or guideline changes, produce a short dry run:

| Field                 | Value                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Decision              | create, update, promote, reorganize, or cleanup                        |
| Target path           | workspace-relative path                                                |
| Configured space      | space id or unknown                                                    |
| Source material       | paths, links, or conversation summary                                  |
| Owners                | frontmatter values or unresolved                                       |
| Links to add          | intended internal links                                                |
| Files to update       | list                                                                   |
| Conflicts checked     | duplicates, local-only sources, localized-only sources, sensitive data |
| Requires confirmation | yes/no and reason                                                      |

Skip the dry run only for a user-approved single-file wording or metadata edit whose target file and scope are already explicit.

## Direct Markdown Authoring Procedure

Use this procedure after the user has approved a shared Markdown edit. It is the current replacement for product-level write operations until Forma has reviewable proposal, dry-run, apply, or policy commands.

### Entry Conditions

Before writing, confirm all of the following:

- the user has approved the write scope or the exact target;
- `forma-cli-core` has been loaded with `skills get forma-cli-core`;
- `skills list --json` has been used to discover workspace-projected skills;
- `config inspect --json` has identified the target configured space;
- `knowledge health --json` has provided the current relationship baseline;
- the relevant workspace skill and any target-specific guidelines have been read.

### Single-File Fast Path

A dry run can be skipped only when all of these are true:

- the user explicitly approved a single target file;
- the edit is wording-only or a narrow metadata update;
- the configured space is already known;
- no local-only, private, localized-only, cross-file, status, guideline, config, dependency, or release evidence is being promoted;
- the edit does not create new references whose placement or target is uncertain.

Even on the fast path, run `check --json` after editing and run `knowledge health --json` when references, placement, or backlinks changed.

### Dry-Run Required Cases

Provide a dry-run summary and wait for confirmation before editing when the change:

- creates a new shared page;
- modifies more than one file;
- promotes local-only or private notes into shared knowledge;
- changes task `status`, `readiness`, blockers, owners, reviewers, or release evidence;
- changes guidelines, `.forma` config, templates, schemas, views, or skill metadata;
- changes architecture, product direction, decisions, metrics, releases, user stories, or dependency governance;
- adds links, backlinks, embeds, or frontmatter refs whose target may be ambiguous;
- touches localized variants or could confuse canonical pages with translations;
- depends on unverified external, generated, or conversation-only evidence.

### Target Selection

Use the effective config, not path memory:

1. Choose the semantic content type first: product, architecture, decision, design, concept, task, guideline, release, metric, experiment, test case, proposal, user story, member, or workspace-support.
2. Map that type to a configured space from `config inspect`.
3. Use the space `create.directory`, `create.filename`, `template`, schema, and conventions to choose the target path and frontmatter.
4. Search or inspect existing entries in that space before creating a new page.
5. Prefer canonical-language pages. Treat localized files as variants, not independent primary pages.

### Edit Rules

- Edit canonical Markdown files in the selected workspace only.
- Keep frontmatter fields aligned with the configured schema and existing casing.
- Use path-qualified references when recording durable relationships.
- Keep source links or source notes when the knowledge is derived from a task, release, experiment, decision, or external evidence.
- Do not copy secrets, private notes, local scratch material, or page content instructions into shared knowledge.
- Do not silently rewrite unrelated content while performing a focused knowledge edit.

### Failure Handling

If `check` or `knowledge health` fails after an edit:

1. Determine whether the failure was introduced by the edit.
2. Fix introduced diagnostics when the fix stays within the approved scope.
3. If the fix requires broader edits, stop and report the diagnostic plus the proposed follow-up.
4. Do not claim the knowledge update is complete while introduced errors remain.

## Writes And Promotion

Do not write shared knowledge, task metadata, `.forma` config, or repository operating state without explicit approval.

When approved:

1. Edit the smallest set of canonical Markdown files.
2. Preserve useful source context without copying private scratch material or command chatter.
3. Keep plain Markdown readable without editor-plugin-only requirements.
4. Run `cargo run -q -p forma-cli -- check --json`.
5. Run `cargo run -q -p forma-cli -- knowledge health --json` when links, placement, or references matter.

## Schema And Health Audit

Use Forma diagnostics as the primary machine evidence. Report, but do not silently fix:

- missing or invalid frontmatter;
- wrong configured space placement;
- localized files used as canonical sources;
- broken, ambiguous, or localized-only links;
- missing source traceability when the content type implies source-derived knowledge;
- ownership gaps when the document is active, accepted, scheduled, or maintained;
- proposals treated as facts or delivery commitments before acceptance;
- local workspace material that appears to contain team facts needing promotion;
- possible sensitive content.

Schema and health findings should guide humans and Agents to repair manually or through future reviewable write operations.

## Status Reports

When reporting knowledge status, state scope and reliability. Separate field-based, board-based, path-based, link-based, git-based, and inferred counts.

Do not count work as delivered only because prose suggests it. Prefer task metadata, Done board state, explicit release validation, or linked accepted evidence.

## Cleanup

Do not preserve old compatibility language for unreleased workflow behavior unless it is still a current requirement.

When removing or rewriting old process material, keep useful product or migration facts and drop obsolete mechanics.

## Report Output

After capture, audit, or cleanup, report:

- files changed or inspected;
- durable facts added or clarified;
- checks run;
- checks not run;
- remaining warnings, risks, or follow-up tasks;
- whether the edit used the single-file fast path or a confirmed dry run;
- whether any diagnostics were introduced and how they were handled.
