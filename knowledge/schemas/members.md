---
scope: project
type: schema
owners:
    - "[[groups/default-team]]"
tags:
    - metadata
    - schema
    - members
---

# Members Schema

Member documents describe project-relevant member identity, responsibilities, focus areas, and public collaboration context.

## Frontmatter

```yaml
---
scope: project
type: member
member_id: Gavroche
display_name: Gavroche
owners:
    - "[[members/Gavroche]]"
tags:
    - member
---
```

## Recommended Sections

- `## Profile`: member id, display name, timezone, and public contact context.
- `## Responsibilities`: project responsibilities, durable ownership, and review areas.
- `## Focus Areas`: current or long-running project focus areas.
- `## Collaboration`: public collaboration preferences for teamwork, handoffs, and reviews.
- `## Availability`: optional public availability or capacity notes.
- `## Notes`: optional low-priority context; Agents should not read it by default.

## Rules

- `member_id` is the value returned by `git config user.name`.
- `display_name` is for human-facing presentation only.
- Use member ids in paths and `member_id`; use member wikilinks in responsibility metadata such as `owners`, `assignees`, and `reviewers`.
- Prefer path-qualified member and group wikilinks such as `[[members/Gavroche]]` and `[[groups/default-team]]` in templates and tool output. Manual short wikilinks are valid only when they resolve uniquely.
- Do not store group membership in member frontmatter. `knowledge/groups/*.md` frontmatter `members` is the structured membership source of truth.
- When creating a member, check existing `knowledge/groups/*.md`, suggest likely groups, and update confirmed group documents by adding the member to their `members` lists.
- Use `knowledge/members/templates/member.md.tpl` as the reference template for new member profiles.
- Do not store private personal information.
- Personal Agent collaboration preferences belong in `knowledge/workspace/<member-id>/local/AGENTS.md`, not in member profiles.
- Agents should prefer section-scoped reads for member profiles. Read the full member file only when editing, auditing, or resolving ambiguity.
