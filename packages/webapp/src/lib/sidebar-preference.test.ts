// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readSidebarOpenPreference, writeSidebarOpenPreference } from "./sidebar-preference";

describe("sidebar preference", () => {
    afterEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it("starts open and remembers an explicit collapse", () => {
        expect(readSidebarOpenPreference()).toBe(true);
        writeSidebarOpenPreference(false);
        expect(readSidebarOpenPreference()).toBe(false);
        writeSidebarOpenPreference(true);
        expect(readSidebarOpenPreference()).toBe(true);
    });

    it("stays open when storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => {
            writeSidebarOpenPreference(false);
        }).not.toThrow();
        expect(readSidebarOpenPreference()).toBe(true);
    });
});
