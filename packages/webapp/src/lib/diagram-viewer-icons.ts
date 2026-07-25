/**
 * Browser-neutral icon geometry shared by React-hosted Graph controls and the
 * DOM-built Mermaid viewer. Paths follow Lucide's RotateCcw glyph.
 */
export const diagramViewerResetIconPaths = ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"] as const;

export function createDiagramViewerResetIcon() {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("fill", "none");
    icon.setAttribute("height", "16");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "16");
    for (const pathData of diagramViewerResetIconPaths) {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        icon.append(path);
    }
    return icon;
}
