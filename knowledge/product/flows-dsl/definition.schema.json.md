---
title: Choral Flows DSL Beta.2
summary: Download the Definition Schema and follow a reviewed knowledge change from proposal to publication receipt.
scope: project
tags:
    - flows-dsl
    - knowledge-publication
---

# Choral Flows DSL Beta.2

A Flow Definition describes the steps of a workflow, what each step needs, and which result the workflow delivers. Choral Flows DSL records that plan in YAML or JSON so it can be read and reviewed alongside the rest of the work.

## Definition Schema

[Download the Beta.2 Definition Schema (JSON)](/-/raw/crates/flows-dsl/contract/definition.schema.json)

Use this Draft 2020-12 JSON Schema to check the structure of a YAML or JSON Definition whose `dsl` field is `choral/flows-v1-beta.2`. An editor that supports JSON Schema can use the file for completions. The Flows DSL checker also checks workflow rules such as whether a dependency refers to a declared Watcher exit. [Beta.2 specification](https://github.com/choral-io/choral-forma/blob/8e47646/crates/flows-dsl/contract/SPEC.md)

## Example

The [knowledge publication Definition](https://github.com/choral-io/choral-forma/blob/55a866c/crates/flows-dsl/examples/knowledge-publication-exits.yaml) starts with a source ID and registers a proposal. A Watcher waits for the publication receipt. The receipt selects one of two exits.

| Receipt   | What the flow does                                                                          |
| --------- | ------------------------------------------------------------------------------------------- |
| `applied` | Requests indexing, waits for the reply, and delivers the entry and revision in it.          |
| `closed`  | Delivers the closure record with the proposal ID and can carry null entry and revision IDs. |

From the repository root, run `cargo test --locked -p flows-dsl --test publication` to check the Definition and replay both paths with synthetic receipts. The `flows-dsl` Rust library checks the Definition and replays these recorded facts. A workflow host supplies the procedures, accepts authorized receipts, and saves the facts needed for replay. [Rust library and supported execution scope](https://github.com/choral-io/choral-forma/blob/55a866c/crates/flows-dsl/README.md)

For the role of proposals and review in Forma, see [structured artifacts and source facts](../structured-artifacts-and-source-facts.md).
