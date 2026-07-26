---
schemaVersion: 1
kind: view
title: Wide Table Pressure
description: Deliberately wide projection for local horizontal overflow and sticky-header validation.
mode: table
display:
    order: 20
source:
    type: pages
    taxonomy:
        spaces:
            - samples
table:
    columns:
        - field: fields.title
          label: Sample Title
        - field: fields.summary
          label: Detailed Summary
        - field: fields.stage
          label: Workflow Stage
        - field: fields.priority
          label: Priority
        - field: fields.area
          label: Validation Area
        - field: fields.owner
          label: Responsible Fixture Owner
        - field: fields.reviewer
          label: Evidence Reviewer
        - field: fields.longValue
          label: Deliberately Long Diagnostic or Path Value
        - field: fields.tags
          label: Tags
        - field: fields.relatedSamples
          label: Related Samples
sort:
    - field: fields.stage
      direction: asc
      order:
          - queued
          - active
          - review
          - blocked
          - done
    - field: fields.title
      direction: asc
---

# Wide Table Pressure

The table below should own horizontal overflow while the route remains page-scrollable.

<!-- forma:content -->

This post-projection note is the lower boundary for sticky header behavior.
