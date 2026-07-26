---
schemaVersion: 1
kind: validation-sample
title: Workspace Configuration Inspection
summary: Stable record for checking resolved imports, taxonomies, spaces, schemas, templates, guidelines, and views.
stage: review
priority: P1
area: workspace
owner: "Taylor Brooks"
reviewer: "Riley Kumar"
longValue: "forma://config.inspect?imports=spaces-and-views&taxonomies=spaces-and-areas&diagnostics=zero"
tags:
    - config
    - cli
    - schema
relatedSamples:
    - "samples/workspace/healthy-workspace-baseline"
---

# Workspace Configuration Inspection

Run:

```sh
forma config inspect --json
```

The resolved model should contain two taxonomies, two content spaces, four views, two templates, one guideline, and the named types used by Case and Sample schemas.

Continue with [[samples/workspace/healthy-workspace-baseline]].
