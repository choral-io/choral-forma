---
scope: project
type: product
owners:
    - "members/tiscs"
tags:
    - product
    - forma
    - actions
    - triggers
    - p1
---

# Forma Actions And Triggers Concept

## Goal

Define the early product model for configurable Actions and Triggers in Choral Forma.

Actions and Triggers should let a workspace describe repeatable behavior in reviewable repository configuration without turning Forma into a hidden workflow engine or arbitrary plugin runtime.

## Design Direction

Actions are reusable, reviewable, configuration-defined executable processes. They define the execution content: expected inputs and ordered steps. Actions are not owned by one Trigger and may be invoked by a WebApp button, CLI/RPC call, Agent, or Trigger.

Triggers are event matching and invocation bindings. A Trigger listens for a Forma event, matches event context, and invokes one or more Actions with explicit inputs and an execution effect. Trigger configuration should not contain the core business logic; that logic belongs in Actions.

Events are explicit facts emitted by Forma. The long-term event model should support both operation-originated events and file-change events, but the first implementation should prioritize operation-originated events. File watcher, explicit workspace rescan/check, or direct Markdown edit events should be added later when the watch/discovery pipeline is mature enough.

## Action Shape

An Action should be shaped like a small configuration or DSL-backed procedure, not an arbitrary script:

```yaml
actions:
    markTodoDone:
        title: Mark Todo Done
        input:
            schema:
                type: object
                fields:
                    path:
                        type: string
                        required: true
        steps:
            - kind: setField
              target:
                  entry: "{{ input.path }}"
              field: status
              value: done
```

The first version does not need a `policy` field. Execution control can be strengthened later with an optional policy section for maximum effect, allowed callers, affected scope, confirmation rules, or batch limits.

The invocation should provide the effect for that run:

```yaml
triggers:
    onKanbanDone:
        on: action.requested
        match:
            action: markTodoDone
        run:
            action: markTodoDone
            effect: applyChange
            input:
                path: "{{ event.entry.path }}"
```

Useful effect levels are:

- `dryRun`: compute planned changes and diagnostics without writing files.
- `proposeChange`: produce a reviewable change proposal.
- `applyChange`: write the resulting file changes directly.

## MVP Boundary

The first implementation should stay intentionally narrow. It should validate the Action/Trigger model through single-entry metadata changes before adding broader automation.

Candidate first step kinds:

- `setField`
- `unsetField`
- `appendListItem`

MVP constraints:

- steps run in order;
- targets must resolve to a clear entry path;
- writes are limited to entry frontmatter metadata;
- no arbitrary shell, JavaScript, Python, WASM, network calls, or executable triggers;
- no loops, conditionals, cross-action calls, or external plugin execution;
- no file watcher or direct-edit trigger requirement;
- every execution should be able to produce planned changes, applied changes, and diagnostics.

## Kanban Example

Kanban card movement should not introduce a second persistent card-state store. The card move should trigger a metadata Action, such as setting `frontmatter.status`, and the Kanban view should then classify the card from the updated metadata.

This keeps the repository file as the durable source of truth and avoids divergence between "which column the card is in" and "what the entry metadata says."

## Daily Note Example

Daily Notes should not be a hidden built-in product feature. A workspace that wants Daily Notes can define a `daily` space, a template, and a `createTodayDailyNote` Action.

That Action would need a future `createEntry` step:

```yaml
actions:
    createTodayDailyNote:
        title: Create Today Daily Note
        input:
            schema:
                type: object
                fields:
                    date:
                        type: date
                        default: "{{ runtime.currentDate }}"
        steps:
            - kind: createEntry
              space: daily
              input:
                  date: "{{ input.date }}"
                  title: "{{ input.date }}"
```

`createEntry` is not part of the first Action MVP. Daily Note creation should remain a later extension example or optional preset capability.

## Configuration Placement

Actions should tend toward centralized definition because they are executable capabilities and may write files. Centralizing them makes team review easier.

Triggers may be centralized or placed near the space, view, or action that uses them. The exact file layout should remain open until implementation pressure clarifies the tradeoff.

## Phasing

Actions and Triggers should be recorded as a P1+ product direction, but they should not be implemented immediately.

Suggested delivery sequence:

1. P1: manual Actions MVP for single-entry metadata changes. This includes explicit invocation through CLI/RPC, WebApp, or Agent surfaces, but does not require Triggers.
2. P1/P2: operation-originated Triggers after manual Actions are stable. Triggers should match explicit Forma operation events and invoke configured Actions.
3. P2: richer Action steps such as `createEntry`, enabling optional workspace patterns like Daily Notes without making them built-in product behavior.
4. P2/P3: file-change Triggers from watcher, explicit workspace rescan/check, or direct Markdown edit events after the watch/discovery pipeline is mature.
5. P3: external automation such as Agent/MCP handoff, webhooks, network access, or plugin-like execution, gated by a stronger security and review model.

The near-term product work should continue without committing to an implementation task for this capability. When implementation becomes relevant, the first task should be scoped to the manual Actions MVP rather than the full Actions and Triggers model.

## Open Questions

- What exact `.forma/` file layout should store Action definitions and Trigger bindings?
- What expression syntax should Actions and Triggers use for `input`, `event`, and `runtime` references?
- Should `policy` be accepted as a reserved optional field in the first parser, or introduced only when enforcement is implemented?
- How should `proposeChange` integrate with the future reviewable knowledge change proposal model?
- Which operation events are required for the first implementation?

## Related Knowledge

- [[product/product-direction]]
- [[architecture/forma-policy-and-operation-model]]
- [[tasks/design-reviewable-forma-write-operations]]
- [[tasks/design-forma-policy-runtime]]
