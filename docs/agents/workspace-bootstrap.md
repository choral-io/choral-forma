---
id: agents.workspace-bootstrap
title: Workspace Bootstrap
summary: Guide Agents through turning an initialized empty workspace into a useful content workspace.
audience:
    - agent
surfaces:
    - docs
    - skill
order: 210
---

# Workspace Bootstrap

## Agent Guidance

After `forma init`, help the human turn one real content workflow into a small workspace. The default path is no-example bootstrap: the human should describe their business or personal context in ordinary language; the Agent should translate that context into explicit Forma config only after confirming the first slice.

Do not assume that tasks, notes, members, or guidelines are required in every workspace.

## Human Discovery

Ask short questions until you can name the first durable content workflow. Prefer concrete examples over abstract modeling.

Useful questions:

- What are you trying to organize first?
- What are two or three real examples of that content?
- What do you need to find, compare, or review later?
- Which fields describe each item well enough for lists or tables?
- Which fields should point to another page, person, project, customer, decision, source, or other content item?
- Which repeated operating rules should future Humans or Agents read before editing this content?
- Which files should be shared, and which should stay local or private?

Stop when you can describe one content group, its first template, and one verification path. Do not design the whole workspace in the first pass.

## Translation Pattern

Translate the human's language into workspace concepts only after restating the proposed slice.

| Human description              | Workspace artifact                                |
| ------------------------------ | ------------------------------------------------- |
| A durable category of content  | configured space                                  |
| Fields readers compare or sort | schema fields and display conventions             |
| A repeatable page shape        | create template                                   |
| A relationship between pages   | ref/list fields or Markdown links                 |
| A saved list, table, board     | configured view                                   |
| Editing or review procedure    | guideline Markdown, attached globally or by space |

Use the human's domain language for space ids and titles. If the human says "customers", "projects", "incidents", or "recipes", use those names unless there is a clear reason to choose a more general term.

## First-Slice Dry Run

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

## Minimal Iteration Order

For the first content group:

1. Load `workspace.first-slice-config`, `workspace.spaces`, `workspace.schemas`, and `workspace.templates` with `forma docs get`.
2. Confirm the first-slice dry run with the human.
3. Add the taxonomy config node first if it does not already exist, for example `kind: taxonomy` with `id: spaces`.
4. Add one included term config node, commonly `kind: term` with `taxonomy: spaces`.
5. Add one template referenced by `create.template`.
6. Run `forma config inspect --json` and confirm the expected entry appears under `taxonomies` and `spaces`.
7. Run `forma check --json`. If it reports `config.taxonomyMissing`, add the missing taxonomy config before creating content.
8. Create one or two sample pages with `forma create <space-id> --input ... --json`.
9. Verify with `forma list --space <space-id> --json` and `forma inspect <path> --json`.
10. Add a guideline or view only if the first workflow needs it now. Before doing that, load `workspace.guidelines` or `workspace.views`.
11. Run `forma workspace health --json` and explain warnings in terms of the human's expected relationships.

After the first slice works, repeat the same loop for the next content group. Add cross-space reference fields only when both sides of the relationship are defined. Before adding a cross-content reference field, load `workspace.configuration`, define an `entryRef` named type in `.forma.md` or an imported config node, and use that named type in the space schema. Do not write `target: member` or infer a target from a directory name.

## Optional Pattern Reference

Use this only as a pattern check after the human's own first slice is clear. Do not copy it as the default workspace shape.

If the human says they run a consulting practice and need clients, engagements, meeting notes, and decisions, do not build all four categories immediately. A reasonable first slice might be `clients`:

- space id: `clients`;
- directory: `clients`;
- key fields: `name`, `summary`, `status`, `primaryContact`, `tags`;
- template: `.forma/spaces/templates/client.md`;
- first verification: create two client pages, list `clients`, inspect one page, and run `forma check --json`.

Implement that shape with the syntax from `workspace.first-slice-config`, `workspace.spaces`, `workspace.schemas`, and `workspace.templates`. After it works, ask whether the next slice should be `engagements`, `meeting-notes`, or `decisions`. Add reference fields only when the related space exists.

## Avoid Over-Modeling

Do not start by creating a large taxonomy, many schemas, or many views. A good first workspace can be one configured space, one template, and two sample entries.

Do not copy example workspace content unless the human explicitly asks to start from that example. Use examples as learning references, not as the default shape of a new workspace.

Do not invent built-in domain types. Treat names such as `notes`, `tasks`, and `members` as user-defined content groups unless the workspace config defines them.

`forma workspace health --json` may warn about isolated pages in a newly created workspace. Treat that as relationship feedback, not a failed bootstrap, unless the human expected a connected graph.
