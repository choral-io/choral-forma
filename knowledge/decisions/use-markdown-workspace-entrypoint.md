---
schemaVersion: 1
kind: decision
scope: project
title: "Use Markdown Workspace Entrypoint"
summary: "Use `.forma.md` as the only Forma workspace configuration entry before public release."
type: decision
owners:
    - "members/tiscs"
reviewers: []
tags:
    - architecture
    - configuration
    - markdown
    - entrypoint
sources:
    - "architecture/forma-core-technical-direction"
    - "decisions/use-settings-driven-taxonomy-and-navigation-model"
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
supersedes: []
supersededBy: []
---

# Use Markdown Workspace Entrypoint

## Context

Forma is intended to be a Markdown-native knowledge product. The previous `.forma.yml` entrypoint made configuration explicit, but it left the primary bootstrap file outside the same Markdown document model used by config nodes, views, guidelines, templates, and repository knowledge.

The product has not shipped a stable public configuration contract, so this stage can make a breaking entrypoint change without preserving compatibility.

## Decision

Use `.forma.md` as the only workspace configuration entrypoint.

The `.forma.md` file is a normal Markdown document:

- YAML frontmatter is the machine-readable workspace configuration.
- The Markdown body is Human and Agent-readable workspace introduction or setup notes.
- The workspace root is the directory containing `.forma.md`.
- All persisted configuration file references are workspace-relative POSIX paths from that root.

Forma does not read `.forma.yml`, does not fall back to it, and does not provide automatic compatibility migration.

## Consequences

- `forma init` writes `.forma.md` and `.agents/skills/forma-cli/SKILL.md`.
- `forma config inspect`, `forma check`, `forma serve`, RPC, WebApp reads, and embedded Agent guidance all start from `.forma.md`.
- Existing internal workspaces must rename `.forma.yml` to `.forma.md` and wrap the previous YAML in Markdown frontmatter.
- `.forma/` remains a recommended support directory only; it is not a privileged root.
- Included Markdown config nodes keep the same frontmatter-based model.
- Explicitly included YAML config nodes can still exist as lower-level config fragments, but they are not entrypoints.

## Rejected Alternatives

### Transitional `.forma.yml` Fallback

Rejected because the product is still pre-public and compatibility would add branching behavior, confusing docs, and extra Agent guidance.

### Keep `.forma.yml` As The Entrypoint

Rejected because it keeps the most important workspace document outside Forma's Markdown-native model.

## Related Knowledge

- [[architecture/forma-core-technical-direction]]
- [[decisions/use-settings-driven-taxonomy-and-navigation-model]]
- [[product/product-direction]]
- [[tasks/migrate-config-entrypoint-to-forma-md]]
