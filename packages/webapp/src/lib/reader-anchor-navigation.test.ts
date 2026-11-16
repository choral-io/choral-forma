// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { findFragmentTarget, restoreReaderFragment, scrollReaderAnchor } from "./reader-anchor-navigation";

describe("scrollReaderAnchor", () => {
    afterEach(() => {
        document.body.replaceChildren();
        window.history.replaceState(null, "", "/");
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it.each(
        ["data-callout-fold", "data-markdown-disclosure"].flatMap((attribute) =>
            ["unchanged", "focus moved", "fragment changed", "detached", "closed again"].map((change) => ({
                attribute,
                change,
            })),
        ),
    )("guards deferred $attribute focus when $change", ({ attribute, change }) => {
        const callbacks: FrameRequestCallback[] = [];
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            callbacks.push(callback);
            return 1;
        });
        const reader = document.createElement("div");
        reader.innerHTML = `<details ${attribute}><summary>Context</summary><h2 id="deferred" data-reader-heading-text="Deferred target">Deferred target</h2></details><button>Other</button>`;
        document.body.append(reader);
        const target = reader.querySelector<HTMLElement>("h2");
        const other = reader.querySelector("button");
        if (!target || !other) throw new Error("Missing fixture");
        target.scrollIntoView = vi.fn();
        const focus = vi.spyOn(target, "focus").mockImplementationOnce(() => {
            /* Native disclosure descendants can reject focus before paint. */
        });
        window.history.replaceState(null, "", "/#Deferred%20target");
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
    });

    it("continues restoring the footnote reference when the expanded content is still hidden", () => {
        const callbacks: FrameRequestCallback[] = [];
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => callbacks.push(callback));
        const disclosure = document.createElement("details");
        disclosure.dataset.calloutFold = "";
        const reference = document.createElement("a");
        reference.id = "user-content-fnref-body";
        reference.href = "#user-content-fn-body";
        reference.scrollIntoView = vi.fn();
        disclosure.append(reference);
        document.body.append(disclosure);
        let contentVisible = false;
        const focus = reference.focus.bind(reference);
        vi.spyOn(reference, "focus").mockImplementation((options) => {
            if (contentVisible) focus(options);
        });

        window.history.replaceState(null, "", `/#${reference.id}`);
        restoreReaderFragment(document.body);
        expect(disclosure.open).toBe(true);
        callbacks.shift()?.(0);
        callbacks.shift()?.(16);
        expect(document.activeElement).toBe(document.body);

        contentVisible = true;
        callbacks.shift()?.(32);
        expect(document.activeElement).toBe(reference);
        expect(callbacks).toHaveLength(0);
    });

    it("finds a heading by the text a wiki fragment names when no id matches", () => {
        const reader = document.createElement("main");
        // Reader controls inside a heading do not change which heading the text names.
        reader.innerHTML =
            '<h2 id="lists" data-reader-heading-text="Lists"><span id="forma-heading-lists" data-forma-heading-anchor></span>Lists<button>#</button></h2><h2 id="next-steps-2-0" data-reader-heading-text="Next steps: 2.0">Next steps: 2.0</h2>';
        document.body.append(reader);
        const heading = document.getElementById("lists");
        if (!heading) throw new Error("Missing heading");
        const scrollIntoView = vi.fn();
        heading.scrollIntoView = scrollIntoView;

        expect(findFragmentTarget(document, "Lists")).toBe(heading);
        expect(findFragmentTarget(reader, "LISTS")).toBe(heading);
        expect(findFragmentTarget(document, "Next steps: 2.0")?.id).toBe("next-steps-2-0");
        expect(findFragmentTarget(document, "forma-heading-lists")?.id).toBe("forma-heading-lists");
        expect(findFragmentTarget(document, "Missing")).toBeNull();

        window.history.replaceState(null, "", "/#Lists");
        restoreReaderFragment(reader);
        expect(scrollIntoView).toHaveBeenCalled();
        expect(document.activeElement).toBe(heading);
    });

    it("uses exact heading text instead of guessing a colliding legacy id", () => {
        const reader = document.createElement("main");
        reader.innerHTML =
            '<h2 id="section" data-reader-heading-text="安装">安装</h2><h2 id="section-2" data-reader-heading-text="配置">配置<button>#</button></h2>';
        document.body.append(reader);

        expect(findFragmentTarget(reader, "配置")?.id).toBe("section-2");
        expect(findFragmentTarget(reader, "示例")).toBeNull();
        expect(findFragmentTarget(reader, "section")?.textContent).toBe("安装");
    });

    it("keeps the ASCII legacy fallback from redirecting a missing mixed-language title", () => {
        const reader = document.createElement("main");
        reader.innerHTML =
            '<h2 id="v2" data-reader-heading-text="版本 v2">版本 v2</h2><h2 id="host-visual-2026-09-24" data-reader-heading-text="Host Visual — 2026-09-24">Host Visual — 2026-09-24</h2>';
        document.body.append(reader);

        expect(findFragmentTarget(reader, "缺失版本 v2")).toBeNull();
        expect(findFragmentTarget(reader, "版本 v2")?.id).toBe("v2");
        expect(findFragmentTarget(reader, "V2!")?.id).toBe("v2");
        expect(findFragmentTarget(reader, "Host-Visual-—-2026-09-24")?.id).toBe("host-visual-2026-09-24");
    });

    it("resolves legacy spellings to an omitted title with no historical id in the reader", () => {
        const reader = document.createElement("main");
        reader.innerHTML =
            '<span id="forma-heading-hello-world" data-reader-heading-text="Hello world" data-reader-omitted-title></span>';
        document.body.append(reader);

        expect(findFragmentTarget(reader, "HELLO-WORLD")?.id).toBe("forma-heading-hello-world");
        expect(findFragmentTarget(reader, "hello_world")?.id).toBe("forma-heading-hello-world");

        const bodyHeading = document.createElement("h2");
        bodyHeading.id = "hello-world";
        reader.append(bodyHeading);
        expect(findFragmentTarget(reader, "hello-world")).toBe(bodyHeading);
    });

    it("restores a nested heading after native fragment navigation clears link focus", () => {
        const callbacks: FrameRequestCallback[] = [];
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            callbacks.push(callback);
            return 1;
        });
        document.body.innerHTML =
            '<a href="#alias">Jump</a><details data-markdown-disclosure><summary>Outer</summary><details data-markdown-disclosure><summary>Inner</summary><h2><span id="alias" data-forma-heading-anchor></span>Heading</h2></details></details>';
        const link = document.querySelector<HTMLAnchorElement>("a"),
            heading = document.querySelector("h2");
        if (!link || !heading) throw new Error("Missing fixture");
        link.focus();
        window.history.replaceState(null, "", "/#alias");
        const focus = vi.spyOn(heading, "focus").mockImplementationOnce(() => {
            /* Nested disclosure content is not focusable until expanded paint. */
        });
        const alias = document.getElementById("alias");
        if (!alias) throw new Error("Missing alias");
        alias.scrollIntoView = vi.fn();
        restoreReaderFragment(document.body);
        link.blur(); // Native fragment navigation can clear the opener's focus.
        callbacks[0]?.(0);
        callbacks[1]?.(16);
        expect(focus).toHaveBeenCalledTimes(2);
        expect(document.activeElement).toBe(heading);
    });

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

    it.each(["link", "history"])(
        "opens mixed disclosure ancestors for %s without touching unrelated details",
        (mode) => {
            const reader = document.createElement("div");
            reader.innerHTML =
                '<details data-markdown-disclosure><summary>Outer</summary><details data-callout-fold><summary>Inner</summary><h2 id="nested-fold-target">Target</h2></details></details><details><summary>Unrelated</summary></details>';
            document.body.append(reader);
            const target = reader.querySelector<HTMLElement>("#nested-fold-target");
            if (!target) throw new Error("Missing fixture");
            target.scrollIntoView = vi.fn();
            if (mode === "link") {
                const anchor = document.createElement("a");
                anchor.href = "#nested-fold-target";
                scrollReaderAnchor(anchor);
            } else {
                window.history.replaceState(null, "", "/#nested-fold-target");
                restoreReaderFragment(reader);
            }
            expect(
                [
                    ...reader.querySelectorAll<HTMLDetailsElement>(
                        "details[data-markdown-disclosure], details[data-callout-fold]",
                    ),
                ].every((fold) => fold.open),
            ).toBe(true);
            expect(document.activeElement).toBe(target);
            expect(
                reader
                    .querySelector("details:not([data-markdown-disclosure]):not([data-callout-fold])")
                    ?.hasAttribute("open"),
            ).toBe(false);
        },
    );

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
        anchor.href = `${window.location.origin}/example#diagrams`;

        expect(scrollReaderAnchor(anchor)).toBe(true);
        expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 280 });
        expect(window.location.pathname + window.location.hash).toBe("/example#diagrams");
    });

    it("leaves the target's scroll margin above it", () => {
        const main = document.createElement("main");
        const target = document.createElement("h2");
        target.id = "diagrams";
        target.style.scrollMarginTop = "24px";
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
        anchor.href = `${window.location.origin}/example#diagrams`;

        expect(scrollReaderAnchor(anchor)).toBe(true);
        expect(scrollTo).toHaveBeenCalledWith({ behavior: "auto", top: 256 });
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
        anchor.href = `${window.location.origin}/example#diagrams`;

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
        anchor.href = `${window.location.origin}/example#document-details`;

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
        window.history.replaceState(null, "", "/example#forma-heading-%E4%B8%AD%E6%96%87");
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
        window.history.replaceState(null, "", "/example#forma-heading-title");
        alias.scrollIntoView = vi.fn();
        restoreReaderFragment(reader);
        expect(document.activeElement).toBe(alias);
    });
    it("keeps compact static directory navigation in the same document", () => {
        const target = document.createElement("li");
        target.id = "note";
        document.body.append(target);
        window.history.replaceState(null, "", "/example/");
        const anchor = document.createElement("a");
        anchor.href = "/example#note";
        expect(scrollReaderAnchor(anchor)).toBe(true);
        expect(window.location.pathname).toBe("/example/");
        expect(window.location.hash).toBe("#note");
        expect(document.activeElement).toBe(target);
    });
});
