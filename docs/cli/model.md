---
id: cli.model
title: forma model
summary: Guide explicit modeling choices into a reviewed, create-only first content group.
audience:
    - human
    - agent
surfaces:
    - docs
    - help
commands:
    - forma model
    - forma model guide
    - forma model prepare
    - forma model apply
order: 34
---

# forma model

## Overview

`forma model guide` asks what content you need, which fields matter, how to retrieve it, and where its files belong. It compiles one content group, a taxonomy, a structured Markdown template, and a table view. It displays complete files and requires the exact plan ID before creating them. Choose `edit` to revise the choices and review a new plan, or press Enter to cancel. After application, the guide can preview, create, and retrieve your first entry with a separate explicit confirmation.

This experimental Core/CLI flow supports text and date fields in an initialized workspace with an empty configured corpus. The selected content directory must contain no files. It does not inventory unrelated directories, import existing content, infer a model from natural language, fetch external sources, or expose modeling RPC methods. An Agent may propose choices from a conversation; those proposals do not establish human confirmation.

```sh
forma init --name "Study"
forma model guide
```

## Structured Input

For reproducible or Agent-assisted use, save explicit choices as JSON:

```json
{
    "outcome": "Compare observations by method",
    "taxonomyId": "collections",
    "groupId": "observations",
    "title": "Study observations",
    "fields": {
        "method": {
            "kind": "text",
            "label": "Method",
            "required": false,
            "reason": "Compare how observations were made"
        }
    },
    "viewColumns": ["method"],
    "layout": {
        "taxonomyFile": ".forma/collections.md",
        "groupFile": ".forma/spaces/observations.md",
        "templateFile": "scaffolds/observation.md",
        "viewFile": ".forma/views/observations.md",
        "contentDirectory": "records"
    }
}
```

These names and paths are choices, not built-ins. This first compiler reserves `title` and `slug` for its required title and filename input. Control files must be reachable through the workspace's existing imports. A template may be outside imports when explicitly referenced by `create.template`. The entry configuration is never rewritten to add imports.

```sh
forma model prepare --choices choices.json --output plan.json
# Review every file and the choices in plan.json, then supply its exact id:
forma model apply --plan plan.json --confirm "gm2-<exact-plan-digest>"
forma create observations --input title="First observation" --preview --json
forma create observations --input title="First observation" --json
forma inspect records/first-observation.md --json
forma list --space observations --json
forma view render .forma/views/observations --json
```

Keep choices and plans outside configured inputs and the proposed content directory. `--output` creates a new file and refuses an existing destination; omit it to print JSON. `prepare` writes validation copies to a private temporary directory, removes them afterward, and does not change the target workspace. It preserves relevant empty directories and creates a synthetic entry only in that private copy, then verifies its classification and presence in list/table results. A free deterministic filename avoids directory conflicts. No sample entry is written to the target workspace.

## Confirmation And Recovery

Version-2 plans use `schemaVersion: 2` and a `gm2-…` ID. The SHA256 plan ID binds a non-path `workspaceId`, explicit choices, complete generated files, verification steps, advisories, and scoped preconditions. `workspaceId` is a domain-separated digest of the internally resolved canonical root; the absolute host path is not serialized. Two workspaces with identical files can have identical preconditions, so this separate binding remains necessary. Old experimental `gm1` plans must be prepared and reviewed again. Preconditions capture configured inputs by content, matching control files, the selected content directory, target absence, and target parent types. Unrelated files outside those scopes are not inventoried. The ID is an integrity identifier, not proof of human consent or a secret token.

Apply resolves the workspace boundary once, revalidates the model and compares the entire plan on that boundary, then writes exactly its reviewed files through the same boundary. Retargeting the original workspace alias does not redirect these writes. A changed plan, configured input, target conflict, different workspace, or changed relevant directory requires preparing and reviewing a new plan. Partial choices must be edited in the choices file and recompiled; do not remove individual files from a plan. Successful application requires exact written contents and scoped input checks plus configuration, health, and actual creation/inspection/list/table validation in a fresh temporary copy. This representative check does not prove all future input values or filenames.

There is no multi-file filesystem transaction or inode lock against external writers replacing the canonical root itself. A failure after writing begins returns `partial` or `verificationFailed`, an error, written paths, the possible incomplete target, and observed new directories. It never deletes files automatically. Preserve and inspect those paths and compare them with the reviewed plan; arrange any cleanup separately, then prepare a fresh plan. Replaying a completed or partially applied plan cannot overwrite its files. An `applied` result means the group is ready; creating and retrieving real content is a subsequent step, offered by the interactive guide.

## Distribution Reminders

Plans targeting `.forma/local/` include a non-blocking `modeling.reviewDistribution` advisory; the guide displays it before confirmation. Such paths may be omitted by a workspace's collaboration conventions. Verify that your distribution process includes every required configuration and referenced file. The advisory does not claim to have checked Git-ignore rules and does not change runtime loading, validity, or privacy semantics. A directory name is never a runtime permission rule.

## Agent Skill

Prepare choices from explicit user requirements. Distinguish inferred fields from confirmed choices, present their reasons and complete file contents, and obtain authorization for the exact plan before invoking apply. Never supply the generated plan ID as self-approval. Use a fresh plan after edits or workspace changes. Report partial files and failed validation as incomplete work.
