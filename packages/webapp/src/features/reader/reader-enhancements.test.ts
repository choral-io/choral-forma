// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enhanceReader } from "./reader-enhancements";

const source = [
    '<h2><span id="setup" data-forma-heading-anchor="" tabindex="-1"></span>Setup</h2>',
    "<h3>No anchor</h3>",
    "<pre><code>plain\ncode</code></pre>",
    '<pre><code class="language-mermaid">flowchart TD</code></pre>',
    '<div class="relative my-5"><pre class="shiki"><code><span class="line">let a = 1;</span></code></pre><span>ts</span></div>',
].join("");

describe("enhanceReader", () => {
    let reader: HTMLElement;
    let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

    beforeEach(() => {
        vi.useFakeTimers();
        reader = document.createElement("div");
        reader.innerHTML = source;
        document.body.append(reader);
        writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    it("adds a copy control to code samples, reuses a highlighted block's wrapper, and leaves diagram source alone", () => {
        enhanceReader(reader);

        const buttons = reader.querySelectorAll("[data-reader-copy-code]");
        expect(buttons).toHaveLength(2);
        expect(reader.querySelectorAll("div.relative")).toHaveLength(2);
        expect(reader.querySelector("pre.shiki")?.parentElement?.querySelectorAll("button")).toHaveLength(1);
        for (const button of buttons) expect(button.getAttribute("aria-label")).toBe("Copy code");
        expect(reader.querySelector(":scope > pre code.language-mermaid")).not.toBeNull();
    });

    it("copies a block's text and confirms it until the label resets", async () => {
        enhanceReader(reader);
        const button = reader.querySelector<HTMLButtonElement>("[data-reader-copy-code]");

        button?.click();
        await vi.waitFor(() => {
            expect(button?.getAttribute("aria-label")).toBe("Code copied");
        });
        expect(writeText).toHaveBeenCalledExactlyOnceWith("plain\ncode");

        vi.advanceTimersByTime(1800);
        expect(button?.getAttribute("aria-label")).toBe("Copy code");
    });

    it("reports a refused copy for a moment, then offers the control again", async () => {
        writeText.mockRejectedValue(new Error("denied"));
        enhanceReader(reader);
        const button = reader.querySelector<HTMLButtonElement>("[data-reader-copy-code]");
        const link = reader.querySelector<HTMLButtonElement>("[data-reader-heading-link]");

        button?.click();
        link?.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(button?.getAttribute("aria-label")).toBe("Could not copy code");
        expect(button?.dataset.copyFailed).toBe("");
        expect(link?.getAttribute("aria-label")).toBe("Could not copy section link");
        expect(link?.textContent).toBe("✕");

        await vi.advanceTimersByTimeAsync(2000);
        expect(button?.getAttribute("aria-label")).toBe("Copy code");
        expect(button?.dataset.copyFailed).toBeUndefined();
        expect(link?.textContent).toBe("#");
    });

    it("links only headings that have an anchor and copies the section address", async () => {
        enhanceReader(reader);

        const links = reader.querySelectorAll<HTMLButtonElement>("[data-reader-heading-link]");
        expect(links).toHaveLength(1);
        const [link] = links;
        expect(link?.tagName).toBe("BUTTON");
        expect(reader.querySelectorAll("a")).toHaveLength(0);
        const heading = reader.querySelector("h2");
        const labelId = heading?.getAttribute("aria-labelledby") ?? "";
        expect(document.getElementById(labelId)?.textContent).toBe("Setup");
        expect(document.getElementById("setup")?.parentElement).toBe(heading);

        link?.click();
        await vi.waitFor(() => {
            expect(link?.getAttribute("aria-label")).toBe("Section link copied");
        });
        expect(writeText).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}${window.location.pathname}#setup`);
    });

    it("restores the original markup on cleanup", () => {
        const cleanup = enhanceReader(reader);
        cleanup();

        expect(reader.innerHTML).toBe(source);
    });
});
