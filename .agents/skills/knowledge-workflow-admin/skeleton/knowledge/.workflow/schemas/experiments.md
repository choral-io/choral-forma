---
scope: project
type: schema
owners: []
tags:
    - metadata
    - schema
    - experiments
---

# Experiments Schema

Experiment documents record hypotheses, controlled product or delivery probes, guardrails, results, and follow-up decisions.

## Frontmatter

```yaml
---
scope: project
type: experiment
status: proposed
owners: []
tags:
    - experiment
hypothesis:
metrics: []
guardrails: []
related_user_stories: []
related_releases: []
---
```

Allowed `type` values:

- `experiment`
- `ab_test`
- `feature_flag`
- `prototype`
- `research_probe`
- `rollout`

Allowed `status` values:

- `proposed`
- `running`
- `concluded`
- `stopped`

## Body Template

- Hypothesis
- Design
- Audience
- Metrics
- Guardrails
- Risks
- Results
- Decision
- Follow-Up

## Rules

- Store hypotheses, experiment designs, rollout probes, guardrails, results, and follow-up decisions in `<knowledge_dir>/experiments/`.
- Store broad research or discovery evidence in `<knowledge_dir>/discovery/`; link it from the experiment when it motivates the hypothesis.
- Store accepted decisions in `<knowledge_dir>/decisions/` after review; link the decision from the experiment.
- Store metric definitions in `<knowledge_dir>/metrics/` and reference them instead of redefining them.
- Use `<knowledge_dir>/.workflow/templates/experiment.md` as a starting point.
