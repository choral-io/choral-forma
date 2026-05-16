---
scope: project
type: schema
owners:
  - "[[groups/{{default_group_id}}]]"
tags:
  - metadata
  - schema
  - proposals
---

# Proposals Schema

Proposal documents are an optional review buffer for valuable but unconfirmed knowledge, task, or decision candidates.

They are not project facts, accepted decisions, task items, or delivery commitments until converted into the appropriate canonical document.

## Frontmatter

```yaml
---
scope: project
type: proposal
proposal_type: knowledge
proposal_status: proposed
owners:
  - "[[groups/{{default_group_id}}]]"
assignees: []
reviewers: []
tags:
  - proposal
sources: []
target_area:
target:
related_to: []
---
```

## Fields

- `proposal_type`: `knowledge`, `task`, or `decision`.
- `proposal_status`: `proposed`, `reviewing`, `accepted`, `rejected`, `converted`, or `superseded`.
- `sources`: evidence or origin links, such as shared workspace research, handoffs, task items, canonical knowledge, or external URLs.
- `target_area`: expected destination area, such as `product`, `discovery`, `tasks`, or `decisions`.
- `target`: optional target file, task item id, decision id, or wikilink.
- `related_to`: contextual links that are related but not evidence.

## Body Template

- Summary
- Source Evidence
- Proposed Change
- Target
- Risk And Confidence
- Review Decision
- Follow-Up

## Rules

- Use proposals only when material is valuable but not yet confirmed enough to become canonical knowledge, a task item, or an accepted decision.
- Do not require proposals for clear, approved, low-risk knowledge updates with an obvious target.
- Do not create Kanban cards directly from proposals.
- Convert accepted task proposals into task items before delivery planning.
- Convert accepted decision proposals into decision documents before treating them as accepted decisions.
- Convert accepted knowledge proposals into the appropriate canonical knowledge area before using them as project facts.
- Preserve source evidence and review reasoning in the proposal, but do not copy raw private notes, secrets, or command chatter.
- Keep rejected, converted, or superseded proposals available as review history when useful, but do not use them as canonical sources.

## Template

Use `proposals/templates/proposal.md.tpl` as the reference template.
