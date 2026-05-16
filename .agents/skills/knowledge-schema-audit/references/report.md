# Knowledge Schema Audit Report

## Audit-To-Fix Flow

Use a two-step process:

1. Audit and report findings without editing files.
2. Apply selected fixes only after maintainer approval.
3. Re-run the audit after fixes.

Apply approved documentation fixes with `knowledge-capture` unless the fix is a Kanban board move, which belongs to `kanban-maintenance`.

## Severity

- `P0`: possible sensitive data or schema issue that blocks safe collaboration.
- `P1`: breaks source-of-truth, localization, or schema interpretation.
- `P2`: weakens navigation, ownership, or review quality.
- `P3`: cleanup or formatting consistency.

## Auto-Fixable After Approval

- Normalize ownership metadata to the `owners` frontmatter field when the value is clear.
- Add missing `tags` when they can be derived from the directory and filename.
- Add localized metadata when the canonical file is unambiguous.
- Normalize BCP 47 localized suffix casing.
- Move or relink design assets when the target feature directory is obvious.
- Normalize links that uniquely match existing canonical files.

## Requires Maintainer Judgment

- Product requirements or acceptance meaning.
- Design intent or UI behavior.
- Architecture decisions.
- Decision supersession.
- Member responsibility changes.
- Workspace note promotion to project facts.
- Deleting, archiving, or merging documents.
- Handling possible sensitive information.
- Translating or synchronizing localized content.

## Output Example

```text
Summary
- Files scanned: 42
- P0: 0
- P1: 2
- P2: 4
- P3: 6

Findings
- [P1] concepts/agent.zh-CN.md missing canonical.
- [P2] design/example-ui.md references image outside knowledge/assets/design.
- [P3] product/example-note.md missing tags.

Dry-run fixes
- Add canonical: ./agent.md to concepts/agent.zh-CN.md. Confidence: high. Auto-fixable: yes.
- Move referenced image to knowledge/assets/design/chat/. Confidence: medium. Auto-fixable: confirm.
- Add tags: [product]. Confidence: high. Auto-fixable: yes.

Requires judgment
- workspace/Gavroche/research/example-research-note.md appears to contain project facts; maintainer should decide whether to promote it.
```
