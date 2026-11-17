---
schemaVersion: 1
kind: release
title: Forma v0.2.0
summary: Exact reader URLs, shared route validation, and VS Code 1.134 support.
scope: project
type: release
status: released
version: v0.2.0
date: 2026-11-18
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
    - "releases/forma-v0.1.40"
---

# Forma v0.2.0

## Scope

Coordinated Public Preview release following [[releases/forma-v0.1.40]]. The immutable source candidate is `1fbcdc49d6dde382c307656910cf008dd2623be2`. This release changes the public URL layout for the local reader and static sites. It aligns the CLI and VS Code extension at 0.2.0 and raises the VS Code minimum to 1.134.0. The repository's Zed package version stays aligned.

## Included Changes

- Use exact Markdown file paths for reader URLs. Give directories their own pages and move collections to `/~`. Derive public View IDs from the workspace projection, with stable digest suffixes for conflicting basenames.
- Resolve Markdown short paths consistently in the RPC reader and static export. Preserve query parameters and fragments. Leave ambiguous references unresolved.
- Check static path ownership on the destination filesystem before artifact activation. Report Unicode equivalence and file/directory conflicts together and preserve the previous site when a build fails.
- Bind static enhancement data and deployment verification to the generated artifact. Keep initial HTML readable if enhancement fails, and support retry when a page cannot load during navigation.
- Require VS Code 1.134.0 or later for the new VSIX. The extension continues to use native Markdown Preview and a matching Forma CLI.

## URL Migration

Update bookmarks, published Markdown links, and RPC clients before switching a deployed site. The previous public URL layout has no automatic compatibility redirects. Author-relative Markdown paths continue to resolve against the workspace.

| Previous link or convention                               | Forma 0.2.0                                                                                   |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/pages`                                                  | `/`, which includes the root directory listing                                                |
| `/pages/notes/welcome` or an extensionless document route | `/notes/welcome.md` using the exact file path                                                 |
| A folder landing page                                     | `/notes` for the directory, `/notes/index.md` to open the source document                     |
| `/browse`, `/taxonomies`, or `/-/browse`                  | `/~`                                                                                          |
| `/<taxonomy>` or `/-/browse/<taxonomy>`                   | `/~/<taxonomy>`                                                                               |
| `/<taxonomy>/<term>` or `/-/browse/<taxonomy>/<term>`     | `/~/<taxonomy>/<term>`                                                                        |
| `/views` and `/views/<id>`                                | `/-/views` and `/-/views/<public-id>`. Look up the new View URL in the navigation or sitemap. |
| `/health` and `/raw/<path>`                               | `/-/health` and `/-/raw/<path>`                                                               |
| `/rpc` in `forma serve`                                   | `/-/rpc`                                                                                      |
| Static `/assets/…` and `/data/…`                          | `/-/assets/…` and `/-/data/<artifactId>/…` from the rebuilt site                              |

Keep the deployment prefix and any query and fragment that still apply to the destination. For example, use `/preview/notes/welcome.md?mode=reader#setup` in place of `/preview/pages/notes/welcome?mode=reader#setup` when the heading has that same anchor. Rebuild and replace the entire static artifact so HTML, assets, and manifest data come from the same build. If you maintain redirects in your host, map specific old URLs and verify each destination. An old URL can now belong to a directory or another source.

## Validation

The exact candidate passed `mise run version:check -- v0.2.0`, `CI=true mise run check`, and Forma content and workspace-health checks with zero errors and warnings. The full reader browser gate passed 76 of 76 checks each in Chromium and WebKit on the integrated reader code, which stayed the same through the Windows CLI fixes. Coverage included RPC, initial static HTML and enhanced static navigation at the root and `/preview`, plus footnote direct navigation, refresh and return-link focus with default motion settings. A site built with the published 0.1.40 CLI was rebuilt with the 0.2.0 candidate under both deployment roots to verify the migration.

On macOS arm64, trusted Extension Host and packaged VSIX checks passed on VS Code 1.134.0 and 1.146.0, including installation, activation and functional checks with the matching CLI. Restricted Mode passed on 1.134.0. VS Code 1.123.2 rejected the 0.2.0 VSIX as incompatible. The package declares `engines.vscode: ^1.134.0` and the source uses `@types/vscode ~1.134.0`.

All 13 jobs passed on the exact source in main CI, including the site deployment. The arm64 macOS job required a same-source retry after the hosted runner failed to start. Earlier Windows runs exposed a CRLF test-fixture issue and a separate CLI defect involving native volume prefixes. The final Windows runner passed 5 site unit tests and 9 site CLI tests covering absolute and relative outputs, junctions, protected paths and previous artifact preservation. UNC path representations were covered by unit tests. [Main CI run](https://github.com/choral-io/choral-forma/actions/runs/44127373421) · [Windows job](https://github.com/choral-io/choral-forma/actions/runs/44127373421/job/134194739722)

The Linux runner's actual output volume kept both tested pairs of Unicode variants distinct, and all four encoded routes passed. The Cloudflare gate passed 264 positive, 14 rejection and RPC comparison, and 545 candidate assertions. The 599-file deployment used artifact ID `3e90a10aedc3273e63a48e89f665d2b78f3428bcb8795794d0bd98176ec989f1` and recorded file-tree SHA-256 `922434a962eb1f31c87c29c10953554cac6fb79664ee88cd01129946ebcc290c`. Production readback matched the source marker and artifact ID. Browser checks confirmed readable initial HTML without JavaScript and enhanced direct navigation and refresh preserving repeated query parameters, percent encoding and the migration fragment. Directory, taxonomy term and View URLs worked, and two representative legacy URLs returned 404. [Deployment job](https://github.com/choral-io/choral-forma/actions/runs/44127373421/job/134215713558) · [Online migration section](https://forma.choral.io/knowledge/releases/forma-v0.2.0.md#url-migration)

## Publication Evidence

- The protected Release workflow passed all 11 jobs, including five CLI builds, VSIX host tests and packaging, immutable asset assembly, release promotion, published-release verification and Marketplace publication. Candidate artifact `14352113798` had ZIP SHA-256 `f963e2cbe54142b58d58eb202e4accb0be1f93e2bd0233a3d19de066b8f8a161`. Both protected jobs received approval under the existing reviewer rules. [Release workflow](https://github.com/choral-io/choral-forma/actions/runs/44133866020)
- Annotated tag `v0.2.0` is object `cbeedef1ada272020f3534c6338b6c12b59085ed` and resolves to the exact candidate above. GitHub published the stable release at `2026-11-17T17:34:27Z`. All 22 expected public asset sizes and digests matched the immutable candidate manifest. [GitHub Release](https://github.com/choral-io/choral-forma/releases/tag/v0.2.0)
- `mise run release:verify -- v0.2.0` passed on macOS arm64. All 11 payloads matched their published SHA-256 files. The standalone CLI and a fresh production managed installation both returned `forma 0.2.0`. The native `forma-macos-arm64` SHA-256 is `f14b87ea7aeb554e63ebc469c7ac3266d1220cc877b3cae01aea6e587467688d`.
- The published VSIX is `choral-io.forma@0.2.0`, engine `^1.134.0`, 392,365 bytes, SHA-256 `e8824dab82ab3e3862b5a35c2829d1da4f920bb7795b91eca54aaee3705b95d5`. Marketplace reported publication at `2026-11-17T17:38:02Z`. The public exact-version Marketplace download returned HTTP 200 and, after HTTP gzip decoding, matched the GitHub VSIX byte for byte. [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=choral-io.forma) · [Exact-version Marketplace download](https://marketplace.visualstudio.com/_apis/public/gallery/publishers/choral-io/vsextensions/forma/0.2.0/vspackage)
- Public readback through `vsce show choral-io.forma --json` and the Gallery API showed 0.2.0 as the latest validated version, with version timestamp `2026-11-17T17:48:12.990Z`. Its `Microsoft.VisualStudio.Services.VsixSha256` matched both public downloads and the immutable manifest. [Marketplace version history](https://marketplace.visualstudio.com/items?itemName=choral-io.forma&ssr=false#version-history)

## Known Boundaries

The cause of the historical footnote return-link focus timeouts remains open. Direct navigation, refresh and return-link clicks passed the current default-motion browser gate. Physical mobile devices, real screen-reader announcements, native Safari, native VS Code clicks on paths containing `|`, `#` or percent signs, live UNC shares, Remote SSH, Dev Containers, WSL, signing and notarization remain unverified. Zed Registry publication was outside this release.

## Rollback

Retain the previous complete website artifact for rollback. Keep existing release tags and packages immutable. Ship corrections to published CLI or VSIX artifacts in a higher coordinated version.
