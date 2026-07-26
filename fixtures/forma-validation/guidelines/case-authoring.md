---
title: Validation Case Authoring
summary: Rules for maintaining deterministic internal Forma validation fixtures.
---

# Validation Case Authoring

This workspace is an internal validation corpus, not a user-facing example.

## Stable Metadata

- Keep searchable and automatable values in frontmatter.
- Keep procedures, detailed expectations, evidence, and limitations in the Markdown body.
- Keep `assertionIds` stable after a case becomes active.
- Reuse shared Samples instead of creating one private sample per Case.

## Deterministic Inputs

- Do not depend on network access, current time, random values, generated identifiers, or private machine state.
- Use committed local assets and workspace-relative links.
- Use intentionally varied titles, lengths, languages, stages, and reference shapes where the variation exercises a real Forma contract.

## Workspace Boundary

- Keep this unified workspace valid and healthy.
- Put intentionally invalid configuration, frontmatter, taxonomy, and path-boundary scenarios in isolated workspaces.
- Do not copy these fixtures into `examples/` or present their structure as a product default.

## Presentation Pressure

- Preserve local overflow ownership for wide content.
- Include multiline and variable-height content where geometry is part of the contract.
- Do not encode fixed-height or magic-number assumptions into validation data.
- Keep Case assertions independent from one particular browser viewport unless the assertion explicitly concerns responsive behavior.
