# Forma for VS Code

Forma for VS Code keeps repository Markdown as the source of truth while adding workspace status, reference navigation, and themed previews for Forma views. Product information is available at [forma.choral.io](https://forma.choral.io).

## Requirements

Install a compatible `forma` binary separately and make it available on the extension host `PATH`, or set the user-level `forma.path` setting to an absolute executable path. The extension never downloads or bundles Forma, and it never executes a binary path supplied by workspace content.

Download `forma-0.1.0-alpha.13.vsix` from the matching GitHub prerelease, then run **Extensions: Install from VSIX…** in VS Code. The Alpha 13 VSIX is intended for internal distribution and is not published to Marketplace.

## Alpha 13 features

- discovers `.forma.md` workspaces;
- navigates Markdown links, wikilinks, embeds, heading fragments, and semantic references;
- previews saved list, table, and kanban views beside editable Markdown source;
- follows VS Code light, dark, high-contrast, font, focus, and reduced-motion settings;
- shows an intentional deferred state for graph views.

The extension runs as a workspace extension, so the Forma binary and workspace files remain colocated in local or remote extension hosts. Local workspaces are the Alpha 13 release gate; individual remote environments are not yet claimed as fully validated.

## Trust and troubleshooting

In Restricted Mode the extension does not execute Forma. Trust the workspace to enable discovery, checks, navigation, and previews. Use **Forma: Open Output** for bounded command diagnostics. A missing binary is reported as `Forma: CLI not found` without preventing extension activation.

View source always opens in the normal Markdown editor. Previews are read-only and refresh after saved changes.
