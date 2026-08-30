---
id: agents.workspace-design-discovery
title: Workspace Design Discovery
summary: Guide Agents through business-domain discovery before choosing the first Forma workspace slice.
audience:
    - agent
surfaces:
    - docs
    - skill
skill:
    id: forma-workspace-design
    title: Forma Workspace Design
    description: Discover a real content workflow and define one small, approved Forma workspace slice before configuration.
    order: 10
order: 205
---

# Workspace Design Discovery

## Agent Skill

Use this only when the human asks to design a workspace, understand a business domain, or plan a content system. Do not load this doc for read-only health, list, inspect, or view tasks.

Use an already accepted brief or requirements directly. Ask only questions whose answers could change the approved first slice; do not reopen decisions or expand the scope.

Clarify, when still uncertain:

- the durable content people need to create, find, compare, or review;
- fields or lifecycle values needed now;
- relationships that must exist now versus those that can wait;
- repository inclusion or access boundaries. A path name is not a privacy guarantee.

Summarize the resulting first slice in the human's language: its purpose, configured space, minimal fields, deferred relationships or slices, and verification path. Recommend a small independently useful slice when helpful, but do not require a fixed number of entries, templates, or follow-up stages.

When the implementation scope is authorized, load `forma-workspace-bootstrap`.

### Completion Criteria

Stop when the first slice is sufficiently specified to configure and verify within the user's scope. Do not edit configuration during discovery.
