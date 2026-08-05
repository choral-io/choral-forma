---
title: "Use Replay Guard and Profile-Specific Window"
summary: "Confirm the synthetic implementation boundary after reviewing the proposal and failure path."
type: decision
status: confirmed
synthetic: "true"
engagementKey: ENG-SYN-001
sources:
    - proposals/environment-aware-ack-window
    - issues/delayed-acknowledgement
relatedTo:
    - tasks/implement-ack-window
    - runbooks/investigate-delayed-acknowledgement
tags:
    - decision
    - boundary
---

# Use Replay Guard and Profile-Specific Window

The synthetic decision is to keep the profile-specific window and replay guard in the fixture. Applying any production setting remains a human-approved, current-environment decision outside this example.
