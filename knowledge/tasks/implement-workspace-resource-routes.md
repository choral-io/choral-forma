---
scope: project
type: task
priority: P1
severity:
value: M
module: app

owners:
    - "members/tiscs"
assignees: []
reviewers: []
tags:
    - forma
    - p1
    - webapp
    - routing
    - resources

effort: M
status: done
readiness: ready
sprint:

blocked_by: []
related_to:
    - "tasks/implement-read-only-webapp"
    - "tasks/implement-reference-navigation-baseline"
    - "tasks/refactor-webapp-with-shadcn-base-ui"
    - "tasks/implement-resource-description-health-diagnostics"

reported_by:
affected_area: WebApp routing and workspace resources
---

# Implement Workspace Resource Routes

## Goal

Define and implement workspace resource route behavior, including app-facing workspace file URLs and raw source access for repository-backed resources.

## Sources

- [[tasks/implement-read-only-webapp]]
- [[tasks/implement-reference-navigation-baseline]]
- [[tasks/refactor-webapp-with-shadcn-base-ui]]
- Current product design discussion about canonical file URLs, `root_path`, dynamic `<base href>`, and future image, audio, and video previews.

## Context

Forma should treat WebApp document URLs as workspace file URLs, with file extensions preserved. This keeps Markdown, MDX, text, JSON, image, audio, video, and other workspace resources in the same route model and avoids ambiguity when files share the same basename with different extensions.

Only Markdown and MDX files should participate in the knowledge system by default. Non-Markdown files are workspace resources: they may be browsed, previewed, linked, and served through raw routes, but they should not enter spaces, graph nodes, backlinks, or knowledge checks as knowledge entries.

When a resource needs durable knowledge, create an explicit Markdown description document next to it:

```text
assets/logo.png
assets/logo.png.md
media/demo.mp4
media/demo.mp4.md
data/sample.json
data/sample.json.md
```

The description document is a normal knowledge file. It may contain frontmatter, links, owners, sources, licensing notes, usage constraints, and review context. The resource file remains a resource; the description document is the knowledge entry. If a resource exists without a description document, that is allowed. Health diagnostics for missing resource targets are split to [[tasks/implement-resource-description-health-diagnostics]].

A separate raw route should expose source bytes for preview and asset use cases:

```text
/<root>/raw/members/alex-chen.md
/<root>/raw/assets/logo.png
/<root>/raw/media/demo.mp4
```

The raw route is distinct from app routes such as `/<root>/members/alex-chen.md`, which should load the WebApp shell and let the application render or preview the file.

## In Scope

- Add a `/<root>/raw/{*path}` HTTP route in `forma serve`.
- Resolve raw route paths as safe workspace-relative paths.
- Return workspace file bytes directly without `file.render`, schema validation, index lookup, or references lookup.
- Set reasonable `Content-Type` values for common text, image, audio, video, and data files.
- Return `404` for missing files and never fallback raw requests to the WebApp shell.
- Reject path traversal, absolute paths, and local-only or private workflow paths.
- Preserve configured `root_path` behavior.
- Keep non-Markdown resource files out of spaces, graph nodes, backlinks, and knowledge-entry checks by default.
- Treat `filename.ext.md` resource description documents as normal knowledge files when they match space rules.
- Add focused route tests.

## Out Of Scope

- Resource-description health diagnostics for missing target resources.
- Range request support for audio/video seeking.
- ETag, Last-Modified, or advanced cache negotiation.
- Authentication or multi-user authorization.
- Changing canonical app route behavior for workspace files.
- Replacing RPC render/source operations.

## Acceptance Criteria

- `/<root>/raw/members/alex-chen.md` returns the source Markdown file bytes when the file is allowed and exists.
- `/<root>/raw/assets/logo.png` and similar binary files return raw bytes with a suitable content type.
- Missing raw files return `404`.
- Raw routes reject unsafe paths, path traversal, and configured local-only or private paths.
- Raw routes do not return `index.html` as fallback.
- Raw routes work when `forma serve --root-path /forma` is configured.
- Non-Markdown resources such as `assets/logo.png` do not become space entries, graph nodes, or backlink participants by default.
- Resource description documents such as `assets/logo.png.md` are normal knowledge documents when they match space rules.
- Focused Rust route tests pass.

## Validation Notes

- Raw workspace routes already exist under `/<root>/raw/{*path}` in `forma serve`.
- Raw route handling preserves configured `root_path`, sets media content types, rejects traversal and local-only paths, and avoids WebApp fallback for raw requests.
- `files.list` classifies safe non-Markdown files as `resource`, assigns `mediaType`, and uses server-owned feature flags such as `preview.media` and `render.source`.
- The validation WebApp can preview image, audio, and video resources through the raw route when `preview.media` is present.
- Existing focused tests cover raw route serving, traversal rejection, local-only rejection, symlink escape rejection, resource media types, and resource preview features.
- Verified on 2026-05-24:
    - `cargo test -p forma-cli raw -- --nocapture`
    - `cargo test -p forma-core files_list_reports_media_type_and_resource_preview_features -- --nocapture`

## Relationship Notes

This task supports future file preview work and real app routes, but it should not block the current reference navigation baseline. It can be implemented before or during the WebApp route refactor if resource preview needs become immediate.

Range requests and caching should remain explicit follow-up work unless the first media preview implementation needs them.

## Open Questions

- Which workspace paths are allowed for raw access by default?
- Should `.forma/` files ever be raw-viewable, or should raw access initially exclude hidden directories entirely?
- Should text source preview eventually use `/raw/...` instead of `file.render` with `format: source`?
