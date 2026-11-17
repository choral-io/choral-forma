---
schemaVersion: 1
kind: release
title: Forma v0.2.0
summary: Exact reader URLs, shared route validation, and VS Code 1.134 support.
scope: project
type: release
status: planned
version: v0.2.0
date:
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

Coordinated Public Preview release following [[releases/forma-v0.1.40]]. This release changes the public URL layout for the local reader and static sites. It aligns the CLI and VS Code extension at 0.2.0 and raises the VS Code minimum to 1.134.0. The repository's Zed package version stays aligned.

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

## Candidate Gates

Verify version alignment, the full project checks, reader browser regressions, and the Cloudflare gate for the exact candidate. Run the native Windows output preflight regression and check actual output-volume behavior on the Linux site runner. Smoke-test the candidate VSIX with its matching CLI on the supported minimum and current stable VS Code, including Restricted Mode.

After the exact candidate passes main CI, promote the CLI and VSIX through the protected release workflow. Verify downloaded assets, managed CLI installation, and Marketplace metadata before recording publication. The site deploys through the separate main CI path.

## Rollback

Retain the previous complete website artifact for rollback. Keep existing release tags and packages immutable. Ship corrections to published CLI or VSIX artifacts in a higher coordinated version.
