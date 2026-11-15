// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copySourcePath } from "./copy-source-path";

function sourcePathButton() {
    const button = document.createElement("button");
    button.setAttribute("aria-label", "Copy source path notes/a.md");
    button.innerHTML = [
        '<svg data-copy-icon=""></svg>',
        '<svg class="hidden" data-copied-icon=""></svg>',
        '<svg class="hidden" data-copy-failed-icon=""></svg>',
    ].join("");
    document.body.append(button);
    return button;
}

const shown = (button: HTMLButtonElement) =>
    ["data-copy-icon", "data-copied-icon", "data-copy-failed-icon"].filter(
        (name) => !button.querySelector(`[${name}]`)?.classList.contains("hidden"),
    );

describe("copySourcePath", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        document.body.replaceChildren();
    });

    it("copies the path, confirms it, and then resets", async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { clipboard: { writeText } });
        const button = sourcePathButton();

        await copySourcePath(button, "notes/a.md");

        expect(writeText).toHaveBeenCalledWith("notes/a.md");
        expect(button.getAttribute("aria-label")).toBe("Copied source path notes/a.md");
        expect(button.hasAttribute("data-copy-failed")).toBe(false);
        expect(shown(button)).toEqual(["data-copied-icon"]);

        vi.runAllTimers();
        expect(button.getAttribute("aria-label")).toBe("Copy source path notes/a.md");
        expect(shown(button)).toEqual(["data-copy-icon"]);
    });

    it("shows a visible failure when the clipboard refuses, and then resets", async () => {
        vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
        const button = sourcePathButton();

        await copySourcePath(button, "notes/a.md");

        expect(button.getAttribute("aria-label")).toBe("Could not copy source path notes/a.md");
        expect(button.hasAttribute("data-copy-failed")).toBe(true);
        expect(shown(button)).toEqual(["data-copy-failed-icon"]);

        vi.runAllTimers();
        expect(button.hasAttribute("data-copy-failed")).toBe(false);
        expect(shown(button)).toEqual(["data-copy-icon"]);
    });
});
