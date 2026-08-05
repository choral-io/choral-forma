---
schemaVersion: 1
kind: view
mode: list
title: Verification Evidence
display:
    order: 30
description: Verification entries and engineering cards that explain the executable fixture.
source:
    type: pages
    taxonomy:
        spaces:
            - verifications
            - engineering
sort:
    - field: fields.result
      direction: asc
    - field: source.path
      direction: asc
---

# Verification Evidence

The actual fixture output is produced by Node; this view only projects the Markdown context around it.

<!-- forma:content -->
