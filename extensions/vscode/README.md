# Forma for VS Code

Forma for VS Code keeps repository Markdown as the source of truth while adding workspace status, reference navigation, and themed previews for Forma views. Product information is available at [forma.choral.io](https://forma.choral.io).

Forma for VS Code is available as a Public Preview. It is intended for early evaluation and feedback, not production-critical workflows.

## Install

Install **Forma for VS Code** from the VS Code Extensions view. When a matching Forma CLI is not already available, the extension offers to download the exact coordinated release after explicit confirmation.

For offline or controlled installation, download the `.vsix` asset from the matching [GitHub Release](https://github.com/choral-io/choral-forma/releases), then run **Extensions: Install from VSIX…** in VS Code.

After installation:

1. Open a trusted folder containing `.forma.md`.
2. Accept the matching CLI installation prompt, or configure an existing binary through `forma.path`.
3. Open the **Forma** panel under Explorer to browse configured content and Views.
4. Open a View in VS Code's native Markdown Preview to inspect its projection while keeping the Markdown source editable.

## Requirements

Forma for VS Code expects a CLI from the same coordinated release as the extension. It first honors the machine-level `forma.path` setting, then a matching binary managed inside extension storage, and finally `forma` on the Extension Host `PATH`. The published Linux GNU binaries and managed Linux assets require glibc **2.31 or newer**; Linux musl/Alpine is not supported by the managed download path. On an older glibc host, configure `forma.path` with a host-compatible build or use a locally built CLI. A compatible running Forma language server reports a package-version difference as an advisory diagnostic on `.forma.md`; the diagnostic links to installation guidance and offers native Quick Fix actions. Structured CLI operations remain protected by their operation schema even when package versions differ.

When no matching CLI is available, the extension can download the exact release-aligned binary after explicit user confirmation. The download is checksum-verified, stored in a versioned extension directory, and does not modify `PATH` or overwrite an externally managed binary. The extension never executes a binary path supplied by workspace content.

By default, each VS Code Workspace Folder uses its root `.forma.md`. For a monorepo, set the resource-scoped `forma.workspaceConfig` setting to a Workspace Folder-relative main file such as `docs/.forma.md`; that file's parent directory becomes the Forma workspace root. Absolute paths, parent traversal, backslashes, and alternate filenames are rejected.

## Public Preview features

- discovers root or explicitly configured `.forma.md` workspaces;
- navigates Markdown links, wikilinks, embeds, heading fragments, and semantic references;
- enhances VS Code's native Markdown Preview with saved list, table, and kanban View projections;
- renders Core-resolved wikilinks as navigable links in native Markdown Preview;
- displays explicit aliases first, resolved document titles second, and source paths as the final wikilink fallback;
- turns Core-resolved frontmatter references into Preview links;
- collapses Frontmatter metadata by default in Forma-managed documents; set `forma.preview.frontmatterDefaultState` to `expanded` to change the initial Preview state;
- adds one Forma panel under Explorer for configured Taxonomies, Terms, entries, and Views;
- opens Views directly in native Preview with mode-specific, theme-aware Lucide icons while bundling only the used SVG assets;
- follows VS Code light, dark, high-contrast, font, focus, and reduced-motion settings;
- renders Graph Views with the shared, theme-aware Forma Graph projection used across supported Hosts.

The extension runs as a workspace extension, so the Forma binary, managed storage, and workspace files remain colocated in local or remote extension hosts. A Remote host must either reach the matching GitHub Release or provide Forma through `forma.path` or its own `PATH`. Local workspaces are the current Public Preview release gate; individual remote environments are not yet claimed as fully validated.

## Trust and troubleshooting

In Restricted Mode the extension neither downloads nor executes Forma. Trust the workspace to enable CLI installation, discovery, checks, navigation, and previews. Use **Forma: Open Output** for bounded command diagnostics. Missing binaries and incompatible operation schemas are reported without preventing extension activation.

View source always opens in the normal Markdown editor. Forma uses VS Code's native Markdown Preview, which remains read-only and refreshes after saved changes.

Forma for VS Code does not collect product telemetry. Public Preview feedback is handled through the repository's [GitHub issues](https://github.com/choral-io/choral-forma/issues).
