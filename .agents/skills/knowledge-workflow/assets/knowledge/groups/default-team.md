---
scope: project
type: team
group_id: "{{default_group_id}}"
display_name: Default Team
owners:
  - "[[groups/{{default_group_id}}]]"
members: []
tags:
  - group
  - team
---

# Default Team

## Purpose

This group represents the default responsibility group for project knowledge ownership, fallback review, and workflow governance when no more specific member or group owner is assigned.

Use `[[groups/{{default_group_id}}]]` for tool-written shared ownership that belongs to the default group. Manual `[[{{default_group_id}}]]` references are acceptable when they resolve unambiguously to this group.
