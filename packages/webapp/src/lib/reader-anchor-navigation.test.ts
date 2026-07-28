// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { scrollReaderAnchor } from "./reader-anchor-navigation";

describe("scrollReaderAnchor", () => {
    afterEach(() => {
        document.body.replaceChildren();
        window.history.replaceState(null, "", "/");
    });

    it("keeps desktop outline navigation inside the reader scroll container", () => {
        const main = document.createElement("main");
        const target = document.createElement("h2");
        target.id = "diagrams";
        main.append(target);
        document.body.append(main);
        Object.defineProperties(main, {
            clientHeight: { configurable: true, value: 400 },
            scrollHeight: { configurable: true, value: 1_200 },
            scrollTop: { configurable: true, value: 80, writable: true },
        });
        main.getBoundingClientRect = () => new DOMRect(0, 112, 800, 400);
        target.getBoundingClientRect = () => new DOMRect(0, 312, 800, 32);
        const scrollTo = vi.fn();
        main.scrollTo = scrollTo;
        const anchor = document.createElement("a");
        anchor.href = `${window.location.origin}/pages/example#diagrams`;

        expect(scrollReaderAnchor(anchor)).toBe(true);
        expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 280 });
        expect(window.location.pathname + window.location.hash).toBe("/pages/example#diagrams");
    });

    it("leaves native fragment navigation in place when the reader does not own scrolling", () => {
        const main = document.createElement("main");
        const target = document.createElement("h2");
        target.id = "diagrams";
        main.append(target);
        document.body.append(main);
        Object.defineProperties(main, {
            clientHeight: { configurable: true, value: 400 },
            scrollHeight: { configurable: true, value: 400 },
        });
        const anchor = document.createElement("a");
        anchor.href = `${window.location.origin}/pages/example#diagrams`;

        expect(scrollReaderAnchor(anchor)).toBe(false);
        expect(window.location.hash).toBe("");
    });

    it("keeps a target disclosure collapsed while navigating to it", () => {
        const main = document.createElement("main");
        const details = document.createElement("details");
        details.id = "document-details";
        main.append(details);
        document.body.append(main);
        Object.defineProperties(main, {
            clientHeight: { configurable: true, value: 400 },
            scrollHeight: { configurable: true, value: 1_200 },
            scrollTop: { configurable: true, value: 80, writable: true },
        });
        main.getBoundingClientRect = () => new DOMRect(0, 112, 800, 400);
        details.getBoundingClientRect = () => new DOMRect(0, 312, 800, 32);
        const scrollTo = vi.fn();
        main.scrollTo = scrollTo;
        const anchor = document.createElement("a");
        anchor.href = `${window.location.origin}/pages/example#document-details`;

        expect(details.open).toBe(false);
        expect(scrollReaderAnchor(anchor)).toBe(true);
        expect(details.open).toBe(false);
        expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 280 });
    });
});
