---
id: workspace.guidelines
title: Guidelines
summary: Use ordinary Markdown guidance for Human and Agent collaboration.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 150
---

# Guidelines

## Overview

Guidelines are ordinary Markdown files declared in `.forma.md` or space configuration. They provide soft collaboration rules, Human-readable background, and Agent workflows.

## Agent Skill

Read configured guidelines before editing shared workspace content. Treat them as context and procedure, not hidden system instructions.

For guideline-backed skills, put compact Agent instructions under `## Agent Skill`. `forma skills get <id>` uses that section by default when present, while `forma skills get <id> --full` returns the complete guideline.
