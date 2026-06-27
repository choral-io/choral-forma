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

After `forma init`, help the human turn one real content workflow into a small Forma workspace. The human should describe their business or personal context in ordinary language; the Agent should translate that context into explicit Forma config only after confirming the first slice.

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

Translate the human's language into Forma concepts only after restating the proposed slice.

| Human description              | Forma artifact                                    |
| ------------------------------ | ------------------------------------------------- |
| A durable category of content  | configured space                                  |
| Fields readers compare or sort | schema fields and display conventions             |
| A repeatable page shape        | create template                                   |
| A relationship between pages   | ref/list fields or Markdown links                 |
| A saved list, table, board     | configured view                                   |
| Editing or review procedure    | guideline Markdown, attached globally or by space |

Use the human's domain language for space ids and titles. If the human says "customers", "projects", "incidents", or "recipes", use those names unless there is a clear reason to choose a more general term.

## Minimal Iteration Order

For the first content group:

1. Load `workspace.configuration`, `workspace.spaces`, `workspace.schemas`, and `workspace.templates` with `forma docs get`.
2. Confirm the first slice with the human: one space id, directory, key fields, and one template.
3. Add one included config node, commonly `kind: term` with `taxonomy: spaces`.
4. Add one template referenced by `create.template`.
5. Run `forma config inspect --json` and confirm the expected entry appears under `spaces`.
6. Run `forma check --json`.
7. Create one or two sample pages with `forma create <space-id> --input ... --json`.
8. Verify with `forma list --space <space-id> --json` and `forma inspect <path> --json`.
9. Add a guideline or view only if the first workflow needs it now. Before doing that, load `workspace.guidelines` or `workspace.views`.
10. Run `forma workspace health --json` and explain warnings in terms of the human's expected relationships.

After the first slice works, repeat the same loop for the next content group. Add cross-space reference fields only when both sides of the relationship are defined.

## Worked First Slice Example

If the human says they run a consulting practice and need clients, engagements, meeting notes, and decisions, do not build all four categories immediately. A reasonable first slice might be `clients`.

This is a pattern example, not a default recommendation. Do not create `clients` unless the human's workflow actually needs client records.

- space id: `clients`;
- directory: `clients`;
- key fields: `name`, `summary`, `status`, `primaryContact`, `tags`;
- template: `.forma/spaces/templates/client.md`;
- first verification: create two client pages, list `clients`, inspect one page, and run `forma check --json`.

The first config node can look like this:

```yaml
---
schemaVersion: 1
kind: term
taxonomy: spaces
title: Clients
description: Client records for consulting work.
include:
    - "clients/**/*.md"
create:
    directory: clients
    filename: "{{ input.slug }}.md"
    template: .forma/spaces/templates/client.md
    inputs:
        name:
            required: true
        slug:
            default: "{{ input.name }}"
            transform: slugify
        summary:
            default: ""
schema:
    type: object
    fields:
        name:
            type: string
        summary:
            type: string
        status:
            type: string
        primaryContact:
            type: string
        tags:
            type: list
            items:
                type: string
conventions:
    titleField: name
    summaryField: summary
---
# Clients

Client records for consulting work.
```

Keep the template equally small:

```markdown
---
name: "{{ input.name }}"
summary: "{{ input.summary }}"
status: active
primaryContact: ""
tags: []
---

# {{ input.name }}

{{ input.summary }}
```

After this works, ask whether the next slice should be `engagements`, `meeting-notes`, or `decisions`. Add reference fields only when the related space exists.

## Avoid Over-Modeling

Do not start by creating a large taxonomy, many schemas, or many views. A good first workspace can be one configured space, one template, and two sample entries.

Do not copy starter-kit content unless the human explicitly asks to start from that example. Use starter-kit as a learning reference, not as the default shape of a new workspace.

Do not invent built-in domain types. Treat names such as `notes`, `tasks`, and `members` as user-defined content groups unless the workspace config defines them.

`forma workspace health --json` may warn about isolated pages in a newly created workspace. Treat that as relationship feedback, not a failed bootstrap, unless the human expected a connected graph.
