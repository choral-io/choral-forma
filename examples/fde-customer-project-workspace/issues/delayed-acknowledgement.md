---
title: "Delayed Acknowledgement Window Mismatch"
summary: "A synthetic issue where the current fixed-window assumption does not distinguish environment-specific retry behavior."
type: issue
status: investigated
synthetic: "true"
engagementKey: ENG-SYN-001
customerKey: C-017
environment: staging
sources:
    - communications/discovery-call
relatedTo:
    - asks/acknowledgement-window
    - engineering/config
    - proposals/environment-aware-ack-window
tags:
    - issue
    - environment-difference
---

# Delayed Acknowledgement Window Mismatch

The observed staging case is compatible with a 120-second boundary, but a production-like burst/retry case shows that the number and replay policy must be revalidated rather than copied.
