---
schemaVersion: 1
kind: view
title: Validation Case Matrix
description: Searchable overview of the first-batch validation specifications.
mode: table
display:
    order: 10
source:
    type: pages
    taxonomy:
        spaces:
            - cases
table:
    columns:
        - field: fields.title
          label: Case
        - field: fields.area
          label: Area
        - field: fields.priority
          label: Priority
        - field: fields.automation
          label: Automation
        - field: fields.surfaces
          label: Surfaces
        - field: fields.status
          label: Status
        - field: fields.assertionIds
          label: Stable Assertions
sort:
    - field: fields.priority
      direction: asc
      order:
          - P0
          - P1
          - P2
          - P3
    - field: fields.title
      direction: asc
---

# Validation Case Matrix

This introduction belongs to the document and defines the upper projection boundary.

<!-- forma:content -->

The generated table must end before this note; sticky presentation must not escape the projection boundary.
