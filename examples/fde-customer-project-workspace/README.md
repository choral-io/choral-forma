# FDE Synthetic Customer Project Workspace

This is a runnable, synthetic example of one customer project workspace. It demonstrates customer facts, external communication indexes, engineering context, ordinary code/configuration/tests, asks, issues, proposals, decisions, tasks, runbooks, guidelines, and verification evidence.

The folders are team conventions. Each stable record type has an explicitly configured Forma content group with its own include pattern, schema, create template, and partition guidance; Forma does not provide customer, ask, issue, or engineering domain types. Read `guidelines/partition-contracts.md` before routing a new record. The `.mjs` and `.json` files under `engineering/fixture/` are ordinary unmanaged engineering assets; the Markdown engineering cards do not replace them.

`ENG-SYN-001` is a narrative association key only. This workspace does not import, join, authorize, synchronize, or promote content across workspaces.

## Run

Run from the repository root with the current checkout's Forma CLI:

```sh
cargo run -q -p forma-cli -- --workspace examples/fde-customer-project-workspace config summary --sources --json
cargo run -q -p forma-cli -- --workspace examples/fde-customer-project-workspace check --json
cargo run -q -p forma-cli -- --workspace examples/fde-customer-project-workspace workspace health --json
cargo run -q -p forma-cli -- --workspace examples/fde-customer-project-workspace workspace explain customers/c-017.md --json
cargo run -q -p forma-cli -- --workspace examples/fde-customer-project-workspace create asks --input title='Synthetic preview ask' --preview --json
```

The preview must report `status: passed`, zero errors/warnings, `target.writable: true`, `target.conflict: false`, and `target.path: asks/synthetic-preview-ask.md`; it must not create a file. `asks` is the configured content group for the `asks/` partition, not a Forma built-in domain.

Run from this workspace root for the engineering fixture:

```sh
node engineering/fixture/scripts/run-regression.mjs \
  --config engineering/fixture/config/staging.json \
  --input engineering/fixture/fixtures/staging-events.json
node engineering/fixture/scripts/run-regression.mjs \
  --config engineering/fixture/config/production-naive.json \
  --input engineering/fixture/fixtures/production-events.json
node engineering/fixture/scripts/run-regression.mjs \
  --config engineering/fixture/config/production-adjusted.json \
  --input engineering/fixture/fixtures/production-events.json
node --test engineering/fixture/tests/ack-window.test.mjs
```

Stable runner output:

```text
fixture=ack-window profile=staging cases=4 passed=4 failed=0
fixture=ack-window profile=production-naive cases=4 passed=2 failed=2
fixture=ack-window profile=production-adjusted cases=4 passed=4 failed=0
```

The staging and adjusted commands exit `0`. The intentionally incorrect production-naive command exits `1`; a missing/invalid config or input and any expected/actual mismatch also exit `1`.

## Workflow

1. Read `guidelines/partition-contracts.md`, then inspect the synthetic customer facts and external source indexes.
2. Compare the ask and issue with the environment record.
3. Review the proposal and human-confirmed decision.
4. Run the ordinary code/configuration/regression fixture.
5. Record command evidence, limits, and the next human approval in the verification entry.

The example does not send notifications, update a project-management system, access external records, or publish a production change.
