// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readCollapsedSidebarSections, writeCollapsedSidebarSections } from "./sidebar-sections-preference";

describe("sidebar section preference", () => {
    afterEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it("starts with every section expanded and ignores unknown or malformed values", () => {
        expect(readCollapsedSidebarSections()).toEqual(new Set());
        window.localStorage.setItem("forma.sidebarSections", JSON.stringify(["workspace", "views"]));
        expect(readCollapsedSidebarSections()).toEqual(new Set(["workspace"]));
        window.localStorage.setItem("forma.sidebarSections", "{");
        expect(readCollapsedSidebarSections()).toEqual(new Set());
    });

    it("remembers collapsed sections", () => {
        writeCollapsedSidebarSections(new Set(["workspace", "pages"]));
        expect(window.localStorage.getItem("forma.sidebarSections")).toBe('["pages","workspace"]');
        expect(readCollapsedSidebarSections()).toEqual(new Set(["pages", "workspace"]));
    });

    it("keeps working when storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => {
            writeCollapsedSidebarSections(new Set(["workspace"]));
        }).not.toThrow();
        expect(readCollapsedSidebarSections()).toEqual(new Set());
    });
});
