---
scope: project
type: engineering-guideline
title: Forma Product Model And Configuration Fidelity
summary: Guardrails for distinguishing stable Forma contracts from configured concepts, repository conventions, and implementation details.
owners:
    - "members/tiscs"
tags:
    - forma
    - engineering
    - product-model
    - configuration
    - paths
    - guidelines
    - agents
skill:
    id: forma-product-model-and-configuration-fidelity
    title: Forma Product Model And Configuration Fidelity
    description: Classify Forma concepts, paths, identifiers, and publication boundaries before changing cross-surface code, contracts, docs, or tests.
    projection: full
    order: 40
sources:
    - "product/product-direction"
    - "architecture/forma-core-technical-direction"
    - "decisions/forma-p0-core-architecture"
    - "guidelines/forma-workspace-operations"
---

# Forma Product Model And Configuration Fidelity

## Purpose

This guideline prevents examples, repository layout, and implementation shortcuts from silently becoming Forma product semantics. Apply it when Core, RPC, CLI, WebApp, static export, tests, or documentation interprets workspace structure or configuration.

It does not rename the current taxonomy or space model. Any public terminology or schema migration requires a separate approved proposal with compatibility and migration evidence.

## Classify Before Implementing

Classify each concept used by a change into exactly one of these categories:

| Category | Meaning | Examples |
| --- | --- | --- |
| Product contract | Explicitly reserved syntax, behavior, or typed operation shared across workspaces | `.forma.md` as the configuration entry point; config node `kind`; workspace-relative POSIX path rules; operation and diagnostic contracts |
| Configured concept | Meaning introduced by the effective workspace configuration | taxonomy and term ids; configured content groups; views; schema fields; templates; runtime value names; display labels and colors |
| Repository convention | A layout or workflow choice made by this repository | `knowledge/`; `.forma/spaces/`; `.forma/views/`; `.forma/local/`; task, member, release, or guideline directories |
| Implementation detail | Replaceable machinery that must not become user-facing truth | scan roots; read-model caches; route staging; generated artifacts; internal lookup tables |

An example path or identifier is not evidence that a product contract exists. The repository dogfooding configuration is representative input, not the Forma schema.

## Evidence Order

Before calling something built in, reserved, private, public, local, shared, or required, verify it against:

1. an accepted product, architecture, or decision document;
2. the effective configuration and stable operation output;
3. the typed Core or RPC contract that owns the behavior;
4. tests using more than the repository's default layout.

If those sources disagree, stop and report the inconsistency. Do not resolve it by copying the most convenient current implementation.

Use `forma config summary --sources --json` for the resolved model and `forma workspace explain <path> --json` for path-specific classification and provenance. Use `forma config inspect --json` only when the authored effective configuration itself must be examined.

## Implementation Rules

- Derive configurable meaning from effective configuration or a typed Core resolver.
- Keep compatibility adapters in one owning layer. Other modules should consume the resolved relationship instead of repeating a raw identifier comparison.
- Do not use directory names, path substrings, filename stems, `.gitignore`, or Git tracking state as semantic classifiers unless an accepted contract explicitly defines that behavior.
- Match configured files by normalized exact path or validated glob, not by a suggestive directory name.
- Treat `.forma/` as a recommended organization location except where a narrower accepted contract reserves a specific path.
- Treat every valid explicitly configured import as part of one effective configuration. A path named `local` has no intrinsic precedence, privacy, publication, or ownership meaning.
- Keep secrets and material requiring a privacy guarantee outside configured workspace inputs until Forma has an explicit authorization and publication model.
- Let Core own discovery, classification, and path resolution. RPC, CLI, WebApp, static export, and editor integrations should consume that projection instead of reinterpreting it.
- Keep Agent Skill metadata, projection, validation, generated Markdown, CLI/RPC output, and product documentation aligned. A change to one of those surfaces must check the others and update the canonical `cli.skills` contract before adding a new source-reference kind.
- Keep UI labels, filters, fields, columns, colors, and configured routes data-driven unless the product contract reserves them.
- Do not introduce a new product primitive only to simplify one repository workflow.

## Required Counterexample Tests

When a change interprets configuration or paths, add the smallest relevant counterexample:

- a valid config node outside the recommended `.forma/spaces/` or `.forma/views/` layout;
- an ordinary content path whose directory happens to be named `local`, `templates`, `tasks`, or `members`;
- a configured template at a nonstandard path;
- an unreferenced file inside a conventionally named directory;
- a neutral taxonomy, term, runtime value, view, or field id;
- two classifications that reuse the same term id;
- a configured control source that must not be treated as publishable content;
- an ignored file that is included or an unignored file that is not configured.

Use only the cases relevant to the changed contract. The purpose is to prove the behavior follows configuration rather than the fixture's vocabulary.

## Documentation Rules

- Use neutral product language: workspace, content, entry, space, view, template, schema, taxonomy, term, and guideline.
- Call spaces and classifications configured when describing their meaning.
- Use task, member, project, release, and `knowledge/` only for this repository or an explicitly labeled example.
- Label recommended layouts as recommendations or examples.
- Describe workflow-local and uncommitted material as repository policy, not a Forma privacy feature.
- When documenting a reserved path or identifier, state its owner, scope, and counterexample boundary.

## Review Checklist

Before declaring the change complete, answer:

- Which category owns each concept introduced or interpreted by the change?
- Is any raw identifier or path convention repeated outside its owning layer?
- Would the behavior still work with a nonstandard but valid configured path?
- Did any workflow rule accidentally become runtime, publication, or privacy behavior?
- Do all surfaces consume the same resolved Core contract?
- Do tests include at least one counterexample to the repository's default vocabulary or layout?
- Do active docs describe the implemented contract without promoting examples into primitives?

Record any intentional exception and its accepted source. If the exception needs a new product contract, stop and propose that contract before implementation.
