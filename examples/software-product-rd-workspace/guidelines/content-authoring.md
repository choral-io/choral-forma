---
title: "Content Authoring"
summary: "How to add or update research, product, architecture, design, validation, and release pages."
owners:
  - members/ava-patel
reviewers:
  - members/noah-kim
tags:
  - guidelines
  - authoring
skill:
  id: product-rd-content-authoring
  title: Product R&D Content Authoring
  description: Use when an Agent has approval to create or edit shared product R&D Markdown content.
  triggers:
    - create product content
    - edit release evidence
    - update architecture record
    - promote product notes
  order: 40
createdAt: "2026-06-29T00:00:00Z"
updatedAt: "2026-06-29T00:00:00Z"
---

# Content Authoring

## Placement

- User feedback, interview notes, market observations, and product insights belong in `research/`.
- Product direction belongs in `product/`.
- Technical direction belongs in `architecture/`.
- Accepted tradeoffs belong in `decisions/`.
- User-facing flow notes belong in `design/`.
- Delivery work belongs in `tasks/`.
- Validation cases and acceptance checks belong in `validation/`.
- Readiness, adoption, quality, and delivery signals belong in `metrics/`.
- Hypothesis-driven learning loops belong in `experiments/`.
- Release scope, rollout notes, and approval evidence belong in `releases/`.

## Evidence Flow

- Start with `research/` when the team has evidence but has not accepted a product direction change.
- Update `product/` only when the team accepts a direction, audience, scope, or positioning change.
- Create or update `tasks/` when accepted direction needs delivery work.
- Use `validation/` for acceptance checks and `metrics/` for readiness or outcome signals.
- Link release records to the tasks and evidence that are actually in scope; do not use `releases/` as a dumping ground for loose ideas.

## Dry Run

Before multi-file edits, task status changes, release evidence changes, schema changes, or promotion from personal drafts, describe the target files, links, owners, expected relationship changes, and checks that will run.

## Verification

Run `forma check --json` after edits. Run `forma workspace health --json` when links, relationship fields, space config, templates, or views changed.
