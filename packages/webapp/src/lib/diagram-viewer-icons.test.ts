// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
    createDiagramViewerCollapseIcon,
    createDiagramViewerExpandIcon,
    createDiagramViewerResetIcon,
    diagramViewerCollapseIconPaths,
    diagramViewerExpandIconPaths,
    diagramViewerResetIconPaths,
} from "./diagram-viewer-icons";

describe("diagram viewer icons", () => {
    it("shares Lucide geometry between Graph and Mermaid controls", () => {
        expect(diagramViewerResetIconPaths).toEqual(["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"]);
        expect(diagramViewerExpandIconPaths).toEqual(["M15 3h6v6", "m21 3-7 7", "m3 21 7-7", "M9 21H3v-6"]);
        expect(diagramViewerCollapseIconPaths).toEqual(["m14 10 7-7", "M20 10h-6V4", "m3 21 7-7", "M4 14h6v6"]);

        for (const [icon, paths] of [
            [createDiagramViewerResetIcon(), diagramViewerResetIconPaths],
            [createDiagramViewerExpandIcon(), diagramViewerExpandIconPaths],
            [createDiagramViewerCollapseIcon(), diagramViewerCollapseIconPaths],
        ] as const) {
            expect(icon.getAttribute("width")).toBe("16");
            expect(icon.getAttribute("height")).toBe("16");
            expect(icon.getAttribute("stroke-width")).toBe("2");
            expect(Array.from(icon.querySelectorAll("path"), (path) => path.getAttribute("d"))).toEqual(paths);
        }
    });
});
