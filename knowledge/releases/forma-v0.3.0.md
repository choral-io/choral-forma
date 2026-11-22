---
schemaVersion: 1
kind: release
title: Forma v0.3.0
summary: Directory introductions with configurable listing placement, copyable paths, and a coordinated reader upgrade.
scope: project
type: release
status: planned
version: v0.3.0
date: 2026-11-22
owners:
    - "members/tiscs"
tags:
    - release
    - public-preview
relatedTasks: []
relatedTestCases: []
relatedExperiments: []
relatedMetrics: []
sources:
    - "releases/forma-v0.2.0"
    - "design/webapp-knowledge-reader-design"
---

# Forma v0.3.0

## Scope

Coordinated Public Preview candidate following [[releases/forma-v0.2.0]]. The CLI, VS Code extension, and Zed package metadata align at 0.3.0.

## Included Changes

- Use a directory's selected `.index.md` for its title, summary, and Markdown body. Place the directory listing with a standalone `<!-- forma:content -->` comment. When the comment is omitted, the listing follows the body.
- Give directory and document pages their own copyable workspace-relative paths. List ordinary `index.md` and `index.mdx` files with the other documents.
- Check authored links and report duplicate content placeholders in directory introductions. Cover the summary and the order of the introduction, listing, and closing paragraph in the Getting Started browser gate.
- Preserve links to the directory introduction title in static output.
- Refresh dependencies and regenerate the link icon font used by the reader.

## Directory Migration

| Existing use in 0.2.0                                                              | Upgrade for 0.3.0                                                                                                               |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `notes/index.md` or `notes/index.mdx` provides the introduction at `/notes`.       | Move the introduction to `notes/.index.md` and keep links to the directory at `/notes`. Use Markdown for the introduction body. |
| A standalone `notes/index.md` or `notes/index.mdx` has its own links or bookmarks. | Keep the regular file and its exact URL. Add `notes/.index.md` separately if the directory also needs an introduction.          |
| An existing `notes/.index.md` is used as an ordinary document.                     | Rename it to a regular document filename and update its links before upgrading.                                                 |

The effective content scope must select `.index.md` for it to supply a directory page. Forma reserves the exact basenames `.index.md` and `.forma.md` from document listings, configuration imports, and guideline matches. The workspace root uses `.forma.md` directly. When migrating a standalone link to a directory URL, carry over the query or heading fragment if it applies to the destination.

A directory introduction can place its child folders and documents between two parts of the body.

```markdown
---
title: Notes Overview
summary: Find the main guides.
---

Start here if you are new to the workspace.

<!-- forma:content -->

See the publishing guide when you are ready to share the workspace.
```

## Client And Artifact Compatibility

The directory projection in `workspace.dashboard` advances from version 1 to 2. Use a CLI and WebApp from the same release. Integrations that read the projection should read directory introduction metadata and prose from the optional `introduction` field and use the directory's own child paths for the listing.

The static data schema advances from 3 to 4. Rebuild with `forma site build` and deploy the complete output together so the HTML, JavaScript, and manifest belong to the same artifact.

## Validation And Rollout

Run version alignment, repository, workspace health, and packaged VSIX checks against the candidate. Use the main CI run for the same commit as the release gate. Publish through the protected Release workflow after maintainer confirmation, then verify the published checksums, CLI, VSIX, and managed installation according to [[guidelines/release-execution-and-verification]].

## Rollback

Keep the previous complete static artifact available for rollback. Use matching CLI and extension versions when rolling back an installation.
