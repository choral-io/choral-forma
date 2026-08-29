---
schemaVersion: 1
kind: test-case
title: Numeric Schema Type Contract
summary: Verify that number and integer fields preserve YAML scalar typing across a real workspace check and inspect flow.
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

## Test Data

- Workspace fixture: `crates/forma-core/tests/fixtures/numeric-schema`
- Automated test: `cargo test -p forma-cli --test cli numeric_schema_fixture_checks_yaml_scalar_types -- --nocapture`

## Steps

1. Run the automated test from the repository root.
2. Confirm the fixture's unquoted `ratio: 1.5` and `count: -2` values pass `forma check --json`.
3. Confirm `forma inspect measurements/reading.md --json` preserves numeric JSON values and the quoted `ordinalWidth: "2"` string.
4. Confirm a copied fixture with `count: "2"` fails with `schema.type.invalid` at the `count` field.

## Expected Results

- Unquoted YAML numbers satisfy `type: number` and `type: integer` as applicable.
- Quoted numbers fail numeric Schema validation instead of being coerced.
- Zero-padded formatting metadata remains a string.
- The same diagnostics and values are observable through the CLI workspace contract.

## Coverage

- YAML numeric scalar typing.
- `number` and `integer` Schema primitives.
- Workspace discovery and `check` validation.
- CLI `inspect` metadata preservation.
