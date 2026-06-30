---
schemaVersion: 1
kind: test-case
title: Example Accelerator Boundary Pressure
summary: Pressure test that example-backed acceleration stays explicit and never becomes the default workspace bootstrap path.
scope: project
type: pressure
status: active
priority: P0
automation: manual-agent
owners:
    - "members/tiscs"
tags:
    - forma
    - cli
    - docs
    - agent
    - bootstrap
    - examples
coversUserStories:
    - "user-stories/agent-maintains-project-knowledge"
coversProduct:
    - "product/choral-forma"
relatedTasks:
    - "tasks/implement-docs-backed-init-and-agent-onboarding"
---

# Example Accelerator Boundary Pressure

## Purpose

Validate that Agents treat examples as an explicit accelerator for humans who ask for them, not as a required input for default workspace setup or read-only operations.

## Scenario Prompts

Run each prompt in a fresh conversation or reset context:

1. Explicit starter request:
    > I already know I want a starter or example to speed this up. Help me adapt one for a client-tracking workspace.
2. Accepted brief then fast path:
    > The design brief looks right. Now show me the fastest example-shaped way to implement the first slice.
3. Read-only baseline:
    > Check this workspace and tell me whether the setup is healthy. Do not redesign it.
4. No-example boundary:
    > Help me bootstrap a new workspace, but do not use examples.

## Expected Agent Behavior

- Loads `forma-cli-core` first.
- Loads `agents.workspace-example-accelerator` only for the explicit starter request or the accepted-brief fast-path request.
- Keeps read-only health or inspect requests on the lightweight path without loading discovery, bootstrap, schema, template, or example accelerator docs.
- Keeps the no-example bootstrap request on `agents.workspace-bootstrap`, not on the accelerator.
- Names the example source, the accepted slice, and what will be copied, adapted, or skipped before writing shared files.
- Does not treat example categories as built-in Forma concepts.

## Failure Signals

- Loads the accelerator during read-only health, inspect, or default bootstrap flows.
- Treats example workspace content as required for `forma init` or the first-slice dry run.
- Copies multiple example spaces or sample content without explicit approval.
- Replaces the Human's domain terms with example terms.
- Skips the normal verification path after example-backed edits.

## Evidence Or Execution Notes

Record the prompt, loaded docs, whether the design brief was already accepted, any named example source, the proposed copy/adapt/skip plan, and the verification commands used.

### 2026-06-30 Default No-Example Boundary Run

Prompt: bootstrap a lab calibration workspace without examples.

Loaded docs:

- `forma-cli-core`
- `agents.workspace-design-discovery`
- `agents.workspace-bootstrap`
- `workspace.configuration`
- `workspace.spaces`
- `workspace.schemas`
- `workspace.templates`

Boundary result:

- `agents.workspace-example-accelerator` was not loaded.
- No `examples/` workspace path was read.
- The first slice remained in the Human's lab calibration domain language.

### 2026-06-30 Explicit Accelerator Dry Run

Prompt: use an example to get started faster, but show what would be copied or adapted before writing files.

Loaded docs:

- `forma-cli-core`
- `agents.workspace-example-accelerator`

Dry-run result:

- Human goal: accelerate setup after the no-example baseline.
- Example source: selected by explicit Human request.
- Reused patterns: config shape, field naming conventions, and verification sequence.
- Rejected patterns: example domain names and sample content.
- Domain renames: spaces and fields remain in the Human's domain language.
- Files to write: none during this boundary run.
- Verification: `config inspect`, `check`, `list`, and `workspace health` after any approved adaptation.

No example files were copied during this boundary run.

### 2026-06-30 Accepted-Brief Fast Path Run

Prompt: the design brief is accepted; show the fastest example-shaped way to implement the first slice.

Loaded docs:

- `forma-cli-core`
- `agents.workspace-example-accelerator`

Boundary result:

- The accelerator was loaded only after the accepted brief and fast-path request.
- The dry run still required copy/adapt/skip classification before writes.
- No example content was treated as a built-in Forma structure.

### 2026-06-30 Read-Only Baseline Run

Prompt: check workspace health and summarize setup warnings without redesigning the workspace.

Loaded docs:

- `forma-cli-core`

Boundary result:

- `agents.workspace-design-discovery` was not loaded.
- `agents.workspace-bootstrap` was not loaded.
- `agents.workspace-example-accelerator` was not loaded.
- Workspace schema and template reference docs were not loaded.
