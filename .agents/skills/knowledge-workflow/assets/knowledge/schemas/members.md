---
scope: project
type: schema
owners:
  - "[[groups/{{default_group_id}}]]"
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
groups:
  - "[[groups/{{default_group_id}}]]"
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
- Prefer path-qualified member and group wikilinks such as `[[members/Gavroche]]` and `[[groups/{{default_group_id}}]]` in templates and tool output. Manual short wikilinks are valid only when they resolve uniquely.
- Use `groups` for groups this member belongs to. Ask the user to choose groups manually, or infer candidate groups from responsibilities and ask for confirmation.
- When creating a member, check existing `{{knowledge_dir}}/groups/*.md` and suggest likely groups before writing.
- Use `{{knowledge_dir}}/members/templates/member.md.tpl` as the reference template for new member profiles.
- Do not store private personal information.
- Personal Agent collaboration preferences belong in `{{knowledge_dir}}/workspace/<member-id>/local/AGENTS.md`, not in member profiles.
- Agents should prefer section-scoped reads for member profiles. Read the full member file only when editing, auditing, or resolving ambiguity.
