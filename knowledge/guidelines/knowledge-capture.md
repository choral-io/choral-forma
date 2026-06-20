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
sources:
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "guidelines/forma-knowledge-operations"
---

# Knowledge Maintenance Guidance

## Purpose

This guideline consolidates the soft knowledge behavior previously spread across knowledge assistant, intake, capture, schema audit, and status report skills.

It keeps knowledge maintenance as ordinary Markdown work guided by Forma configuration and checks. It is not a machine-enforced policy and does not require a separate capture skill.

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
- remaining warnings, risks, or follow-up tasks.
