---
schemaVersion: 1
kind: roadmap
title: Forma Product Value Gap Roadmap
summary: Prioritized roadmap for strengthening Forma's minimum product moat beyond well-designed Markdown and instructions.
scope: project
type: roadmap
owners:
    - "members/tiscs"
reviewers: []
tags:
    - forma
    - product-value
    - roadmap
    - public-preview
sources:
    - "product/choral-forma"
    - "product/product-direction"
    - "architecture/forma-policy-and-operation-model"
    - "architecture/editor-extension-adapter-contract"
    - "decisions/editor-extension-primary-product-surface"
    - "experiments/starter-kit-agent-pressure-validation"
    - "releases/forma-v0.1.23"
---

# Forma Product Value Gap Roadmap

## Product Judgment

Forma's minimum moat is not spaces, schemas, templates, or Markdown conventions by themselves. Those can be reproduced with ordinary files, instructions, and repository discipline.

The differentiated value is one deterministic runtime that turns those conventions into validated configuration, typed content, reference resolution, health findings, derived projections, and shared operations for CLI, WebApp, editors, and Agents while keeping Markdown as the durable source.

Current technical confidence is stronger than product-value confidence. The runtime and release pipeline are validated, but broad write governance, guided adoption, cross-surface parity, compatibility windows, and external outcome evidence remain incomplete.

## Current Baseline

Observed in the current Public Preview:

- Core, CLI, RPC, WebApp, VS Code, and Zed reuse Forma-owned parsing and reference semantics.
- Config inspection, schema checks, workspace health, entry inspection, list, create, view rendering, and reference resolution are implemented.
- The WebApp is read-only; VS Code is the richest daily surface; Zed is navigation-only.
- Agents can discover config, guidelines, skills, and deterministic JSON checks, but general edits still happen as direct file changes followed by verification.
- VS Code and CLI packages require exact coordinated versions.
- Machine-readable policies, general proposal/apply operations, import/normalization, and schema migrations are not implemented.
- Internal starter-kit pressure validation passed, but no external pilot or comparative product-value evidence is recorded.

## Prioritized Gaps

| Order | Gap | Observed current capability | Desired outcome | Durable work record | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Guided knowledge modeling | Embedded docs and Agent guidance can bootstrap a first content group, but users still translate their domain into config manually. | A user or Agent can describe a real domain, receive an explainable first-slice model, review generated spaces/types/templates/views, and reach a healthy workspace without copying an example. | [[tasks/design-guided-knowledge-modeling-flow]] | Three domain fixtures produce reviewable first-slice designs; the path reports assumptions and rejects unsupported automation. |
| 2 | Broader creation, import, and normalization | `init` bootstraps two files and `create` writes one configured entry; existing Markdown must be modeled and normalized manually. | Forma can inventory an existing Markdown corpus, propose mappings and normalization, preview conflicts, and apply only an approved non-destructive slice. | [[tasks/design-markdown-import-normalization-flow]] | An accepted operation design and fixtures cover discovery, mapping, dry-run, conflict handling, idempotency, and rollback boundaries. |
| 3 | Controlled Human and AI write loop | Direct edits plus `check` and health are reviewable through Git, but Forma has no shared propose/apply operation. | Human actions and AI suggestions use one `propose -> diff -> approve -> apply -> verify` contract across adapters. | [[tasks/design-reviewable-forma-write-operations]], [[tasks/design-metadata-edit-deprecate-operations]], [[tasks/design-reviewable-operation-proposal-flow]] | One narrow metadata operation has stable plan/apply results, precondition checks, approval semantics, and post-apply evidence before any AI surface can invoke it. |
| 4 | Schema evolution, impact analysis, and migrations | Forma validates the effective current schema but does not explain affected entries or migrate them when schemas change. | Maintainers can preview schema impact, choose a bounded migration, preserve source fidelity, and verify every changed entry. | [[tasks/design-schema-evolution-migration-contract]] | Compatibility classes, impact output, migration plans, recovery behavior, and old/new fixture validation are accepted. |
| 5 | CLI/editor compatibility window | VS Code and Zed require the exact CLI package version, preventing mixed-version migration windows. | Adapters negotiate protocol revisions and required/optional capabilities while package versions remain independently visible. | [[tasks/design-cli-editor-compatibility-window]] | A two-release bridge and compatibility fixtures prove current/current, current/previous, previous/current, and intentional rejection cases. |
| 6 | Cross-surface parity | Shared Core contracts exist, but WebApp, VS Code, and Zed expose materially different capability sets. | A declared capability matrix distinguishes shared semantics, Host-native adaptations, intentional omissions, and release gates. | [[tasks/define-cross-surface-capability-matrix]], [[tasks/validate-shared-graph-view-cross-host-parity]], [[tasks/implement-zed-extension-mvp]] | The matrix is CI- and release-testable, and every claimed surface capability has contract plus Host evidence. |
| 7 | Executable governance | Schema, path, reference, and health checks are executable; workflow gates and approval rules remain guidelines. | The first write operation consumes a minimal machine-readable policy set without becoming a general workflow engine. | [[tasks/design-forma-policy-runtime]] | One concrete policy consumer proves allowed/denied transitions, local/private boundaries, reference health, approval, and diagnostics. |
| 8 | External value validation | Internal dogfooding and starter-kit Agent pressure cases validate mechanics, not market value. | Forma demonstrates fewer knowledge/Agent failures or faster maintenance than disciplined Markdown plus lightweight scripts. | [[tasks/define-external-product-value-validation]] | A comparative baseline and external pilot record setup cost, errors caught, Agent rework, task time, feature use, retention, and stop criteria. |

## Dependency And Delivery Sequence

1. Start with [[tasks/design-guided-knowledge-modeling-flow]]. It turns the current expert-configured runtime into a testable user journey and supplies the model needed by import.
2. Design [[tasks/design-markdown-import-normalization-flow]] against guided-model outputs, then define [[tasks/design-schema-evolution-migration-contract]] for changes after adoption.
3. Refine [[tasks/design-reviewable-forma-write-operations]] around one narrow schema-driven metadata operation. Keep AI Chat downstream of the shared write boundary.
4. Keep [[tasks/design-forma-policy-runtime]] downstream of the accepted write contract so policy has a real consumer.
5. Define [[tasks/design-cli-editor-compatibility-window]] before expanding cross-editor claims. Use it with [[tasks/generalize-taxonomy-neutral-page-model]] to unblock the capability-matrix and Zed parity path.
6. Run [[tasks/define-external-product-value-validation]] as a continuous evidence gate: establish the comparative baseline now, then repeat after guided modeling, import, and safe writes become usable.

The first selected task is guided modeling. External validation is a parallel guardrail, not a final phase that waits until every feature is built.

## Intentionally Future

- Autonomous AI writes without explicit proposal and apply gates.
- Provider-specific AI Chat, hosted AI credentials, or model billing.
- Destructive bulk rewrites, automatic fixes, general move/rename/delete, and arbitrary Markdown-body patching before narrow write operations prove safety.
- A general policy, permissions, or workflow engine before one concrete policy consumer exists.
- Hosted realtime collaboration, mobile capture, and third-party knowledge-app feature parity.
- Separate editor and CLI release trains before a protocol/capability window is proven across two published releases.
- Arbitrary migration plugins or executable workspace hooks.

## Related Delivery Plans

[[planning/forma-static-site-generation-plan]] defines a separate static-publishing and official-site dogfooding slice. It does not change the prioritized product-value gaps or select a delivery task until implementation is approved.

## Roadmap Review Rule

Each task should update this roadmap only when its observed capability, dependency, or acceptance evidence changes. A completed design does not count as delivered product value until its implementation and validation evidence exist.
