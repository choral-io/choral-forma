---
title: "Validate Editor Link Navigation"
summary: "members/sam-rivera"
status: "done"
priority: "low"
owners:
  - members/sam-rivera
  - members/mira-chen
assignees:
  - members/sam-rivera
reviewers:
  - members/mira-chen
blockedBy: []
createdAt: "2026-07-13T00:00:00Z"
updatedAt: "2026-07-13T00:00:00Z"
dueDate: ""
---

# Validate Editor Link Navigation

Use this page to verify that Forma-aware editors preserve ordinary Markdown behavior while adding navigation for Forma references. The `summary` value deliberately looks like a member path but remains ordinary text because the schema declares it as a string. Each `owners` value is a reference because the task schema declares `owners` as a list of members.

## Standard Markdown Links

- [Sam Rivera](../members/sam-rivera.md)
- [Mira Chen](../members/mira-chen.md)
- [Sam Rivera heading](../members/sam-rivera.md#sam-rivera)
- [Choral Forma website](https://forma.choral.io)

## Wikilinks And Embeds

- [[members/sam-rivera]]
- [[members/mira-chen|Mira Chen]]
- [[members/sam-rivera#Sam Rivera|Sam Rivera heading]]
- ![[members/sam-rivera]]

## Code Examples Stay Semantically Inert

Inline code such as `[Sam Rivera](../members/sam-rivera.md#sam-rivera)`, `[[members/sam-rivera]]`, and `![[members/sam-rivera]]` must expose consistent DocumentLink navigation without becoming Forma references or changing native code styling. A Markdown-labelled fence also remains inert to Forma indexing, diagnostics, and Definition, while the editor may expose its link syntax through DocumentLink and theme-derived syntax highlighting:

```md
[Sam Rivera](../members/sam-rivera.md)
[Sam Rivera](../members/sam-rivera.md#sam-rivera)
[Choral Forma website](https://forma.choral.io)
[[members/sam-rivera]]
[[members/sam-rivera#Sam Rivera|Sam Rivera heading]]
![[members/sam-rivera]]
[Missing](../members/not-a-reference.md)
[[members/not-a-reference]]
![[members/not-a-reference]]
```

Fences for other languages remain ordinary code literals:

```rust
let example = "[[members/sam-rivera]]";
```
