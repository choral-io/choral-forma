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
        expect(slider?.getAttribute("aria-controls")).toBe("diagram-viewport");
        expect(slider?.min).toBe("100");
        expect(slider?.max).toBe("300");
        expect(slider?.step).toBe("5");
        expect(slider?.parentElement?.classList.contains("mermaid-diagram-slider-lane")).toBe(true);
        expect(
            root.querySelector<HTMLButtonElement>('[aria-label="Reset Flowchart diagram zoom to 100%"]')?.disabled,
        ).toBe(true);
        expect(
            root
                .querySelector<HTMLButtonElement>('[aria-label="Reset Flowchart diagram zoom to 100%"]')
                ?.querySelector('svg[aria-hidden="true"]'),
        ).not.toBeNull();
        expect(root.querySelector(".mermaid-diagram-source summary")?.textContent).toBe("View Mermaid source");
        const expand = root.querySelector<HTMLButtonElement>('[aria-label="Expand Flowchart diagram"]');
        expect(expand?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(expand?.getAttribute("title")).toBe("Expand diagram");
        expect(expand?.classList.contains("join-item")).toBe(true);
        expect(expand?.parentElement?.classList.contains("mermaid-diagram-control-actions")).toBe(true);
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

        const dialog = document.querySelector<HTMLDialogElement>(".mermaid-diagram-dialog");
        expect(dialog?.open).toBe(true);
        expect(dialog?.getAttribute("aria-labelledby")).toContain("dialog-title");
        expect(dialog?.querySelector("h2")?.textContent).toBe("Flowchart diagram");
        expect(dialog?.querySelector("svg")).not.toBeNull();
        expect(dialog?.querySelector(".mermaid-diagram-dialog-source")).toBeNull();
        expect(dialog?.querySelector(".mermaid-diagram-dialog-status")?.textContent).toBe("Zoom 100%");
        const close = dialog?.querySelector<HTMLButtonElement>('[aria-label="Close diagram"]');
        expect(close?.getAttribute("title")).toBe("Close diagram");
        expect(close?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(dialog?.querySelector("form.modal-backdrop")).not.toBeNull();
        expect(zoomMocks.controllers[0]?.destroy).toHaveBeenCalledOnce();

        dialog?.close();
        expect(root.querySelector(".mermaid-diagram-viewport svg")).not.toBeNull();
        expect(document.activeElement).toBe(expand);
        expect(zoomMocks.controllers).toHaveLength(3);
        cleanup();
        expect(zoomMocks.controllers[2]?.destroy).toHaveBeenCalledOnce();
        expect(root.querySelector(".mermaid-diagram-control-rail")).toBeNull();
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
