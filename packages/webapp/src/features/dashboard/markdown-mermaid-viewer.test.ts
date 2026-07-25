// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const zoomMocks = vi.hoisted(() => {
    const controllers: {
        destroy: ReturnType<typeof vi.fn>;
        getState: ReturnType<typeof vi.fn>;
        panBy: ReturnType<typeof vi.fn>;
        reset: ReturnType<typeof vi.fn>;
        zoomTo: ReturnType<typeof vi.fn>;
        zoomIn: ReturnType<typeof vi.fn>;
        zoomOut: ReturnType<typeof vi.fn>;
    }[] = [];
    return {
        controllers,
        createSvgDiagramZoomController: vi.fn(() => {
            const controller = {
                destroy: vi.fn(),
                getState: vi.fn(() => ({
                    canReset: false,
                    canZoomIn: true,
                    canZoomOut: false,
                    scale: 1,
                    x: 0,
                    y: 0,
                })),
                panBy: vi.fn(),
                reset: vi.fn(),
                zoomTo: vi.fn(),
                zoomIn: vi.fn(),
                zoomOut: vi.fn(),
            };
            controllers.push(controller);
            return controller;
        }),
    };
});

vi.mock("@/lib/mermaid", () => ({
    createSvgDiagramZoomController: zoomMocks.createSvgDiagramZoomController,
    mermaidDiagramZoom: { maxScale: 3, minScale: 1 },
}));

import { enhanceMermaidDiagrams } from "./markdown-mermaid-viewer";

describe("enhanceMermaidDiagrams", () => {
    beforeEach(() => {
        zoomMocks.controllers.splice(0);
        zoomMocks.createSvgDiagramZoomController.mockClear();
        Object.defineProperties(HTMLDialogElement.prototype, {
            close: {
                configurable: true,
                value(this: HTMLDialogElement) {
                    this.open = false;
                    this.dispatchEvent(new Event("close"));
                },
            },
            showModal: {
                configurable: true,
                value(this: HTMLDialogElement) {
                    this.open = true;
                },
            },
        });
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    it("adds an always-available, accessible zoom rail without changing the source disclosure", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);

        const controls = root.querySelector<HTMLDivElement>(".mermaid-diagram-control-rail");
        expect(controls?.getAttribute("aria-label")).toBe("Controls for Flowchart diagram");
        expect(root.querySelector("details.mermaid-diagram-tools")).toBeNull();
        const slider = root.querySelector<HTMLInputElement>('[aria-label="Zoom Flowchart diagram"]');
        expect(slider?.classList.contains("range-vertical")).toBe(true);
        expect(slider?.classList.contains("mermaid-diagram-no-fill-range")).toBe(true);
        expect(slider?.getAttribute("aria-controls")).toBe("diagram-viewport");
        expect(slider?.min).toBe("100");
        expect(slider?.max).toBe("300");
        expect(slider?.step).toBe("5");
        expect(slider?.parentElement?.classList.contains("mermaid-diagram-slider-lane")).toBe(true);
        expect(controls?.children).toHaveLength(2);
        expect(controls?.parentElement?.classList.contains("mermaid-diagram-viewport")).toBe(true);
        const reset = root.querySelector<HTMLButtonElement>('[aria-label="Reset Flowchart diagram zoom to 100%"]');
        expect(reset?.disabled).toBe(true);
        expect(reset?.classList.contains("btn-circle")).toBe(true);
        expect(reset?.classList.contains("join-item")).toBe(false);
        expect(reset?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(root.querySelector(".mermaid-diagram-source summary")?.textContent).toBe("View Mermaid source");
        const expand = root.querySelector<HTMLButtonElement>('[aria-label="Expand Flowchart diagram"]');
        expect(expand?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(expand?.getAttribute("title")).toBe("Expand diagram");
        expect(expand?.classList.contains("btn-circle")).toBe(true);
        expect(expand?.classList.contains("join-item")).toBe(false);
        expect(expand?.parentElement?.classList.contains("mermaid-diagram-control-actions")).toBe(true);
        expect(expand?.parentElement?.classList.contains("join")).toBe(false);
        expect(expand?.parentElement?.parentElement).toBe(controls);
        expect(root.querySelector(".mermaid-diagram-viewport")?.getAttribute("aria-keyshortcuts")).toBe(
            "ArrowUp ArrowDown ArrowLeft ArrowRight + - 0",
        );
        if (slider) {
            slider.value = "150";
            slider.dispatchEvent(new Event("input", { bubbles: true }));
        }
        expect(zoomMocks.controllers[0]?.zoomTo).toHaveBeenCalledWith(1.5);
        cleanup();
    });

    it("moves the sanitized SVG into a local pseudo-fullscreen dialog, restores it, and cleans up controllers", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);
        const expand = root.querySelector<HTMLButtonElement>('[aria-label="Expand Flowchart diagram"]');
        expand?.click();

        const dialog = document.querySelector<HTMLDialogElement>(".mermaid-diagram-expanded-viewer");
        expect(dialog?.open).toBe(true);
        expect(dialog?.getAttribute("aria-labelledby")).toContain("dialog-title");
        expect(dialog?.querySelector("h2")?.textContent).toBe("Flowchart diagram");
        expect(dialog?.querySelector("h2")?.classList.contains("sr-only")).toBe(true);
        expect(dialog?.querySelector("svg")).not.toBeNull();
        expect(dialog?.querySelector(".mermaid-diagram-dialog-source")).toBeNull();
        expect(dialog?.querySelector('[role="status"]')?.textContent).toBe("Zoom 100%");
        const dialogSlider = dialog?.querySelector<HTMLInputElement>('[aria-label="Zoom Flowchart diagram"]');
        expect(dialogSlider?.classList.contains("range-vertical")).toBe(true);
        expect(dialogSlider?.parentElement?.classList.contains("mermaid-diagram-slider-lane")).toBe(true);
        expect(
            dialogSlider
                ?.closest(".mermaid-diagram-control-rail")
                ?.parentElement?.classList.contains("mermaid-diagram-dialog-canvas"),
        ).toBe(true);
        expect(dialog?.querySelector('[aria-label="Expand Flowchart diagram"]')).toBeNull();
        const collapse = dialog?.querySelector<HTMLButtonElement>(
            '[aria-label="Return Flowchart diagram to embedded view"]',
        );
        expect(collapse?.getAttribute("title")).toBe("Return to embedded view");
        expect(collapse?.classList.contains("btn-circle")).toBe(true);
        expect(collapse?.classList.contains("join-item")).toBe(false);
        expect(collapse?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(Array.from(collapse?.querySelectorAll("path") ?? []).map((path) => path.getAttribute("d"))).toEqual([
            "m14 10 7-7",
            "M20 10h-6V4",
            "m3 21 7-7",
            "M4 14h6v6",
        ]);
        expect(dialog?.querySelector('[aria-label="Close expanded diagram"]')).toBeNull();
        expect(dialog?.querySelector("form.modal-backdrop")).toBeNull();
        expect(dialog?.classList.contains("modal")).toBe(false);
        expect(zoomMocks.controllers[0]?.destroy).toHaveBeenCalledOnce();

        collapse?.click();
        expect(root.querySelector(".mermaid-diagram-viewport svg")).not.toBeNull();
        expect(document.activeElement).toBe(expand);
        expect(zoomMocks.controllers).toHaveLength(3);
        cleanup();
        expect(zoomMocks.controllers[2]?.destroy).toHaveBeenCalledOnce();
        expect(root.querySelector(".mermaid-diagram-control-rail")).toBeNull();
    });

    it("returns to the embedded viewer on Escape without leaving a modal shell behind", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);
        const expand = root.querySelector<HTMLButtonElement>('[aria-label="Expand Flowchart diagram"]');
        expand?.click();

        const dialog = document.querySelector<HTMLDialogElement>(".mermaid-diagram-expanded-viewer");
        const cancel = new Event("cancel", { cancelable: true });
        dialog?.dispatchEvent(cancel);

        expect(cancel.defaultPrevented).toBe(true);
        expect(document.querySelector(".mermaid-diagram-expanded-viewer")).toBeNull();
        expect(root.querySelector(".mermaid-diagram-viewport svg")).not.toBeNull();
        expect(document.activeElement).toBe(expand);
        cleanup();
    });
});

function fixture() {
    const root = document.createElement("div");
    root.innerHTML = [
        '<figure class="mermaid-diagram">',
        '<figcaption class="mermaid-diagram-caption" id="diagram-caption"><span class="mermaid-diagram-caption-label">Flowchart diagram</span></figcaption>',
        '<p class="sr-only" id="diagram-description">Flowchart with two items.</p>',
        '<div aria-describedby="diagram-description" class="mermaid-diagram-viewport" id="diagram-viewport" role="region" tabindex="0"><svg xmlns="http://www.w3.org/2000/svg"><defs><marker id="safe"/></defs><path marker-end="url(#safe)"/></svg></div>',
        '<details class="mermaid-diagram-source"><summary>View Mermaid source</summary><pre><code class="language-mermaid">flowchart LR\nA --&gt; B</code></pre></details>',
        "</figure>",
    ].join("");
    document.body.append(root);
    return root;
}
