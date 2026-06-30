---
id: cli.init
title: forma init
summary: Create the minimal workspace bootstrap in a project directory.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma init
order: 20
---

# forma init

## Overview

`forma init` creates only the minimum files needed for Forma and an Agent runtime to continue setup.

## CLI Help

Run `forma init` from the target project directory. The command writes `.forma.md` and `.agents/skills/forma-cli/SKILL.md` when those paths do not already exist.

## Agent Guidance

Do not create getting-started content, `skills/forma-cli/SKILL.md`, or `AGENTS.md` as part of the init step. After init, load `forma-cli-core`; if the human wants workspace setup, use the no-example first-slice path instead of copying example content.
