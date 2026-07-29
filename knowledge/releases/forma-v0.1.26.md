---
schemaVersion: 1
kind: release
title: Forma v0.1.26
summary: Public Preview update for static publishing, resolved workspace operations, runtime performance, and Agent-facing embedded Skills.
scope: project
type: release
status: planned
version: v0.1.26
date: 2026-07-29
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
    - static-site
    - cli
    - webapp
    - agents
    - workflow
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
---

# Forma v0.1.26

## Scope

Publish the coordinated Public Preview update after [[releases/forma-v0.1.25]]. The candidate turns a Forma workspace into a crawlable static site, exposes resolved workspace operations for Humans and Agents, reduces repeated runtime work, and aligns Core, RPC, CLI, WebApp, VS Code, Zed, documentation, and release assets at `0.1.26` / `v0.1.26`.

## Included Changes

- Add deterministic `forma site build` output with crawlable entry, View, taxonomy, term, resource, and metadata routes; serve the repository workspace at `forma.choral.io` through the verified Cloudflare deployment workflow.
- Normalize static URLs without trailing slashes, retain readable static fallbacks, and enhance them with local workspace data for Quick Open, document metadata, links, Views, and navigation.
- Resolve authored configuration into a typed effective workspace model and add focused `config summary`, non-writing `create --preview`, and `workspace explain` operations.
- Reuse workspace snapshots and cache safe read operations while invalidating them after relevant file changes or mutations.
- Render `.forma.md` as the workspace's normal entry document, using the same title, summary, metadata, and Markdown presentation model as other managed entries.
- Compile canonical product documentation into the CLI and project configured guidelines into portable Agent Skills with explicit `docs:` and `workspace:` source references.
- Validate Agent Skill names, descriptions, triggers, metadata, projections, and Markdown section boundaries while preserving the legacy `Agent Guidance` migration path.
- Keep built-in recovery Skills available when unrelated workspace guidelines are invalid, and exit quietly when a downstream CLI stdout consumer closes its pipe.
- Define repository Release creation from a required `version` input so the target filename, default title, and frontmatter version remain aligned without generic slugification.
- Harden CI, release, Marketplace, and static-site deployment gates around exact source commits and verified artifacts.
- Refresh compatible Rust and frontend dependencies, including the bundled Lucide icon assets and DaisyUI patch line.

## Validation Plan

1. `mise run version:check -- v0.1.26` passes.
2. `CI=true mise run check` passes from the exact candidate commit.
3. Forma config summary, content checks, workspace health, Release create preview, and the docs-backed Skills black-box exercises pass.
4. `forma-0.1.26.vsix` packages and passes the isolated smoke test with the matching `forma 0.1.26` development CLI.
5. The complete candidate is pushed and main CI passes for its exact commit before any tag decision.
6. An annotated `v0.1.26` tag, GitHub Release publication, and Marketplace publication require explicit maintainer approval.
7. After publication, `mise run release:verify -- v0.1.26` verifies the complete asset inventory, checksums, CLI version, VSIX identity, and managed CLI installation.

## Migration Or Operations Notes

- Existing Forma workspace Markdown does not require a content migration.
- `## Agent Guidance` remains readable with a migration warning; new or edited projected guidelines should use `## Agent Skill`.
- The resolved operation and embedded Skill contracts are pre-1.0 APIs and should be consumed through the coordinated `0.1.26` Core, RPC, and CLI release.
- Main-branch static-site deployment remains independent from version-tag publication; a successful exact-source site artifact can update `forma.choral.io` without cutting a release.
- The version-driven Release creation contract is repository workflow configuration, not a Forma built-in content model.

## Release Notes

> Forma `v0.1.26` makes one files-first workspace useful across more surfaces: the same Markdown can drive the live project site, fast local reading, resolved workspace operations, and focused Agent Skills without introducing a hidden content store.

## Rollback Plan

Do not move or overwrite a published tag, Marketplace version, or verified release asset. If validation finds a blocker, return the candidate to remediation. If a published artifact needs correction, publish a higher coordinated version. Static-site deployment can be rolled back independently to a previously verified site artifact.

## Post-Release Follow-Up

- Add this released record to [[planning/forma-release-and-delivery-ledger]], then run `mise run release:record-check -- v0.1.26` before committing the post-release evidence.
- Continue WebApp code splitting and lazy-loading work for the largest generated chunks.
- Decide whether malformed workspace declarations that reuse built-in Skill IDs require an additional raw-declaration collision policy.
