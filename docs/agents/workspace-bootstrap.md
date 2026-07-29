---
id: agents.workspace-bootstrap
title: Workspace Bootstrap
summary: Guide Agents through turning an initialized empty workspace into a useful content workspace.
audience:
    - agent
surfaces:
    - docs
    - skill
skill:
    id: forma-workspace-bootstrap
    title: Forma Workspace Bootstrap
    description: Bootstrap one approved content workflow into a verified first Forma workspace slice after initialization.
    order: 20
order: 210
---

# Workspace Bootstrap

## Agent Skill

After `forma init`, help the human turn one real content workflow into a small workspace. The default path is no-example bootstrap: the human should describe their business or personal context in ordinary language; the Agent should translate that context into explicit Forma config only after confirming the first slice.

Do not assume that tasks, notes, members, or guidelines are required in every workspace.

### Entry Conditions

Ask short questions until the Human can name one durable content workflow, provide two or three real examples, and explain what they need to find, compare, create, or review. Stop when one content group, one template, and one verification path are clear.

If discovery has not produced an accepted first-slice brief, load `forma-workspace-design` first. Do not design the whole workspace during bootstrap.

### Required Dry Run

Before writing shared config or content files, propose one first slice and wait for approval.

Use this compact format:

| Field                   | Required content                                                     |
| ----------------------- | -------------------------------------------------------------------- |
| Goal                    | The human workflow being organized first                             |
| Real examples           | Two or three item examples from the human's domain                   |
| Space                   | Space id, title, directory, and include pattern                      |
| Schema                  | Minimal fields needed for listing, comparing, creating, or reviewing |
| Relationships           | Reference fields to add now, or relationships explicitly deferred    |
| Template                | Template path, filename pattern, required inputs, and default values |
| Optional view/guideline | Add only if needed for the first workflow                            |
| Files to create         | Config, template, view/guideline, and sample entry paths             |
| Verification            | Exact `forma` commands to run after edits                            |
| Context loaded          | Skill and docs used for this slice                                   |

Keep the dry run small enough for the human to reject or adjust. If the human describes many content groups, choose only the first durable group and defer the rest.

### Execution Sequence

For the first content group:

1. Load `workspace.first-slice-config`, `workspace.spaces`, `workspace.schemas`, and `workspace.templates` with `forma docs get`.
2. Confirm the first-slice dry run with the human.
3. Add or extend the configured taxonomy, one included term/content group, its minimal schema, and one referenced create template.
4. Run `forma config summary --group <content-group-id> --sources --json` and `forma check --json`; resolve configuration diagnostics before creating content.
5. Preview one sample with `forma create <space-id> ... --preview --json`. Confirm the resolved target, rendered metadata, boundary result, conflicts, and diagnostics.
6. Create only the approved sample with the same inputs, then verify it through `list`, `inspect`, and `workspace explain`.
7. Add a guideline or view only if the first workflow needs it now; load its dedicated reference first.
8. Run `forma workspace health --json` and explain warnings against the Human's expected relationships.

### Guardrails

- Use the Human's domain language for configured ids and titles.
- Treat tasks, notes, members, guidelines, and a taxonomy id named `spaces` as examples, not Forma built-ins.
- Start with one configured space, one template, and two sample entries; defer cross-space references until both sides exist.
- Do not copy example content unless the Human explicitly requested that source.
- Treat isolated-page health findings as relationship feedback unless a connected graph was expected.
- Keep material requiring privacy outside configured workspace inputs until repository, hosting, and access controls define its handling.

### Completion Criteria

The first slice is complete only when the Human approved the dry run, the effective configuration resolves the intended content group and create contract, an approved sample can be previewed and created, list and inspect operations return it, checks pass, and remaining health warnings are explained.

## Reference

### Discovery Prompts

Use only the questions that can change the first slice:

- What are you trying to organize first?
- What are two or three real examples?
- What must people find, compare, create, or review later?
- Which fields support those actions?
- Which relationships and repeated operating rules are required now?
- Which files are intended for repository inclusion?

### Translation Pattern

| Human description              | Workspace artifact                                |
| ------------------------------ | ------------------------------------------------- |
| A durable category of content  | configured space                                  |
| Fields readers compare or sort | schema fields and display conventions             |
| A repeatable page shape        | create template                                   |
| A relationship between pages   | `entryRef`/list fields or Markdown links          |
| A saved list, table, board     | configured view                                   |
| Editing or review procedure    | guideline Markdown, attached globally or by space |

### Configuration Details

A taxonomy that provides schema-bearing content groups declares `projection: contentGroups`; its id is workspace-configured and does not need to be `spaces`. Each included `kind: term` node names its taxonomy explicitly.

Before adding a cross-content reference field, load `workspace.configuration`, define an `entryRef` named type in `.forma.md` or an imported config node, and use that named type in the space schema. Do not write `target: member` or infer a target from a directory name.

### Optional Pattern

Use this only as a pattern check after the human's own first slice is clear. Do not copy it as the default workspace shape.

If the human says they run a consulting practice and need clients, engagements, meeting notes, and decisions, do not build all four categories immediately. A reasonable first slice might be `clients`:

- space id: `clients`;
- directory: `clients`;
- key fields: `name`, `summary`, `status`, `primaryContact`, `tags`;
- template: `.forma/spaces/templates/client.md`;
- first verification: create two client pages, list `clients`, inspect one page, and run `forma check --json`.

Implement that shape with the syntax from `workspace.first-slice-config`, `workspace.spaces`, `workspace.schemas`, and `workspace.templates`. After it works, ask whether the next slice should be `engagements`, `meeting-notes`, or `decisions`. Add reference fields only when the related space exists.
