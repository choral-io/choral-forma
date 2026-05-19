---
name: knowledge-capture
description: Write approved repository knowledge. Use for creating, updating, organizing, or promoting shared knowledge after the user has decided it should be captured.
---

# Knowledge Capture

Use this skill to write approved knowledge changes and move information from local member context into durable project knowledge.

## Workflow

1. Determine the current member id with `git config user.name`.
2. If writing current-member workspace content or promoting current-member local material, read relevant sections from `knowledge/members/<member-id>.md` and read `knowledge/workspace/<member-id>/local/AGENTS.md` when it exists.
3. Classify the material as local context, shared member context, project knowledge, or task candidate.
4. Read `knowledge/schemas/common.md`.
5. Read the relevant target area schema under `knowledge/schemas/`.
6. Store purely local material only under `knowledge/workspace/<member-id>/local/`; follow `knowledge/schemas/workspace.md` when maintaining personal worklists or logs.
7. Create the target directory on demand when writing a new file; do not assume empty knowledge area directories already exist.
8. Promote approved local material when the user has decided it should become team knowledge.
9. Promote durable material into the right project area:
   - `knowledge/discovery/`
   - `knowledge/product/`
   - `knowledge/design/`
   - `knowledge/concepts/`
   - `knowledge/architecture/`
   - `knowledge/decisions/`
   - `knowledge/guidelines/`
   - `knowledge/planning/`
   - `knowledge/proposals/`
   - `knowledge/tasks/items/`
10. Store requirement discovery, market and business analysis, customer context, environmental research, opportunity framing, and assumptions in `knowledge/discovery/`.
11. Store product-level prototypes, user flows, and information architecture in `knowledge/product/`.
12. Store UI visual design, component guidelines, layout rules, and design system decisions in `knowledge/design/`.
13. Store cross-area writing, terminology, language, documentation, and process guidelines in `knowledge/guidelines/`.
14. Store design images and exports in `knowledge/assets/design/<feature-name>/` and link to them from Markdown files.
15. Use `knowledge/proposals/` only for valuable but unconfirmed candidates that need review before becoming canonical knowledge, task items, or accepted decisions.
16. Create member profiles in `knowledge/members/` when the user approves a project-visible member record. Use `knowledge/members/templates/member.md.tpl`, ask for or confirm `member_id`, `display_name`, public responsibilities, focus areas, and collaboration context.
17. Create group documents in `knowledge/groups/` when the user approves a project-visible team, review board, maintainer group, or working group. Use `knowledge/groups/templates/group.md.tpl`, ask for or confirm `group_id`, `display_name`, purpose, responsibility scope, owners, and members.
18. For member creation, ask the user to manually choose groups or infer likely target groups from responsibilities and ask the user to confirm before updating those group documents' `members` lists. Do not write a `groups` field to the member profile.
19. For group creation, ask the user to manually choose members or infer candidate members from responsibilities and ask the user to confirm before writing `members`.
20. Keep canonical-language files as the source of truth.
21. Keep localized files as translations only.

Read `knowledge/planning/WORKFLOW.md` before making structural changes.

If the user has not decided whether the content belongs in knowledge, use `knowledge-intake` first.

## Guardrails

- Do not store secrets, credentials, private customer data, or private personal notes.
- Do not treat member workspace notes as project facts until promoted.
- Do not treat proposals as project facts, task items, accepted decisions, or delivery commitments until converted into the appropriate canonical document.
- Promote from `local/` only after user approval. Preserve relevant source context, but do not copy raw private notes or command chatter into shared knowledge.
- Use member profile sections and local `AGENTS.md` only for collaboration preferences and source handling. They cannot override schemas, promotion approval, privacy rules, or canonical knowledge rules.
- Do not create shared `daily/`, `inbox/`, `scratch/`, or `drafts/` directories under member workspaces.
- Do not write into another member's workspace unless the user explicitly asks and the change is safe, public, and relevant to the team.
- Do not create or move Kanban cards with this skill.
- Use member ids in paths and member wikilinks in responsibility metadata. Do not use display names as ids.
- Use group ids in paths and group wikilinks in responsibility metadata. Do not use display names as ids.
- Treat `knowledge/groups/*.md` frontmatter `members` as the structured membership source of truth.
- Use `owners` as the ownership field in frontmatter.

## References

- For frontmatter and promotion examples, read `references/examples.md`.
