// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createDiagramViewerResetIcon, diagramViewerResetIconPaths } from "./diagram-viewer-icons";

describe("diagram viewer icons", () => {
    it("shares Lucide RotateCcw geometry between Graph and Mermaid controls", () => {
        expect(diagramViewerResetIconPaths).toEqual(["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"]);

        const icon = createDiagramViewerResetIcon();
        expect(icon.getAttribute("width")).toBe("16");
        expect(icon.getAttribute("height")).toBe("16");
        expect(icon.getAttribute("stroke-width")).toBe("2");
        expect(Array.from(icon.querySelectorAll("path"), (path) => path.getAttribute("d"))).toEqual(
            diagramViewerResetIconPaths,
        );
    });
});
