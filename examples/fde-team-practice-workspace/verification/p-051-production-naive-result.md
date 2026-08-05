---
title: "P-051 Production Naive Counterexample"
summary: "Stable synthetic result manifest retaining the deliberately failing naive profile."
type: verification-result
status: failed-by-design
synthetic: "true"
engagementKey: ENG-SYN-001
projectKey: P-051
environment: production-like
result: failed-by-design
exitStatus: "1"
actual:
    - fixture=ack-window profile=production-naive cases=4 passed=2 failed=2
counterexample: "The 120-second profile without replay protection accepts burst-late and retry-replay cases that should be rejected."
projectRef: projects/p-051
relatedTo: []
tags:
    - verification
    - counterexample
---

# P-051 Production Naive Counterexample

The failure is retained as a review input. It is not hidden to make the two source projects look equivalent.
