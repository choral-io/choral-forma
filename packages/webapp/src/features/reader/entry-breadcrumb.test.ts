import { describe, expect, it } from "vitest";

import { directoryBreadcrumb, entryDirectoryBreadcrumb } from "./entry-breadcrumb";

describe("entryDirectoryBreadcrumb", () => {
    it("leads from Pages through each containing directory to its page", () => {
        expect(entryDirectoryBreadcrumb("knowledge/design/reader.md")).toEqual([
            { label: "Pages", to: "/pages" },
            { label: "knowledge", to: "/pages/knowledge" },
            { label: "design", to: "/pages/knowledge/design" },
        ]);
    });

    it("leads only to Pages for a root-level entry", () => {
        expect(entryDirectoryBreadcrumb("README.md")).toEqual([{ label: "Pages", to: "/pages" }]);
        expect(entryDirectoryBreadcrumb("/notes.md")).toEqual([{ label: "Pages", to: "/pages" }]);
    });

    it("leaves a directory's own name out of its page's breadcrumb", () => {
        expect(directoryBreadcrumb("a b/c", false)).toEqual([
            { label: "Pages", to: "/pages" },
            { label: "a b", to: "/pages/a%20b" },
        ]);
    });
});
