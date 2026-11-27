# Flows DSL

A host-independent Rust library for validation and pure execution of a bounded slice of Choral Flow Definitions. Hosts pass authored source and input JSON as text and receive previews and exact JSON deliveries as text.

```rust
use flows_dsl::{run_definition, validate_definition};

let source = r#"
dsl: choral/flows-v1-beta.2
definition:
  id: deliver
  steps:
    - id: entry
      input: {}
      output: {bind: {$ref: "$input#"}}
"#;
let preview_json = validate_definition(source)?;
let delivery_json = run_definition(source, "1.0000000000000001")?;
assert_eq!(delivery_json, "1.0000000000000001");
# Ok::<(), flows_dsl::DefinitionError>(())
```

The preview includes `kind` (`definition` or `schemas`), `profile`, and `version`. A Definition preview also includes `id`, `entry`, `delivery`, and dependency-ordered steps. Each step has an `id` and a list of `needs` with `alias`, `from`, and `require`. Errors expose `stage()` and `code()` and format as `stage:code` without echoing source or input data. Preserve the returned delivery JSON as text through host handoff and storage.

The Cargo version describes the library interface. The Definition profile `choral/flows-v1-beta.2` identifies the document semantics, while preview `version` identifies the preview JSON shape. These versions evolve independently. The [specification](contract/SPEC.md) and [Definition Schema](contract/definition.schema.json) document the current profile. During preview, the library accepts only its current DSL profile. Version compatibility will be considered from the first stable release.

## Examples and acceptance cases

The [Boolean handoff](examples/boolean-handoff.yaml) delivers the JSON Boolean `false` for `{"approved":false}`. The [three-step memo handoff](examples/memo-handoff.yaml) shows how an intermediate step explicitly carries a memo to the final step.

```rust
let source = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/examples/memo-handoff.yaml"));
let delivery = flows_dsl::run_definition(source, r#"{"decision":false,"memo":"Sample memo"}"#)?;
assert_eq!(delivery, r#""Sample memo""#);
# Ok::<(), flows_dsl::DefinitionError>(())
```

- [S02.1 · Explicit handoff](tests/fixtures/explicit-handoff-cases.json) checks that forwarding only the decision delivers `false` and that a direct read of an undeclared upstream value fails Definition validation.
- [S02.2 · Value presence](tests/fixtures/value-presence-cases.json) checks that `false`, `null`, and `[]` are delivered as supplied and that a missing field fails binding.

Both Beta.2 acceptance cases use synthetic data. The integration tests also use the [handoff and replay vectors](tests/fixtures/handoff-and-replay-cases.json) and the [numeric binding vectors](tests/fixtures/numeric-binding-cases.json).

## Supported slice

- One inferred entry and one terminal delivery, connected by ordinary steps.
- YAML and JSON Definition source with unique string keys. Inputs are JSON.
- Local named Schema resources, property and item projection, and the business Schema keywords `type`, `properties`, `required`, `items`, `additionalProperties`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `title`, and `description`. A sole `$ref` can refer to an in-document resource.
- JSON Pointer bindings and CEL expressions with JSON scalar results.
- Bounded source, data, expressions, and CEL comprehension iteration. Hosts should run untrusted evaluations in a terminable worker with an outer deadline and memory limits.

The grammar covers the full beta document shape. This library rejects constructs beyond the supported slice, including external imports, child Definitions, and Watcher or durable execution. External procedure calls, including the beta.2 `onFailure: tolerate` policy, require runtime capability support. Schema retrieval is disabled. Full upstream CEL conformance and cross-host replay remain future verification work.
