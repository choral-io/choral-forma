---
title: "Acknowledgement Window Validation"
summary: "The synthetic end-to-end validation record for the fixture and Forma workspace gate."
type: verification
status: passed-with-limits
synthetic: "true"
engagementKey: ENG-SYN-001
result: passed-with-limits
exitStatus: "staging=0; production-naive=1 expected; production-adjusted=0"
commands:
  - node engineering/fixture/scripts/run-regression.mjs --config engineering/fixture/config/staging.json --input engineering/fixture/fixtures/staging-events.json
  - node engineering/fixture/scripts/run-regression.mjs --config engineering/fixture/config/production-naive.json --input engineering/fixture/fixtures/production-events.json
  - node engineering/fixture/scripts/run-regression.mjs --config engineering/fixture/config/production-adjusted.json --input engineering/fixture/fixtures/production-events.json
  - node --test engineering/fixture/tests/ack-window.test.mjs
expected:
  - staging output has 4 passed and 0 failed
  - naive production output has 2 passed and 2 failed by design
  - adjusted production output has 4 passed and 0 failed
  - Forma summary/check/health have zero errors and warnings
failureConditions:
  - Any positive or adjusted fixture path exits non-zero.
  - The expected negative path exits zero.
  - Any cross-workspace or sensitive-data boundary rule fails.
relatedTo:
  - tasks/run-regression
  - tasks/validate-delivery
  - communications/validation-review
sources:
  - engineering/regression-test
  - decisions/use-replay-guard-and-profile-specific-window
tags:
  - verification
  - evidence
---

# Acknowledgement Window Validation

The result is a local synthetic demonstration, not a customer production result. It verifies that the project workspace can preserve facts, decisions, ordinary engineering assets, executable checks, and limits together.
