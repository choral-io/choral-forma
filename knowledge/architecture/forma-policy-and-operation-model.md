---
scope: project
type: architecture
owners:
    - "members/tiscs"
tags:
    - forma
    - policy
    - operations
    - writable
sources:
    - "product/product-direction"
    - "architecture/forma-core-technical-direction"
    - "guidelines/forma-workspace-operations"
---

# Forma Policy And Operation Model

## Purpose

Forma should grow beyond read-only browsing into a repository-backed knowledge operation system. Write behavior should remain reviewable, inspectable, and grounded in Markdown files.

## Constraint Layers

### Schema

Schema validates content structure: fields, types, required values, enum values, semantic refs, create defaults, and template inputs.

### Guidelines

Guidelines are ordinary Markdown operating rules for humans and Agents. Workspace configuration, taxonomy terms, views, or future operation profiles can reference them as guidance. They explain collaboration boundaries, review expectations, local-only paths, write discipline, and lightweight procedure checklists such as task selection or knowledge capture.

### Policies

Policies are future machine-readable operation constraints. They should be introduced only when an operation can consume them and emit diagnostics or apply-time decisions.

The first likely policy domain is task workflow:

- allowed task status values;
- allowed status transitions;
- readiness gates;
- blocked-task gates;
- review and done gates.

### Invariants

Invariants are workspace-wide consistency checks. Examples include resolved references, unique space membership, canonical language variants, local-only path exclusion, safe config paths, and graph relation field validity.

### Operations

Operations are the execution boundary for reading, proposing, validating, applying, and auditing changes. Writable operations should follow this flow:

```text
read current workspace
-> build proposed change
-> validate schema, invariants, and applicable policies
-> show diff or dry-run
-> require approval
-> apply file changes
-> run verification
```

## Near-Term Scope

The current repository should first add `guidelines` config and Agent routing. Full policies should wait until `forma tasks audit`, `forma proposal`, or write-capable task operations are ready to consume them.
