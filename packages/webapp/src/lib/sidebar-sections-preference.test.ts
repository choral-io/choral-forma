// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    collapsedSidebarSections,
    readCollapsedSidebarSections,
    resetSidebarSectionsForTest,
    subscribeSidebarSections,
    toggleSidebarSection,
} from "./sidebar-sections-preference";

describe("sidebar section preference", () => {
    afterEach(() => {
        window.localStorage.clear();
        resetSidebarSectionsForTest();
        vi.restoreAllMocks();
    });

    it("starts with every section expanded and ignores unknown or malformed values", () => {
        expect(readCollapsedSidebarSections()).toBe("");
        resetSidebarSectionsForTest();
        window.localStorage.setItem("forma.sidebarSections", JSON.stringify(["workspace", "pages"]));
        expect(collapsedSidebarSections(readCollapsedSidebarSections())).toEqual(new Set(["workspace"]));
        resetSidebarSectionsForTest();
        window.localStorage.setItem("forma.sidebarSections", "{");
        expect(readCollapsedSidebarSections()).toBe("");
    });

    it("toggles a section, remembers it, and notifies subscribers until they unsubscribe", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSidebarSections(listener);

        toggleSidebarSection("files");
        expect(readCollapsedSidebarSections()).toBe("files");
        expect(window.localStorage.getItem("forma.sidebarSections")).toBe('["files"]');
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        toggleSidebarSection("files");
        expect(readCollapsedSidebarSections()).toBe("");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("keeps a change for the page when storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(readCollapsedSidebarSections()).toBe("");
        expect(() => {
            toggleSidebarSection("workspace");
        }).not.toThrow();
        expect(readCollapsedSidebarSections()).toBe("workspace");
    });
});
