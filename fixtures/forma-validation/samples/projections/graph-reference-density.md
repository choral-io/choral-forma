---
schemaVersion: 1
kind: validation-sample
title: Graph Reference Density and One-Hop Selection
summary: Deliberately connected node used to validate bounded sizing, edge provenance, adjacent-node focus, and deterministic graph layout inputs.
stage: blocked
priority: P1
area: projections
owner: "Mateo Silva"
reviewer: "Priya Nandakumar"
longValue: "graph://dense-node?bodyLinks=3&fieldReferences=3&selection=one-hop&scale=bounded-logarithmic"
tags:
    - graph
    - dense-node
    - selection
relatedSamples:
    - "samples/workspace/repository-markdown-source"
    - "samples/workspace/workspace-config-inspection"
    - "samples/navigation/mobile-navigation-dialog"
---

# Graph Reference Density and One-Hop Selection

This entry has multiple typed references and body links so it becomes a visibly connected node without requiring generated data.

- [[samples/workspace/repository-markdown-source]]
- [[samples/workspace/workspace-config-inspection]]
- [[samples/navigation/mobile-navigation-dialog]]

Repeated semantic references may affect bounded node importance, but one-hop focus must still contain unique adjacent Pages.
