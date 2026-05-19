# Delivery Review Checklist

## Inputs

- `knowledge/planning/KANBAN.md`
- Linked task item or project knowledge card source
- Current diff, pull request, or changed files
- Relevant product, architecture, decision, and configuration documents

## Acceptance Review

- Verify the implementation satisfies each acceptance criterion.
- Confirm out-of-scope items were not accidentally included.
- Confirm `blocked_by` entries are resolved or documented.
- Confirm downstream dependency follow-up was reviewed or explicitly deferred by reverse-looking up tasks blocked by the completed task.
- Confirm user-visible behavior matches product knowledge.

## Code And Test Review

- Look for correctness bugs, regressions, race conditions, data loss risks, and security issues.
- Confirm changed exports, API contracts, and package boundaries remain compatible.
- Confirm focused tests cover changed behavior.
- Confirm required lint, type, build, and test checks were run or explicitly not run.

## Knowledge Review

- Confirm durable changes are reflected in English canonical knowledge.
- Confirm decisions that affect future implementation are captured in `knowledge/decisions/`.
- Confirm delivery status is not duplicated into every linked task item.
- Leave localized files unchanged unless translation work is explicitly requested.

## Output Shape

Start with findings:

```text
Findings
- [P1] Title - file or knowledge link
  Explain the concrete issue and why it matters.
```

Then include:

- Acceptance status: `accepted`, `needs changes`, or `blocked`
- Checks run
- Checks not run
- Knowledge updates reviewed
