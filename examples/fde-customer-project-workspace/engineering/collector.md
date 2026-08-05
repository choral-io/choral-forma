---
title: "Acknowledgement Collector Artifact Card"
summary: "Forma context for the ordinary collector implementation and its deterministic fixture."
type: engineering-artifact
status: verified
synthetic: "true"
engagementKey: ENG-SYN-001
artifactKind: markdown-context-card
fixturePaths:
    - engineering/fixture/src/ack-window.mjs
    - engineering/fixture/config/staging.json
    - engineering/fixture/tests/ack-window.test.mjs
relatedTo:
    - decisions/use-replay-guard-and-profile-specific-window
    - tasks/implement-ack-window
tags:
    - engineering
    - fixture
---

# Acknowledgement Collector Artifact Card

The implementation is ordinary Node code. This card explains why the code exists and where the local fixture lives; it is not the implementation or a substitute for its tests.
