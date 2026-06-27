---
id: cli.view
title: forma view
summary: Render configured workspace views.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma view render
order: 70
---

# forma view

## Overview

`forma view render <view-id-or-path> --json` renders a configured view as a read-only projection over workspace content.

## CLI Help

Use this command for configured lists, tables, kanban boards, and graphs. A view locator may be a configured view id such as `.forma/views/task-board`, or the matching Markdown path such as `.forma/views/task-board.md`.

## Agent Guidance

Prefer `forma view render <view-id-or-path> --json` over workflow-specific read commands when the workspace already defines a view for the workflow.
