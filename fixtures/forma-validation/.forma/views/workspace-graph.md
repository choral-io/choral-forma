---
schemaVersion: 1
kind: view
title: Validation Sample Graph
description: Relationship graph over reusable Samples with explicit taxonomy-driven node colors.
mode: graph
display:
    order: 40
source:
    type: pages
    taxonomy:
        spaces:
            - samples
graph:
    presentation:
        nodes:
            colorBy:
                taxonomy: areas
    edges:
        - source: body
          intent: link
          label: links to
        - source: body
          intent: embed
          label: embeds
        - source: fields
          field: relatedSamples
          label: related sample
---

# Validation Sample Graph

Node classification comes only from the explicitly configured `areas` taxonomy.

<!-- forma:content -->

Use selection and expanded inspection without treating this graph as a separate global product surface.
