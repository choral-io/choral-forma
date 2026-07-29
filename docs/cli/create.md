---
id: cli.create
title: forma create
summary: Preview or create one entry from a configured content-group contract.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma create
order: 35
---

# forma create

## Overview

`forma create <content-group-id>` resolves configured inputs, defaults, runtime values, output path, and template content before creating one entry.

Use `--preview` to run the same planning path without creating directories or files. `--dry-run` is an alias for `--preview`.

```sh
forma create notes --input title="Release notes" --preview --json
```

The preview returns:

- the resolved target path, content group, and template;
- `target.conflict` and `target.writable`;
- resolved inputs and their explicit/default sources;
- the rendered Markdown source, frontmatter, and body;
- Markdown and schema diagnostics.

`target.writable` records that the resolved path passed the preview's current workspace-boundary and conflict checks. It is not a guarantee against later permission changes or another writer winning a race. The top-level status reports rendered-content validation. A preview can therefore be writable while still failing schema validation. Treat that as a content problem to fix before creating; it does not redefine the compatibility behavior of an existing `forma create` installation.

## Agent Skill

Before an approved create operation, run the preview with the same content group and inputs. Show the resolved path and any diagnostics. Continue with the non-preview command only when the target is writable, validation is acceptable, and the human has authorized the write.

Preview is advisory: rerun it when relevant config, templates, runtime inputs, or the target path may have changed.
