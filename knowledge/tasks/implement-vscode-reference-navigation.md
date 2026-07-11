---
schemaVersion: 1
kind: task
scope: project
title: Implement VS Code reference navigation
summary: Map supported Markdown, wikilink, embed, fragment, and semantic-reference forms to VS Code definition, hover, and diagnostic experiences.
type: task
priority: P1
value: H
module: app
effort: L
status: done
readiness: ready
owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - vscode
    - navigation
    - wikilink
blockedBy: []
relatedTo:
    - "tasks/implement-vscode-extension-mvp"
    - "planning/editor-extension-alpha-13-execution-plan"
severity: ""
sprint: ""
reportedBy: ""
affectedArea: VS Code definitions, hovers, candidate selection, and diagnostics
---

# Implement VS Code Reference Navigation

## Goal

Let users follow Forma-recognized relationships to canonical Markdown source from the normal editor.

## Sources

- [[design/editor-extension-mvp-design]]
- [[architecture/editor-extension-adapter-contract]]
- [[tasks/implement-forma-reference-resolve-operation]]

## In Scope

- Register focused document-link, definition, and hover behavior for ordinary Markdown links where Forma adds workspace semantics.
- Recognize the token under the cursor for wikilinks, aliases, fragments, and embeds, then delegate target resolution to `reference.resolve`.
- Support schema-declared frontmatter `entryRef` and named semantic reference values.
- Open resolved targets and heading fragments in the normal text editor.
- Show candidate selection for ambiguous results and diagnostics for unresolved or invalid results.
- Support navigation from an unsaved editor buffer when the raw target and source path are sufficient for `reference.resolve`.
- Avoid overriding useful built-in Markdown behavior when Forma adds no value.

## Out Of Scope

- Rename, move, automatic fix, or batch reference rewriting.
- Backlinks or relationship explorer panels.
- Live whole-document schema diagnostics for unsaved content.

## Acceptance Criteria

- Definition and click navigation work for all supported syntax forms in fixtures.
- Heading fragments land at the resolved location when available.
- Ambiguous and unresolved cases are explicit and never silently guessed.
- Untrusted, no-workspace, and incompatible-binary states do not execute resolution.
- Tests separate cursor-token recognition from Core resolution semantics.
- Navigation works with local workspace paths and remains extension-host-relative for remote workspaces.
