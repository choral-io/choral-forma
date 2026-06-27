---
id: cli.serve
title: forma serve
summary: Start the local read-only Forma WebApp and RPC server.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma serve
order: 50
---

# forma serve

## Overview

`forma serve` starts a local server for browsing the configured workspace through the read-only WebApp.

## CLI Help

Use `forma serve` to start the local Forma WebApp and RPC server for the current workspace. Use `--bind` to choose the loopback address and port.

## Agent Guidance

Use server startup only when browser validation is required and the human has approved local port binding.
