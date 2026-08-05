---
scope: workspace
title: "{{ input.title }}"
summary: "{{ input.summary }}"
type: guideline
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
relatedTo: []
---

# {{ input.title }}

{{ input.summary }}

## Guideline boundary

State how an Agent should read and use the workspace. Separate instructions from customer facts and approvals.
