# Knowledge Intake Routing

## Routing Examples

| User mention                                                       | First action                   | Target                                   |
| ------------------------------------------------------------------ | ------------------------------ | ---------------------------------------- |
| Market, business, customer, environmental, or competitive research | Review discovery docs          | `knowledge/discovery/`                   |
| Product requirement or user behavior                               | Review existing product docs   | `knowledge/product/`                     |
| UI layout, component behavior, visual state                        | Review existing design docs    | `knowledge/design/`                      |
| Domain term or reusable concept                                    | Search concepts                | `knowledge/concepts/`                    |
| Module boundary, API, data flow, integration                       | Review architecture docs       | `knowledge/architecture/`                |
| Product or technical tradeoff                                      | Check existing decisions       | `knowledge/decisions/`                   |
| Cross-area writing, terminology, or language                       | Review guidelines              | `knowledge/guidelines/`                  |
| Sprint, roadmap, process, migration                                | Review planning docs           | `knowledge/planning/`                    |
| Valuable but unconfirmed knowledge, task, or decision candidate    | Create proposal after approval | `knowledge/proposals/`                   |
| Implementable work item                                            | Create or refine task item     | `knowledge/tasks/items/`                 |
| Personal working context                                           | Capture locally                | `knowledge/workspace/<member-id>/local/` |
| Shareable member summary, handoff, research                        | Summarize for team use         | `knowledge/workspace/<member-id>/`       |

## Local Promotion

Use intake to decide whether local-only material should become shared knowledge. Do not promote automatically.

Recommend promotion when local material affects:

- market, business, customer, environmental, or competitive research that informs product direction
- product behavior or user-visible requirements
- UI design, interaction, or prototype decisions
- architecture, data flow, integration, or operational constraints
- task scope, acceptance criteria, blockers, or readiness
- member handoff, coordination, or review context
- decisions that future Agents or team members must rely on

If the user agrees, route the approved write to `knowledge-capture`.

## Proposal Buffer

Recommend a proposal when material is valuable but not yet confirmed enough to become canonical knowledge, a task item, or an accepted decision.

Good proposal candidates:

- local log, scratch, handoff, or research material that may become reusable knowledge
- user feedback, QA observation, market signal, or failure pattern that needs review
- task candidate that is not ready for a task item
- decision candidate that needs owner or reviewer judgment
- material with multiple possible target areas

Do not require a proposal when the user has clearly approved a low-risk knowledge update and the target document is obvious.

## Suggested Response Pattern

```text
This sounds like durable project knowledge.

I will first check existing discovery, product, and decision docs for overlap.
If there is no matching canonical page, I will suggest the right target area before drafting.
If it is executable work, I will also suggest a task item, but I will not create a Kanban card without approval.
```

## No-Change Cases

Do not suggest a knowledge update when:

- The message is purely operational status with no durable fact.
- The idea is private or sensitive and should not enter the repository.
- The content only repeats existing canonical knowledge.
- The user is asking a one-off question and no new project knowledge emerges.
