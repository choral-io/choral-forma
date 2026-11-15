// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readSidebarTab, subscribeSidebarTab, writeSidebarTab } from "./sidebar-tab-preference";

describe("sidebar tab preference", () => {
    afterEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it("defaults to Files and ignores an unknown stored value", () => {
        expect(readSidebarTab()).toBe("files");
        window.localStorage.setItem("forma.sidebarTab", "collections");
        expect(readSidebarTab()).toBe("files");
    });

    it("stores a choice and notifies subscribers until they unsubscribe", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeSidebarTab(listener);

        writeSidebarTab("workspace");
        expect(readSidebarTab()).toBe("workspace");
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        writeSidebarTab("files");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("keeps working when storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => {
            writeSidebarTab("workspace");
        }).not.toThrow();
        expect(readSidebarTab()).toBe("files");
    });
});
