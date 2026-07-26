---
schemaVersion: 1
kind: validation-sample
title: Repository Markdown Source of Truth
summary: Workspace record asserting that committed Markdown and explicit Forma configuration remain the durable source of truth.
stage: queued
priority: P0
area: workspace
owner: "Fatima Zahra"
reviewer: "Chen Wei"
longValue: "source-of-truth://repository-markdown-plus-explicit-schema/no-hidden-proprietary-content-store"
tags:
    - files-first
    - source-of-truth
    - workspace
relatedSamples:
    - "samples/workspace/workspace-config-inspection"
---

# Repository Markdown Source of Truth

All durable validation inputs in this corpus are ordinary repository files. The WebApp and CLI must read the same explicit workspace model.

Continue with [[samples/workspace/workspace-config-inspection]].
