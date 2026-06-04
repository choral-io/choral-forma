---
scope: project
type: schema
owners: []
tags:
    - metadata
    - schema
    - releases
---

# Releases Schema

Release documents describe the scope, validation, rollout, rollback, and follow-up for a shipped or planned delivery bundle.

## Frontmatter

```yaml
---
scope: project
type: release
status: planned
version:
date:
owners: []
tags:
    - release
related_tasks: []
related_test_cases: []
related_experiments: []
related_metrics: []
---
```

Allowed `status` values:

- `planned`
- `in_progress`
- `released`
- `rolled_back`

## Body Template

- Scope
- Included Changes
- Validation
- Rollout Plan
- Migration Or Operations Notes
- Release Notes
- Rollback Plan
- Post-Release Follow-Up

## Rules

- Store release scope, validation, rollout, rollback, release notes, and post-release follow-up in `<knowledge_dir>/releases/`.
- Keep individual delivery task context in `<knowledge_dir>/tasks/`; link included tasks from the release.
- Keep durable test intent in `<knowledge_dir>/test-cases/`; summarize release validation and link detailed cases.
- Keep operational runbooks or long-lived process guidance in `<knowledge_dir>/guidelines/` when they apply beyond one release.
- Use `<knowledge_dir>/.workflow/templates/release.md` as a starting point.
