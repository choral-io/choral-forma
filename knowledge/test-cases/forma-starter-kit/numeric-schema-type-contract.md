---
schemaVersion: 1
kind: test-case
title: Numeric Schema Type Contract
summary: Verify numeric YAML scalar typing and the distinction between integer formatting controls and lexical ordinal values across a real workspace check and inspect flow.
scope: schema-dsl
type: contract
status: active
priority: P1
automation: cargo-test
owners:
    - "members/tiscs"
tags:
    - schema
    - number
    - integer
    - contract
coversUserStories: []
coversProduct:
    - "product/choral-forma"
relatedTasks: []
---

# Numeric Schema Type Contract

## Purpose

Verify that Forma validates YAML numeric scalars through the same workspace discovery, `check`, and `inspect` paths used by real workspaces. Numeric strings must not be coerced implicitly, while lexical zero-padded values must remain strings.

## Real-world Use Case

Arcadia Library now uses `ordinalWidth: 2` as an unquoted YAML integer in its structure index and keeps generated ordinals such as `"01"` as strings. Its workspace validator additionally requires `ordinalWidth` to be positive. This fixture records the Forma-side contract: `integer` validates the YAML scalar and integrality, `string` preserves lexical formatting, and the positive-integer rule remains workspace-specific because P0 has no range constraints.

## Test Data

- Workspace fixture: `crates/forma-core/tests/fixtures/numeric-schema`
- Automated test: `cargo test -p forma-cli --test cli numeric_schema_fixture_checks_yaml_scalar_types -- --nocapture`

## Steps

1. Run the automated test from the repository root.
2. Confirm the fixture's unquoted `ratio: 1.5`, `count: -2`, and `ordinalWidth: 2` values pass `forma check --json`.
3. Confirm `forma inspect measurements/reading.md --json` preserves numeric JSON values, numeric `ordinalWidth: 2`, and lexical `ordinal: "01"`.
4. Confirm a copied fixture with `count: "2"` fails with `schema.type.invalid` at the `count` field.
5. Confirm a copied fixture with `ordinalWidth: "2"` fails with `schema.type.invalid` at the `ordinalWidth` field.

## Expected Results

- Unquoted YAML numbers satisfy `type: number` and `type: integer` as applicable.
- Quoted numbers fail numeric Schema validation instead of being coerced.
- Numeric formatting controls such as `ordinalWidth` remain numbers, while zero-padded ordinal values remain strings.
- Positivity for `ordinalWidth` is a workspace-validator rule, not a P0 `integer` constraint.
- The same diagnostics and values are observable through the CLI workspace contract.

## Coverage

- YAML numeric scalar typing.
- `number` and `integer` Schema primitives.
- Workspace discovery and `check` validation.
- CLI `inspect` metadata preservation.
- Numeric configuration versus lexical-format metadata.
