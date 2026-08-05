---
title: "Acknowledgement Window Regression Contract"
summary: "Stable commands, inputs, outputs, and failure conditions for the executable fixture."
type: regression-contract
status: verified
synthetic: "true"
engagementKey: ENG-SYN-001
commands:
    - node engineering/fixture/scripts/run-regression.mjs --config engineering/fixture/config/staging.json --input engineering/fixture/fixtures/staging-events.json
    - node engineering/fixture/scripts/run-regression.mjs --config engineering/fixture/config/production-naive.json --input engineering/fixture/fixtures/production-events.json
    - node engineering/fixture/scripts/run-regression.mjs --config engineering/fixture/config/production-adjusted.json --input engineering/fixture/fixtures/production-events.json
    - node --test engineering/fixture/tests/ack-window.test.mjs
expected:
    - fixture=ack-window profile=staging cases=4 passed=4 failed=0; exit 0
    - fixture=ack-window profile=production-naive cases=4 passed=2 failed=2; exit 1 by design
    - fixture=ack-window profile=production-adjusted cases=4 passed=4 failed=0; exit 0
failureConditions:
    - Invalid or missing JSON config/input.
    - Unexpected acceptance or rejection for a fixture case.
    - Replay protection omitted where the profile requires it.
    - A test process exits non-zero.
relatedTo:
    - tasks/run-regression
    - verifications/acknowledgement-window-validation
tags:
    - regression
    - acceptance
---

# Acknowledgement Window Regression Contract

The runner's one-line summaries are intentionally stable enough to quote in a README or article. Node's full TAP output is not treated as a stable documentation contract.
