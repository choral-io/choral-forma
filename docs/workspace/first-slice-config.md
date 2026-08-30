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

Stay on this doc for one simple content group with scalar fields. Read [Workspace Configuration](configuration.md) (`workspace.configuration`) before adding runtime values, named types, entry references, or migration corrections.

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
imports:
    - ".forma/spaces/*.md"
---

# Lab Calibration
```

## Taxonomy And Space

Declare the primary taxonomy in `.forma/spaces/index.md` before adding its terms:

```md
---
schemaVersion: 1
kind: taxonomy
id: spaces
projection: contentGroups
title: Spaces
mode: primary
---
```

Save the first content group as `.forma/spaces/calibrations.md`. The filename supplies its id when `id` is omitted:

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

The taxonomy-level `projection: contentGroups` makes its terms appear in `forma config summary --json` under `contentGroups`. `taxonomy: spaces` only references this example's configured taxonomy id. Names such as notes or collections are user-defined terms, not Forma built-ins.

## Verify

After editing config, run:

```sh
forma config summary --sources --json
forma check --json
```

Use `forma config inspect --json` only when debugging the authored effective configuration. Finish with `forma workspace health --json` when placement, links, or configured relationships need validation.
