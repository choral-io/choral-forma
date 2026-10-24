// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreReaderFragment, scrollReaderAnchor } from "./reader-anchor-navigation";

describe("scrollReaderAnchor", () => {
    afterEach(() => {
        document.body.replaceChildren();
        window.history.replaceState(null, "", "/");
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it.each(["unchanged", "focus moved", "fragment changed", "detached", "closed again"])(
        "guards deferred disclosure focus when %s",
        (change) => {
            const callbacks: FrameRequestCallback[] = [];
            vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
                callbacks.push(callback);
                return 1;
            });
            const reader = document.createElement("div");
            reader.innerHTML =
                '<details data-callout-fold><summary>Context</summary><h2 id="deferred">Target</h2></details><button>Other</button>';
            document.body.append(reader);
            const target = reader.querySelector<HTMLElement>("h2");
            const other = reader.querySelector("button");
            if (!target || !other) throw new Error("Missing fixture");
            target.scrollIntoView = vi.fn();
            const focus = vi.spyOn(target, "focus").mockImplementationOnce(() => {
                /* Native disclosure descendants can reject focus before paint. */
            });
            window.history.replaceState(null, "", "/#deferred");
            restoreReaderFragment(reader);
            expect(callbacks).toHaveLength(1);
            if (change === "focus moved") other.focus();
            if (change === "fragment changed") window.history.replaceState(null, "", "/#other");
            if (change === "detached") reader.remove();
            if (change === "closed again") reader.querySelector("details")?.removeAttribute("open");
            callbacks[0]?.(0);
            callbacks[1]?.(16);
            expect(focus).toHaveBeenCalledTimes(change === "unchanged" ? 2 : 1);
            if (change === "unchanged") expect(document.activeElement).toBe(target);
            if (change === "focus moved") expect(document.activeElement).toBe(other);
        },
    );

    it.each(["link", "history"])("reveals a folded callout before %s target navigation", (mode) => {
        const reader = document.createElement("div");
        reader.innerHTML =
            '<details data-callout-fold><summary>Context</summary><h2 id="folded-target">Target</h2></details><details><summary>Unrelated</summary></details>';
        document.body.append(reader);
        const details = reader.querySelector<HTMLDetailsElement>("details[data-callout-fold]");
        const target = reader.querySelector<HTMLElement>("#folded-target");
        if (!target || !details) throw new Error("Missing fixture");
        target.scrollIntoView = vi.fn(() => {
            expect(details.open).toBe(true);
        });
        const focus = vi.spyOn(target, "focus");
        if (mode === "link") {
            const anchor = document.createElement("a");
            anchor.href = "#folded-target";
            scrollReaderAnchor(anchor);
        } else {
            window.history.replaceState(null, "", "/#folded-target");
            restoreReaderFragment(reader);
        }
        expect(details.open).toBe(true);
        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(reader.querySelector("details:not([data-callout-fold])")?.hasAttribute("open")).toBe(false);
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
    it("restores encoded deep links after rendering and focuses the actual heading", () => {
        const reader = document.createElement("div");
        const heading = document.createElement("h4");
        const alias = document.createElement("span");
        alias.id = "forma-heading-中文";
        alias.dataset.formaHeadingAnchor = "";
        heading.append(alias, "中文");
        reader.append(heading);
        document.body.append(reader);
        window.history.replaceState(null, "", "/pages/example#forma-heading-%E4%B8%AD%E6%96%87");
        alias.scrollIntoView = vi.fn();
        restoreReaderFragment(reader);
        expect(document.activeElement).toBe(heading);
    });

    it("focuses an omitted-title alias itself instead of its reader container", () => {
        const reader = document.createElement("div");
        const alias = document.createElement("span");
        alias.id = "forma-heading-title";
        alias.dataset.formaHeadingAnchor = "";
        reader.append(alias);
        document.body.append(reader);
        window.history.replaceState(null, "", "/pages/example#forma-heading-title");
        alias.scrollIntoView = vi.fn();
        restoreReaderFragment(reader);
        expect(document.activeElement).toBe(alias);
    });
    it("keeps compact static directory navigation in the same document", () => {
        const target = document.createElement("li");
        target.id = "note";
        document.body.append(target);
        window.history.replaceState(null, "", "/pages/example/");
        const anchor = document.createElement("a");
        anchor.href = "/pages/example#note";
        expect(scrollReaderAnchor(anchor)).toBe(true);
        expect(window.location.pathname).toBe("/pages/example/");
        expect(window.location.hash).toBe("#note");
        expect(document.activeElement).toBe(target);
    });
});
