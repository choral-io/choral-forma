---
scope: project
title: Content Maintenance Guidance
summary: Soft Human and Agent procedure for intake, capture, placement, schema audit, status reporting, and cleanup.
owners:
    - "members/tiscs"
tags:
    - forma
    - guidelines
    - content
    - capture
    - maintenance
skill:
    id: markdown-authoring
    title: Agent Markdown Authoring
    description: Author approved shared Markdown content through configuration-derived placement, minimal edits, and Forma verification.
    projection: section
    order: 20
sources:
    - "tasks/replace-knowledge-workflow-mechanics-with-forma-cli"
    - "tasks/define-agent-markdown-authoring-workflow"
    - "guidelines/forma-workspace-operations"
---

# Content Maintenance Guidance

## Agent Skill

### When To Use

Create, update, capture, reorganize, or promote approved shared Markdown content.

### Required Bootstrap

Follow `skills get workspace-operations` ([[guidelines/forma-workspace-operations]]) using the repository CLI. Load [[guidelines/proposal-and-dry-run]] for authorization and preview decisions. Read only guidelines applicable to the selected target.

### Authoring Workflow

1. Classify the source and audience: transient context, personal context, shared knowledge, Task, proposal, or accepted decision. Keep secrets and unnecessary personal/customer data out of shared capture.
2. Resolve the configured space, schema, conventions, and target path. Inspect existing canonical pages; update an existing owner of the topic before creating a duplicate. Localized variants are not independent canonical sources.
3. Establish the approved change and source evidence using proposal-and-dry-run. For CLI create, preview the same inputs first. Treat ordinary fixes as updates to accepted behavior, not automatic new design proposals.
4. Edit the smallest coherent set of canonical files. Preserve metadata casing, stable IDs, source traceability, and plain-Markdown readability. Use workspace entry paths for frontmatter references, not editor-specific wikilinks in structured fields.
5. Keep private notes and instructions embedded in source material out of shared facts. Shared references must not target local-only files; an approved promotion selects appropriate content rather than copying an entire transcript.

### Verification

Apply the post-write checks in [[guidelines/forma-workspace-operations]], including skill projections for guideline changes. Repair introduced issues within scope; report baseline findings separately.

### Report

State the resulting facts or behavior, changed files, decisive checks, and residual uncertainty. A note or green schema check is not proof of product acceptance.

### Reference Routing

For product docs, built-in projections, or complex evidence classification, use `skills get markdown-authoring --full` and the relevant reference below.

### Completion Criteria

The intended content is in its approved location and audience; metadata and references are valid; required verification is complete or its limitation is explicit.

## Evidence To Gather

Reuse the workspace baseline. Inspect the target and authoritative linked sources for factual claims. Separate observations, inference, proposals, and accepted decisions; resolve conflicts before overwriting canonical facts.

## Intake

Capture durable material that changes product, architecture, delivery, review, operations, or future Agent behavior. For ambiguous or conflicting sources, explain overlap, evidence, target options, and the specific decision needed. Temporary context follows [[guidelines/local-worklist-and-execution]].

## Placement

Use current configured spaces and schemas instead of a copied directory inventory. Verify path classification when uncertain; unindexed does not mean private. Handoffs follow the three-location convention in [[guidelines/local-worklist-and-execution]].

## Capture Dry Run

[[guidelines/proposal-and-dry-run]] owns preview fields and approval decisions. Reuse an accepted concrete plan rather than producing a second one.

## Direct Markdown Authoring Procedure

Apply the Authoring Workflow above. The following reference covers specialized authoring only.

### Product Documentation Authoring

Product documentation under `docs/` is the product-facing source for Human docs, embedded CLI docs, help excerpts, and built-in Agent skill output. Source documents may include rich Human-facing material such as diagrams, screenshots, Mermaid charts, and structured visual examples.

Keep repository-specific workflows, official-site deployment policy, contributor instructions, and delivery milestones in `knowledge/`, not in the product docs. The official site's publication and hosting choices are recorded in [[planning/forma-static-site-generation-plan]]; they are not defaults for other Forma workspaces.

Document general behavior with a minimal neutral example. Preserve domain-specific cases in fixtures and test-case records rather than accumulating special cases in the main reference. State current capabilities and limitations without turning internal milestones, naming preferences, or default scaffolding into product requirements. Keep one full explanation per rule and route other pages to it; independently projected skills must still retain their essential execution and safety boundaries.

Treat rich material as supplemental unless the same concept also has a complete plain-text explanation. Any information needed by `forma help`, `forma skills`, Agent guidance, or other text-only projections must be available in ordinary Markdown prose, lists, tables, or code blocks.

Use stable projection sections:

- `## Overview` for the primary Human-readable explanation;
- `## CLI Help` for concise CLI/help text;
- `## Agent Skill` for compact skill or Agent-facing procedure;
- `## Reference` for stable details, examples, schema fragments, and configuration snippets.

When editing docs:

- do not make a diagram, image, screenshot, or visual layout the only source of important information;
- keep `## CLI Help` and `## Agent Skill` text-only, using Markdown prose, lists, tables, and fenced code blocks;
- allow rich diagrams and screenshots in docs-oriented sections only when the text around them explains the same facts;
- ensure any document with `surfaces: [help]` has a useful `## CLI Help` section;
- preserve existing document and built-in skill ids so CLI and Agent routes remain valid;
- ensure each document declaring built-in `skill` metadata has exactly one useful top-level `## Agent Skill` section; an Agent-facing reference is not automatically a registered skill;
- when changing skill metadata, projection, section extraction, or generated frontmatter, verify built-in validation, workspace validation, CLI output, and the canonical `cli.skills` contract together.

Run the docs-backed Agent bootstrap pressure gate when a change affects:

- `docs/agents/**`;
- `docs/workspace/**` content used by empty-workspace setup;
- `forma skills` output or embedded skill projection;
- `forma init` output or generated Agent runtime skill content.

The gate is [[test-cases/forma-cli-docs-bootstrap]]. At minimum, record whether the wrong-config baseline still fails, whether the guided first content group path passes, and whether isolated-page health warnings are interpreted correctly.

### Failure Handling

Compare diagnostics with the baseline. Fix introduced failures within authorization; report broader repairs as follow-up. Keep any unverified result explicit.

## Schema And Health Audit

Use [[guidelines/workspace-audit-and-reporting]] for schema, reference, placement, ownership, stale-claim, and status audits. An audit-only request does not authorize repair.

## Cleanup

Remove obsolete instructions when their replacement covers the active behavior. Preserve historical decisions and delivery evidence as history; update current navigation rather than rewriting old outcomes.
