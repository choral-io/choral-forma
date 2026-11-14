import { describe, expect, it } from "vitest";

import { entryDirectoryBreadcrumb } from "./entry-breadcrumb";

describe("entryDirectoryBreadcrumb", () => {
    it("lists containing directories without the file itself", () => {
        expect(entryDirectoryBreadcrumb("knowledge/design/reader.md")).toEqual([
            { label: "knowledge" },
            { label: "design" },
        ]);
    });

    it("is empty for a root-level entry", () => {
        expect(entryDirectoryBreadcrumb(".forma.md")).toEqual([]);
        expect(entryDirectoryBreadcrumb("/notes.md")).toEqual([]);
    });
});
