---
scope: workspace
title: "{{ input.title }}"
summary: "{{ input.summary }}"
type: practice-guideline
status: "{{ input.status }}"
synthetic: "true"
engagementKey: ENG-SYN-001
tags: []
skill:
    id: "{{ input.slug }}"
    title: "{{ input.title }}"
    description: "{{ input.summary }}"
    projection: section
    order: 10
sources: []
relatedTo: []
---

# {{ input.title }}

{{ input.summary }}

## Guideline boundary

Use reviewed practice conditionally. Read current project facts and revalidate before reuse.
