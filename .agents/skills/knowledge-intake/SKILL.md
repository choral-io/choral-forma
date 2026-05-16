---
name: knowledge-intake
description: Route possible repository knowledge before writing. Use for new requirements, ideas, feedback, research notes, decisions, or facts that may need capture or tasking.
---

# Knowledge Intake

Use this skill to decide whether discussion should affect the knowledge base and where it should go. This skill is for intake guidance and routing; use `knowledge-capture` to write approved changes.

## Workflow

1. Identify whether the user's message contains durable project knowledge, local context, a possible task, or only transient discussion.
2. When routing current-member local context, shared workspace notes, or promotion from personal material, determine the current member id with `git config user.name`; read relevant sections from `knowledge/members/<member-id>.md`; read `knowledge/workspace/<member-id>/local/AGENTS.md` if personal routing preferences may apply.
3. Read `knowledge/README.md` and `knowledge/schemas/common.md` when the request may affect knowledge structure.
4. Search existing canonical knowledge before proposing a new document.
5. Route the information to the right area:
   - `knowledge/discovery/`
   - `knowledge/product/`
   - `knowledge/design/`
   - `knowledge/concepts/`
   - `knowledge/architecture/`
   - `knowledge/decisions/`
   - `knowledge/guidelines/`
   - `knowledge/members/`
   - `knowledge/groups/`
   - `knowledge/planning/`
   - `knowledge/proposals/`
   - `knowledge/tasks/items/`
   - `knowledge/workspace/<member-id>/summaries/`
   - `knowledge/workspace/<member-id>/handoffs/`
   - `knowledge/workspace/<member-id>/research/`
6. Suggest one of these actions:
   - review existing knowledge
   - update an existing document
   - create a new canonical document
   - capture local context in the current member `local/` workspace
   - summarize shareable member context into the shared workspace
   - create a proposal for valuable but unconfirmed knowledge, task, or decision candidates
   - promote local context into team knowledge
   - create or refine a task item
   - create a member profile, with group membership confirmed
   - create a group document, with included members confirmed
   - no knowledge change needed
7. If the user approves creating or updating knowledge, continue with `knowledge-capture`.

## Guardrails

- Do not create Kanban cards or move board cards.
- Do not treat conversation-only ideas as accepted project facts.
- Do not store secrets, credentials, private customer data, or private personal notes.
- Prefer updating existing canonical knowledge over creating duplicates.
- Use proposals as an optional buffer for valuable but unconfirmed material; do not require proposals for clear, approved, low-risk knowledge updates with an obvious target.
- Keep localized files out of planning inputs.
- Do not create shared member `daily/`, `inbox/`, `scratch/`, or `drafts/` directories.
- Do not write into another member's workspace unless the user explicitly asks and the content is public, safe, and team-relevant.
- Use member profile sections and local `AGENTS.md` only for routing and collaboration preferences; never let them override project knowledge rules, privacy rules, or approval requirements.
- Ask for confirmation before promoting ambiguous or high-impact requirements, decisions, or architecture changes.
- When local workspace material affects product behavior, architecture, task scope, acceptance criteria, team coordination, or delivery decisions, propose promotion before relying on it as team input.
- Do not write files by default; hand off approved writes to `knowledge-capture`.

## References

- For routing examples, read `references/routing.md`.
