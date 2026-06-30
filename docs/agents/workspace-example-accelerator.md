---
id: agents.workspace-example-accelerator
title: Workspace Example Accelerator
summary: Optional example-first accelerator for Agents when a Human explicitly asks for a starter or example-shaped fast path.
audience:
    - agent
surfaces:
    - docs
order: 215
---

# Workspace Example Accelerator

## Agent Guidance

Use this doc only when the Human explicitly asks to learn from an example, start from a starter workspace, or use a known pattern as a fast path. It is an accelerator, not the default bootstrap contract.

Do not load this doc for:

- empty-workspace setup by default;
- read-only inspect, list, check, or health workflows;
- first-pass design discovery before the Human accepts a design brief;
- situations where the Human asked for a no-example path.

The default empty-workspace path remains `agents.workspace-bootstrap`.

## Entry Conditions

Load this doc only after one of these is true:

1. The Human explicitly asks for an example, starter, template, or fast-start source.
2. The Human accepts a design brief and asks for the fastest example-shaped way to implement that slice.
3. The Human names a specific example workspace and wants to adapt it rather than design from scratch.

If none of these are true, stay on the no-example path.

## How To Use Examples Safely

Treat the example as a pattern reference, not as hidden product structure.

Before copying or adapting anything:

1. Name the target slice in the Human's domain language.
2. State which example or starter is being used and why it is the closest fit.
3. Separate what will be copied exactly, adapted, or rejected.
4. Confirm local/private boundaries before bringing over paths, guidelines, or sample content.

Use the example to accelerate structure review:

- compare space ids, schema fields, templates, views, and guidelines;
- keep only the parts needed for the accepted slice;
- rename example terms into the Human's domain terms;
- delete example-specific content that does not belong in the target workspace.

## Required Boundaries

- Do not present example categories such as `tasks`, `members`, `notes`, or `projects` as built-in Forma concepts.
- Do not copy full example content unless the Human explicitly approves that source and scope.
- Do not make example files a prerequisite for `forma init`, `forma check`, `forma workspace health`, or the default first-slice flow.
- Do not bypass the first-slice dry run just because an example looks close.
- Do not pull in extra spaces, views, or guidelines that are not needed for the accepted slice.

## Minimal Accelerator Flow

1. Confirm the Human wants example-backed acceleration.
2. Restate the accepted slice or the missing design decision.
3. Inspect only the relevant example files or starter workspace parts.
4. Produce a dry run that marks each artifact as `copy`, `adapt`, or `skip`.
5. Wait for approval before writing shared config or shared content.
6. Verify with the same commands used in the no-example path: `forma config inspect --json`, `forma check --json`, and `forma workspace health --json`, plus any slice-specific `list`, `inspect`, or `create` commands.

If the example creates pressure to copy too much at once, stop and fall back to `agents.workspace-bootstrap`.
