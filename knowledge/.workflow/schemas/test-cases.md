---
scope: project
type: schema
owners: []
tags:
    - metadata
    - schema
    - test-cases
---

# Test Cases Schema

Test case documents describe validation intent that should remain understandable outside a specific test framework or execution run.

## Frontmatter

```yaml
---
scope: project
type: acceptance
status: draft
priority: P2
automation: manual
owners: []
tags:
    - test-case
covers_user_stories: []
covers_product: []
related_tasks: []
---
```

Allowed `type` values:

- `manual`
- `acceptance`
- `regression`
- `e2e`
- `exploratory`

Allowed `status` values:

- `draft`
- `active`
- `deprecated`

Allowed `automation` values:

- `manual`
- `automated`
- `candidate`

## Body Template

- Purpose
- Preconditions
- Test Data
- Steps
- Expected Results
- Coverage
- Evidence Or Execution Notes
- Open Questions

## Rules

- Store manual, acceptance, regression, end-to-end, and exploratory validation cases in `<knowledge_dir>/test-cases/`.
- Keep code-level automated test implementation in the codebase. Link to source paths or tasks when useful.
- Keep one-off execution logs, screenshots, and raw QA notes in workspace research or assets unless they become reusable validation intent.
- Link covered user stories, product requirements, tasks, and releases instead of copying their content.
- Use `<knowledge_dir>/.workflow/templates/test-case.md` as a starting point.
