---
id: index
title: Choral Forma Documentation
summary: Product documentation entry point for using Choral Forma.
audience:
    - human
    - agent
surfaces:
    - docs
order: 0
---

# Choral Forma Documentation

## Overview

Forma organizes Markdown content through explicit configuration. Spaces, schemas, templates, views, and guidelines describe your workflow; domain names and directory layouts come from your workspace, not a built-in project model.

Start with [Getting Started](getting-started.md).

## Workspace Guides

- [First content group](workspace/first-slice-config.md)
- [Configuration](workspace/configuration.md) and [spaces](workspace/spaces.md)
- [Schemas](workspace/schemas.md) and [templates](workspace/templates.md)
- [Views](workspace/views.md) and [guidelines](workspace/guidelines.md)

## Commands

- Set up: [init](cli/init.md), [model](cli/model.md), [config](cli/config.md)
- Maintain content: [create](cli/create.md), [check](cli/check.md), [workspace](cli/workspace.md), [tools](cli/tools.md)
- Browse and publish: [view](cli/view.md), [serve](cli/serve.md), [site build](cli/site.md)
- Discover guidance: [docs](cli/docs.md), [skills](cli/skills.md)
- Update the CLI: [self-update](cli/self-update.md)

## Agent Workflows

Start with [Forma CLI Core](agents/forma-cli-core.md), then load the relevant workflow: [design](agents/workspace-design-discovery.md), [bootstrap](agents/workspace-bootstrap.md), [guided modeling](cli/model.md), [maintenance](agents/workspace-maintenance.md), or [troubleshooting](agents/workspace-troubleshooting.md). [Example-backed setup](agents/workspace-example-accelerator.md) is optional.

## Read From The CLI

Use `forma docs list --json` to discover the documentation embedded in your installed binary, then `forma docs get <id>` to read a page. Built-in docs work without workspace configuration. Use `forma skills list --json` to discover built-in skills and the current workspace's configured guideline skills.
