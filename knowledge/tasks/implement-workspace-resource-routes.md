---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "[[members/Tiscs]]"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - webapp
    - routing
    - resources

effort: M
readiness: needs-refinement
sprint:

blocked_by: []
related_to:
    - "[[tasks/implement-read-only-webapp]]"
    - "[[tasks/implement-reference-navigation-baseline]]"
    - "[[tasks/refactor-webapp-with-shadcn-base-ui]]"

reported_by:
affected_area: WebApp routing and workspace resources
---

# Implement Workspace Resource Routes

## Goal

Define and implement workspace resource route behavior, including app-facing
workspace file URLs and raw source access for repository-backed resources.

## Sources

- [[tasks/implement-read-only-webapp]]
- [[tasks/implement-reference-navigation-baseline]]
- [[tasks/refactor-webapp-with-shadcn-base-ui]]
- Current product design discussion about canonical file URLs, `root_path`,
  dynamic `<base href>`, and future image, audio, and video previews.

## Context

Forma should treat WebApp document URLs as workspace file URLs, with file
extensions preserved. This keeps Markdown, MDX, text, JSON, image, audio, video,
and other workspace resources in the same route model and avoids ambiguity when
files share the same basename with different extensions.

Only Markdown and MDX files should participate in the knowledge system by
default. Non-Markdown files are workspace resources: they may be browsed,
previewed, linked, and served through raw routes, but they should not enter
collections, graph nodes, backlinks, or knowledge checks as knowledge entries.

When a resource needs durable knowledge, create an explicit Markdown
description document next to it:

```text
assets/logo.png
assets/logo.png.md
media/demo.mp4
media/demo.mp4.md
data/sample.json
data/sample.json.md
```

The description document is a normal knowledge file. It may contain
frontmatter, links, owners, sources, licensing notes, usage constraints, and
review context. The resource file remains a resource; the description document
is the knowledge entry. If a resource exists without a description document,
that is allowed. If a resource description document exists but the described
resource is missing, health checks should report a failing diagnostic such as
`resource.description.missingTarget`.

A separate raw route should expose source bytes for preview and asset use cases:

```text
/<root>/raw/users/tiscs.md
/<root>/raw/assets/logo.png
/<root>/raw/media/demo.mp4
```

The raw route is distinct from app routes such as `/<root>/users/tiscs.md`,
which should load the WebApp shell and let the application render or preview
the file.

## In Scope

- Add a `/<root>/raw/{*path}` HTTP route in `forma serve`.
- Resolve raw route paths as safe workspace-relative paths.
- Return workspace file bytes directly without `file.render`, schema
  validation, index lookup, or references lookup.
- Set reasonable `Content-Type` values for common text, image, audio, video,
  and data files.
- Return `404` for missing files and never fallback raw requests to the WebApp
  shell.
- Reject path traversal, absolute paths, and local-only or private workflow
  paths.
- Preserve configured `root_path` behavior.
- Keep non-Markdown resource files out of collections, graph nodes, backlinks,
  and knowledge-entry checks by default.
- Treat `filename.ext.md` resource description documents as normal knowledge
  files when they match collection rules.
- Add health checks for resource description documents whose target resource is
  missing.
- Add focused route tests.

## Out Of Scope

- Full media preview UI.
- Range request support for audio/video seeking.
- ETag, Last-Modified, or advanced cache negotiation.
- Authentication or multi-user authorization.
- Changing canonical app route behavior for workspace files.
- Replacing RPC render/source operations.

## Acceptance Criteria

- `/<root>/raw/users/tiscs.md` returns the source Markdown file bytes when the
  file is allowed and exists.
- `/<root>/raw/assets/logo.png` and similar binary files return raw bytes with a
  suitable content type.
- Missing raw files return `404`.
- Raw routes reject unsafe paths, path traversal, and configured local-only or
  private paths.
- Raw routes do not return `index.html` as fallback.
- Raw routes work when `forma serve --root-path /forma` is configured.
- Non-Markdown resources such as `assets/logo.png` do not become collection
  entries, graph nodes, or backlink participants by default.
- Resource description documents such as `assets/logo.png.md` are normal
  knowledge documents when they match collection rules.
- `assets/logo.png.md` without `assets/logo.png` causes health checks to fail
  with a missing resource target diagnostic.
- Focused Rust route tests pass.

## Relationship Notes

This task supports future file preview work and real app routes, but it should
not block the current reference navigation baseline. It can be implemented
before or during the WebApp route refactor if resource preview needs become
immediate.

Range requests and caching should remain explicit follow-up work unless the
first media preview implementation needs them.

## Open Questions

- Which workspace paths are allowed for raw access by default?
- Should `.forma/` files ever be raw-viewable, or should raw access initially
  exclude hidden directories entirely?
- Should text source preview eventually use `/raw/...` instead of
  `file.render` with `format: source`?
- Should resource description documents require a `target` frontmatter field,
  or is the filename-derived target enough?
