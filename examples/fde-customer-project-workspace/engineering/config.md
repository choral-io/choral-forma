---
title: "Acknowledgement Window Configuration Profiles"
summary: "Synthetic staging and production profiles demonstrate why a fixed threshold is not a reusable conclusion."
type: engineering-artifact
status: verified
synthetic: "true"
engagementKey: ENG-SYN-001
fixturePaths:
  - engineering/fixture/config/staging.json
  - engineering/fixture/config/production-naive.json
  - engineering/fixture/config/production-adjusted.json
relatedTo:
  - issues/delayed-acknowledgement
  - proposals/environment-aware-ack-window
  - decisions/use-replay-guard-and-profile-specific-window
tags:
  - configuration
  - environment-difference
---

# Acknowledgement Window Configuration Profiles

- Staging accepts the 120-second boundary and rejects stale replay events.
- The deliberately naive production profile shows why the staging setting cannot be copied without checking burst/retry behavior.
- The adjusted production profile uses a 90-second window and replay protection.
