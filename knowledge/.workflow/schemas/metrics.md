---
scope: project
type: schema
owners: []
tags:
    - metadata
    - schema
    - metrics
---

# Metrics Schema

Metric documents define what the team measures, why it matters, where it comes from, and how to interpret changes.

## Frontmatter

```yaml
---
scope: project
type: product
status: draft
owners: []
tags:
    - metric
source:
unit:
direction:
target:
review_cadence:
related_experiments: []
related_releases: []
---
```

Allowed `type` values:

- `product`
- `quality`
- `delivery`
- `operational`

Allowed `status` values:

- `draft`
- `active`
- `retired`

## Body Template

- Definition
- Why It Matters
- Calculation
- Source
- Target Or Threshold
- Interpretation
- Review Cadence
- Related Knowledge
- Open Questions

## Rules

- Store metric definitions, targets, thresholds, sources, and interpretation rules in `<knowledge_dir>/metrics/`.
- Do not store raw analytics exports, private customer data, or dashboard dumps in metric documents.
- Link experiments, releases, product requirements, tasks, and dashboards when they affect or use the metric.
- Record enough calculation detail for another member or Agent to interpret the metric consistently.
- Use `<knowledge_dir>/.workflow/templates/metric.md` as a starting point.
