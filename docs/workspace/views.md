---
id: workspace.views
title: Views
summary: Define saved read-only projections over workspace pages.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 140
---

# Views

## Overview

Views are configured Markdown nodes that describe read-only projections such as lists, tables, kanban boards, and graphs.

## Agent Guidance

Add views after the underlying spaces and fields exist. Treat views as projections, not as hidden state.

Render configured views with `forma view render <view-id-or-path> --json`. Use this for lists, tables, kanban boards, and graphs instead of introducing workflow-specific read commands.
