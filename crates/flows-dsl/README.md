# Flows DSL

A host-independent Rust library for validating, running and replaying a bounded slice of Choral Flow Definitions. Hosts supply authored source and exact JSON text. They can run pure graphs to completion or recover an addressed execution from durable facts.

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

## Pure execution

- One inferred entry and one terminal delivery, connected by ordinary steps.
- YAML and JSON Definition source with unique string keys. Inputs are JSON.
- Local named Schema resources, property and item projection, and the business Schema keywords `const`, `minLength`, `type`, `properties`, `required`, `items`, `additionalProperties`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `title`, and `description`. A sole `$ref` can refer to an in-document resource.
- JSON Pointer bindings and CEL expressions with JSON scalar results.
- Bounded source, data, expressions, and CEL comprehension iteration. Hosts should run untrusted evaluations in a terminable worker with an outer deadline and memory limits.

The grammar covers the full beta document shape. The pure entry points accept ordinary binding steps. Schema retrieval is disabled.

## Replayable calls and reviews

`validate_execution(source)` returns a JSON inventory of the entry, the optional delivery step, all call positions and targets, and local submission positions. Resolve every listed target before starting an instance. `replay_execution(source, revision, instance, input_json, journal_json)` returns a JSON projection. Both functions take strings and return `Result<String, DefinitionError>`.

The host stores the immutable Definition revision and source, a unique instance ID, the exact entry input and the ordered version-1 journal. Supply the same values on recovery. Start with `{"version":1,"facts":[]}`. The projection is derived. The [review Definition](examples/review-handoff.yaml) and [ordered synthetic journal](tests/fixtures/review-journal.json) exercise registration, one addressed review, a formal Handoff, and required receipt registration.

```rust
let source = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/examples/review-handoff.yaml"));
let journal = include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/review-journal.json"));
let input = r#"{"matterId":"M-42","initialHandoffId":"H-0","amount":1.0000000000000001}"#;
let projection = flows_dsl::replay_execution(source, "review-v1", "sample-42", input, journal)?;
let result: serde_json::Value = serde_json::from_str(&projection).unwrap();
assert_eq!(result["status"], "completed");
assert_eq!(result["deliveryJson"], r#"{"amount":1.0000000000000001,"matterId":"M-42","predecessor":"H-0","receipt":"R-1"}"#);
# Ok::<(), flows_dsl::DefinitionError>(())
```

Run `cargo test --locked -p flows-dsl --test execution` from the workspace root to exercise every journal prefix, duplicate admissions and failure controls.

### Host protocol

Each fact has an `address` with `revision`, `instance`, and `position`, plus an `event` object. A top-level call uses its step ID as its position. A review uses `watcherId/localId`. In this slice each top-level step occurs once per instance.

| Event kind         | Additional fields   | Host evidence and result                                                                                                                                       |
| ------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dispatch`         |                     | Reserve a ready occurrence durably before invoking its returned target with its exact `inputJson`. Recovery shows `awaitingOutcome`.                           |
| `returned`         | `payloadJson`       | A reply from that invocation. Apply ordinary output binding and validation. An invalid return records a technical failure.                                     |
| `returnTooLarge`   |                     | The adapter received a reply whose UTF-8 JSON text exceeds 256 KiB. Record an ordinary `output:size` failure with this bounded receipt.                        |
| `confirmedFailure` |                     | The capability establishes a definite technical failure after invocation. An explicit `onFailure: tolerate` settles only that call, with no output or success. |
| `unknown`          |                     | The call may have taken effect. Record a failed execution with `execution:unknown_outcome`. The adapter owns reconciliation.                                   |
| `submission`       | `id`, `payloadJson` | One authorized submission to an accepting local step. Its input must pass the local Schema.                                                                    |

Check `calls[].state` before dispatch. Only the worker that newly reserves a `ready` call may initiate it. A crash between reservation and the external effect requires adapter evidence to resolve. Replaying a reservation, or receiving the same projection twice, grants no new attempt. The core performs no I/O.

Serialize admissions per instance, for example with a transaction that compares the expected journal revision, checks the candidate prefix, and atomically persists the accepted fact and derived changes. A rejected fact returns `Err` and leaves the previous prefix valid. A projection with `status: "failed"` is an accepted execution outcome and belongs in the history. The host owns authentication, durable inbox/outbox records, concurrency, and delivering each formal output once.

A submission ID identifies one fact at its original address. Equal JSON values for a known identity replay idempotently, including after closure. Changed content conflicts. Two distinct IDs with equal content each contribute one result while the wait accepts input. An invalid, early, or newly arriving late submission is rejected. Call outcomes are immutable per call address. Repeat malformed return text verbatim to replay that outcome.

The projection lists calls, waits with admission readiness and adopted count, selected Watcher exits, and tolerated failure addresses. `deliveryJson` appears when the one ordinary terminal output becomes available, including the string `"null"` for an actual JSON null. It remains visible if required work later fails. Only `status: "completed"` establishes successful completion. A closed or failed instance cannot admit new work. Preserve all fields ending in `Json` as text throughout host storage.

### Replay slice and bounds

- One inferred entry, unconditional dependencies, and at most one formal delivery. A completion-only call may be a separate required terminal. Calls support authored arguments, result bindings, output Schemas and the confirmed-failure policy.
- A Watcher directly observes one upstream output and accepts one kind of addressed local submission after that same source succeeds. The evaluator adopts the upstream output before exposing the local step for admission. The local step has an externally supplied input and a pure output binding. Every case uses `on` with the local ID and a case-local output. Evaluate cases in authored order on each fresh submission and freeze the selected exit and output together. A terminal Watcher requires an ordinary processing handoff.
- Each submitted fact forms its own batch. Multi-source races and simultaneous batches, timers, exit-filtered paths, imports, context, child invocations, loops, predicate calls and cancellation are outside this interface. Full two-stage orchestration and cross-host recovery require separate verification.
- Version 1 accepts JSON objects for the journal, facts, addresses and events. The complete wire document fits within 4 MiB and 256 facts. A dispatch reserves a fact slot and space for an escaped 256 KiB return. Later appends preserve those reservations. On `execution:journal_capacity` the host keeps the previous prefix and performs no new effect. Compact the JSON envelope for storage and retain the original payload text. Keep duplicate deliveries out of the stored journal once verified.
- The core checks capacity on each append. A long-lived wait or a long sequence of calls can exhaust the journal before another action is admitted. Revision, instance and submission IDs are nonempty and at most 256 UTF-8 bytes. Workers should bound evaluation time and memory.
