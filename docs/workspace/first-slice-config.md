---
id: workspace.first-slice-config
title: First-Slice Config
summary: Minimal config syntax for the first useful Forma content group.
audience:
    - human
    - agent
surfaces:
    - docs
    - skill
order: 105
---

# First-Slice Config

## Purpose

Use this doc when creating the first content group after `forma init`. It is the short path for a small no-example workspace slice.

Load `workspace.configuration` only when you need runtime values, named types, migration details, or full reference behavior.

## Root Config

Root `.forma.md` is the only configuration entry point. Keep config files explicit through `imports`; do not infer spaces from directory names.

```md
---
schemaVersion: 1
workspace:
    name: "Lab Calibration"
    canonicalLanguage: "en"
    supportedLanguages:
        - "en"
    timezone: "UTC"
runtime:
    values:
        currentDateTime:
            kind: currentDateTime
        workspaceRoot:
            kind: workspaceRoot
imports:
    - ".forma/spaces/*.md"
---

# Lab Calibration
```

Top-level field order: `schemaVersion`, `workspace`, `runtime`, `imports`, `guidelines`, then `types`.

## Taxonomy And Space

Declare the primary taxonomy before its terms:

```md
---
schemaVersion: 1
kind: taxonomy
id: spaces
title: Spaces
mode: primary
---
```

Declare one first content group as a `kind: term` node:

```md
---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Calibrations
include:
    - "calibrations/**/*.md"
create:
    directory: calibrations
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/calibration.md
    inputs:
        title:
            required: true
        slug:
            default: "{{ input.title }}"
            transform: slugify
schema:
    type: object
    fields:
        title:
            type: string
        summary:
            type: string
---
```

`taxonomy: spaces` projects the term into `spaces` in `forma config inspect --json`. Names such as tasks, members, notes, or projects are user-defined terms, not Forma built-ins.

## Verify

After editing config, run:

```sh
forma config inspect --json
forma check --json
```

Then create two sample entries, run `forma list --space <space-id> --json`, inspect one entry, and finish with `forma workspace health --json`.
