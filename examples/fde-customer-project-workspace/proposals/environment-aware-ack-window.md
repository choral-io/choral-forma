---
title: "Environment-Aware Acknowledgement Window"
summary: "Compare a fixed threshold with a profile-specific threshold plus replay protection."
type: proposal
status: approved-with-limits
synthetic: "true"
engagementKey: ENG-SYN-001
sources:
  - issues/delayed-acknowledgement
  - engineering/config
relatedTo:
  - decisions/use-replay-guard-and-profile-specific-window
tags:
  - proposal
  - human-review
---

# Environment-Aware Acknowledgement Window

The proposed reusable mechanism is an investigation sequence: inspect the environment, select a profile-specific window, and enable replay protection. It is not a universal 120-second setting.
