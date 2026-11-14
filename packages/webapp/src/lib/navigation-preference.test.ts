// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { readNavigationStrategy, subscribeNavigationStrategy, writeNavigationStrategy } from "./navigation-preference";

describe("navigation strategy preference", () => {
    afterEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it("defaults to files and ignores an unknown stored value", () => {
        expect(readNavigationStrategy()).toBe("files");
        window.localStorage.setItem("forma.navigation", "tags");
        expect(readNavigationStrategy()).toBe("files");
    });

    it("stores a choice and notifies subscribers until they unsubscribe", () => {
        const listener = vi.fn();
        const unsubscribe = subscribeNavigationStrategy(listener);

        writeNavigationStrategy("collections");
        expect(readNavigationStrategy()).toBe("collections");
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        writeNavigationStrategy("files");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("keeps working when storage is unavailable", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        expect(() => {
            writeNavigationStrategy("collections");
        }).not.toThrow();
        expect(readNavigationStrategy()).toBe("files");
    });
});
