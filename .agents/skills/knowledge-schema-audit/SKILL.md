---
name: knowledge-schema-audit
description: Audit non-task knowledge documents without writing. Use for schema, frontmatter, localization, link, and consistency checks outside task delivery metadata.
---

# Knowledge Schema Audit

Use this skill to inspect non-task knowledge schema quality. This skill is read-only.

## Workflow

1. Read `knowledge/schemas/common.md`.
2. Read relevant area schemas under `knowledge/schemas/`.
3. Scan `knowledge/**/*.md`.
4. Exclude `knowledge/tasks/items/**`, `knowledge/workspace/*/local/**`, and `knowledge/planning/KANBAN.md` by default.
5. Parse frontmatter, filenames, links, and localized-file suffixes.
6. Compare each document to the relevant area schema.
7. Report findings and dry-run fixes without editing files.

## Checks

- Missing YAML frontmatter.
- Missing or invalid `scope`, `type`, `owners`, or `tags`.
- Ownership metadata that does not use the canonical `owners` field.
- Localized files missing `lang`, `canonical`, or `translation_of`.
- Localized files that link to other localized files by default.
- Discovery, product, or design files placed in the wrong area.
- Design assets referenced from Markdown but not stored under `knowledge/assets/design/<feature-name>/`.
- Decision files with missing supersession metadata when a replacement is obvious.
- Proposal files with missing or invalid `proposal_type`, `proposal_status`, `sources`, or target metadata.
- Member files missing `member_id` or `display_name`.
- Member files that still use legacy `groups` frontmatter instead of group documents' `members` lists.
- Group `members` entries that point to missing or ambiguous member profiles.
- Workspace notes that appear to contain project facts that should be promoted.
- Shared workspace files created under deprecated `daily/`, `inbox/`, `scratch/`, or `drafts/` directories.
- Possible secrets, credentials, private customer data, or private personal notes.

## Output

- Summary counts.
- Findings grouped by severity.
- Dry-run fixes with confidence.
- Auto-fixable items after approval.
- Items that require maintainer judgment.

## Guardrails

- Do not edit files.
- Do not delete or archive documents.
- Do not rewrite localized content.
- Do not infer product intent, design intent, or architecture decisions.
- Stop and report possible sensitive content.

## References

- For report format and fix policy, read `references/report.md`.
