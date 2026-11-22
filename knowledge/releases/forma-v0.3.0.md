---
schemaVersion: 1
kind: release
title: Forma v0.3.0
summary: Directory introductions with configurable listing placement, copyable paths, and a coordinated reader upgrade.
scope: project
type: release
status: released
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

Public Preview release following [[releases/forma-v0.2.0]]. The CLI, VS Code extension, and Zed development extension align at 0.3.0. The release source is `f98d83201df23078fae0b481287f2cbfacf27d8c`.

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

The independent directory-contract review identified a static link to a missing introduction-title anchor. The fix and its regression test passed independent review. The candidate passed version alignment, the complete local repository gate, Forma content and workspace health checks, and packaged VSIX installation and activation on VS Code 1.134.0.

A local migration used the published 0.2.0 binary and the 0.3.0 candidate. The directory URL continued to work, the standalone document kept its URL, and the directory title, summary, and listing placement matched the authored introduction. The Getting Started browser regression passed in the local reader and in enhanced and JavaScript-disabled static output.

All 13 main CI jobs passed for the exact source. The website deployed that source, and its public source marker matched the candidate SHA. [Main CI](https://github.com/choral-io/choral-forma/actions/runs/45027168298)

## Publication Evidence

- All 11 jobs passed in the protected Release workflow, including five CLI builds, VS Code extension tests and packaging, candidate assembly, GitHub promotion, verification of the public release, and Marketplace publication. The immutable workflow artifact `14759205077` has ZIP SHA-256 `69640140f258790fd7f42575e1dc7e0039ceaf2afebef9914619961c789fee33`. Its manifest and checksums verified locally against the exact source before promotion. [Release workflow](https://github.com/choral-io/choral-forma/actions/runs/45031837889)
- Annotated tag `v0.3.0` is object `f53245c6f6b9b85c27c17a844ae18086b6f52cdb` and resolves to the release source. GitHub published it at `2026-11-22T14:43:55Z`. All 22 public asset sizes and SHA-256 digests match the candidate manifest. [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.3.0)
- `mise run release:verify -- v0.3.0` passed on Apple Silicon macOS under [[guidelines/release-execution-and-verification]]. All 11 downloaded payloads matched their published checksums. The standalone and managed installations both reported `forma 0.3.0`. The public shell installer also installed that version into an isolated directory, and the installed CLI checked Getting Started with zero errors and warnings. The standalone `forma-macos-arm64` SHA-256 is `d121c6d76c96329073a8238f22ac772f59aa35a3e721b40b701f68159d4e0ce8`.
- The published VSIX is `choral-io.forma@0.3.0`, engine `^1.134.0`, 392,568 bytes, SHA-256 `6d4758b717dc40b32e156ffb8921a0f877ec8f18e88cdb2609646d46295f3aa5`. The public exact-version Marketplace download matched the GitHub VSIX byte for byte. The Marketplace catalog listed 0.3.0 as latest with the same hash and a version timestamp of `2026-11-22T14:51:53.730Z`. [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=choral-io.forma) · [Exact-version Marketplace download](https://marketplace.visualstudio.com/_apis/public/gallery/publishers/choral-io/vsextensions/forma/0.3.0/vspackage)

## Known Boundaries

Zed 0.3.0 is available as a development extension in the tagged source. The official Zed catalog and registry search returned no Forma listing. Local installation verification used Apple Silicon macOS. The workflow built the other CLI targets, and local acceptance did not exercise their native installers, Remote SSH, Dev Containers, WSL, signing, or notarization. [Zed development extension](https://github.com/choral-io/choral-forma/tree/v0.3.0/extensions/zed) · [Zed extension catalog](https://github.com/zed-industries/extensions/blob/main/extensions.toml)

## Rollback

Keep the previous complete static artifact available for rollback. Use matching CLI and extension versions when rolling back an installation.
