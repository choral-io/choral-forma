---
scope: project
type: schema
owners: []
tags:
    - metadata
    - schema
    - user-stories
---

# User Stories Schema

User story documents describe user goals, actors, scenarios, use cases, and journeys that product, design, test, and delivery work should preserve.

## Frontmatter

```yaml
---
scope: project
type: user_story
status: draft
owners: []
tags:
    - user-story
actors: []
related_product: []
related_tasks: []
related_test_cases: []
related_metrics: []
---
```

Allowed `type` values:

- `user_story`
- `use_case`
- `scenario`
- `journey`

Allowed `status` values:

- `draft`
- `accepted`
- `deprecated`

## Body Template

Use sections that fit the document:

- User Or Actor
- Goal
- Context
- Value
- Story Or Use Case
- Main Flow
- Alternate Or Exception Flows
- Acceptance Intent
- Related Knowledge
- Open Questions

## Rules

- Store user stories, use cases, scenarios, and journeys in `<knowledge_dir>/user-stories/`.
- Use `user_story` for concise actor-goal-value stories, `use_case` for actor/system interaction contracts, `scenario` for concrete situation examples, and `journey` for multi-step user experience narratives.
- Keep user stories focused on user goals and expected outcomes. Store broad product requirements in `<knowledge_dir>/product/`.
- Link related product, design, test case, metric, and task documents instead of duplicating their details.
- Keep delivery work in `<knowledge_dir>/tasks/`; a user story may motivate tasks but is not itself an executable task.
- Use `<knowledge_dir>/.workflow/templates/user-story.md` as a starting point.
