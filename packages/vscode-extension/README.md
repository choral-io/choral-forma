# Forma for VS Code

Forma for VS Code keeps repository Markdown as the source of truth while adding workspace status, reference navigation, and themed previews for Forma views. Product information is available at [forma.choral.io](https://forma.choral.io).

## Requirements

Forma for VS Code requires a CLI with the same coordinated release version as the extension. It first honors the machine-level `forma.path` setting, then a matching binary managed inside extension storage, and finally `forma` on the Extension Host `PATH`.

When no matching CLI is available, the extension can download the exact release-aligned binary after explicit user confirmation. The download is checksum-verified, stored in a versioned extension directory, and does not modify `PATH` or overwrite an externally managed binary. The extension never executes a binary path supplied by workspace content.

By default, each VS Code Workspace Folder uses its root `.forma.md`. For a monorepo, set the resource-scoped `forma.workspaceConfig` setting to a Workspace Folder-relative main file such as `docs/.forma.md`; that file's parent directory becomes the Forma workspace root. Absolute paths, parent traversal, backslashes, and alternate filenames are rejected.

Download the `.vsix` asset from the matching GitHub prerelease, then run **Extensions: Install from VSIX…** in VS Code. The current internal VSIX is intended for internal distribution and is not published to Marketplace.

## Current internal release features

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
- shows an intentional deferred state for graph views.

The extension runs as a workspace extension, so the Forma binary, managed storage, and workspace files remain colocated in local or remote extension hosts. A Remote host must either reach the matching GitHub Release or provide Forma through `forma.path` or its own `PATH`. Local workspaces are the current internal release gate; individual remote environments are not yet claimed as fully validated.

## Trust and troubleshooting

In Restricted Mode the extension neither downloads nor executes Forma. Trust the workspace to enable CLI installation, discovery, checks, navigation, and previews. Use **Forma: Open Output** for bounded command diagnostics. Missing and incompatible binaries are reported without preventing extension activation.

View source always opens in the normal Markdown editor. Forma uses VS Code's native Markdown Preview, which remains read-only and refreshes after saved changes.
