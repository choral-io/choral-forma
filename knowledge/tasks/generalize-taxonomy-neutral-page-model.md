---
schemaVersion: 1
scope: project
type: task
title: Generalize Forma To A Taxonomy-Neutral Page Model
summary: Remove taxonomy-id-specific compatibility behavior and define one generic Page, taxonomy, term, schema, creation, and projection model across Forma products.
priority: P1
value: H
module: app
effort: L
status: backlog
readiness: needs-refinement
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - architecture
    - taxonomy
    - core
    - cli
    - rpc
    - vscode
    - zed
    - webapp
blockedBy: []
relatedTo:
    - "decisions/use-settings-driven-taxonomy-and-navigation-model"
    - "architecture/forma-core-technical-direction"
    - "architecture/editor-extension-adapter-contract"
    - "planning/forma-link-navigation-and-highlighting-refinement-plan"
    - "tasks/generalize-task-specific-read-operations"
severity:
sprint:
reportedBy:
affectedArea: Forma Core, CLI, RPC contracts, VS Code extension, Zed extension, WebApp, examples, and product documentation
---

# Generalize Forma To A Taxonomy-Neutral Page Model

## Goal

Make every configured taxonomy equal throughout Forma. Remove production behavior that recognizes a particular taxonomy id, including `spaces`, and replace the current compatibility projection with a generic Page, taxonomy, term, schema, creation, and read-model contract.

## Sources

- [[decisions/use-settings-driven-taxonomy-and-navigation-model]]
- [[architecture/forma-core-technical-direction]]
- [[architecture/editor-extension-adapter-contract]]
- [[planning/forma-link-navigation-and-highlighting-refinement-plan]]

## Context

The accepted settings-driven model defines Page, Taxonomy, Term, View, and Dashboard as the minimal product concepts. A starter workspace may define a taxonomy whose id is `spaces`, but that name has no built-in meaning.

The current implementation still contains a compatibility projection through types and fields such as `SpaceDefinition`, `config.spaces`, dashboard `spaces`, space-specific schema selection, and explicit `taxonomy == "spaces"` branches. These paths make one configured taxonomy behave like a core partition and conflict with the accepted product model.

The Zed link-navigation and highlighting refinement must remain bounded. It may use a temporary single-term-per-Page assumption, but it must not define the final composition behavior or add new taxonomy-id-specific branches. This task begins after that refinement and owns the cross-product generalization.

## Required Design Work

- Define generic Page discovery from all effective taxonomy term `include` patterns.
- Define membership and validation for `mode: primary` and `mode: multiple` without a globally primary taxonomy.
- Define how schemas, conventions, and guidelines compose when a Page matches terms across multiple taxonomies.
- Define explicit create and template selection using taxonomy and term identity.
- Define generic reference-type source selection without a space compatibility projection.
- Replace space-specific index, operation, RPC, and client contracts with taxonomy-neutral contracts.
- Define migration boundaries for existing internal workspaces, examples, routes, and release-aligned clients.
- Preserve files-first configuration and avoid hidden taxonomy precedence based on names, import ordering, or support-directory layout.

## In Scope

- Forma Core configuration, document analysis, schema validation, indexing, rendering, and operations.
- CLI and RPC command and response contracts.
- Shared TypeScript contracts.
- VS Code Explorer, navigation, diagnostics, and View integration affected by the contract change.
- Zed/LSP behavior affected by generic managed membership or schema-aware references.
- WebApp taxonomy navigation and any remaining space-specific routes or read models.
- Starter generation, examples, tests, embedded docs, and product documentation.

## Out Of Scope

- Adding a built-in taxonomy or reserving a taxonomy id.
- Preserving compatibility for unshipped taxonomy-specific contracts when a clean migration is available.
- Zed link styling or command-click behavior already owned by [[planning/forma-link-navigation-and-highlighting-refinement-plan]].
- Publishing a release without separate approval.

## Acceptance Criteria

- No production code changes behavior based on a configured taxonomy id such as `spaces`.
- Pages are discovered and classified through generic effective taxonomy and term definitions.
- Multiple-taxonomy membership semantics and conflicting schema or convention behavior are explicit and tested.
- Create, template, guideline, reference, View, Explorer, CLI/RPC, and client behavior use taxonomy-neutral contracts.
- Example workspaces may still define `spaces`, but equivalent differently named taxonomies produce equivalent behavior.
- Repository checks, cross-client tests, and performance baselines pass after migration.

## Sequencing

Keep this task in `backlog` with `readiness: needs-refinement` until the Zed link-navigation and highlighting refinement is complete. Use the resulting LSP scope evidence to refine the generic Page-membership contract, then split implementation into small cross-contract migrations with an explicit compatibility cut line.

## Open Questions

- How should schemas and conventions compose when one Page matches multiple taxonomy terms?
- Should compatible object schemas be intersected, layered, or represented as independently validated constraints?
- How should conflicts be diagnosed without introducing implicit precedence?
- Which taxonomy and term identity should explicit create commands require?
- Which current space-specific RPC and UI contracts can be removed in one breaking change, and which require a short migration adapter?
