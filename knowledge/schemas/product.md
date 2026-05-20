---
scope: project
type: schema
owners:
    - "[[groups/default-team]]"
tags:
    - metadata
    - schema
    - product
---

# Product Schema

Product documents define product intent, requirements, user-facing behavior, product-level prototypes, user journeys, and information architecture.

## Frontmatter

```yaml
---
scope: project
type: product
owners:
    - "[[groups/default-team]]"
tags:
    - product
---
```

Allowed `type` values:

- `product`
- `product-brief`
- `user-flow`
- `prototype`

## Body Template

Use sections that fit the document:

- Goal
- Users
- User journey
- Behavior
- In scope
- Out of scope
- Related design
- Related tasks
- Open questions

## Rules

- Store product-level prototypes, user flows, and information architecture in `knowledge/product/`.
- Store requirement discovery, market and business analysis, customer context, environmental research, opportunity framing, and assumptions in `knowledge/discovery/`.
- Store implementation-facing UI design in `knowledge/design/`.
- Link related task items instead of duplicating delivery status.
