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
        createSvgDiagramZoomController: vi.fn((_options: unknown) => {
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

import { subscribeWorkspaceInteractionLayer } from "@/lib/workspace-interaction-layer";
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

    it("shares compact controls and contains the overview outside the right rail", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);
        const rail = root.querySelector(".diagram-viewer-control-rail");
        expect(rail?.getAttribute("aria-label")).toBe("Controls for Flowchart diagram");
        expect(root.querySelector("input[type=range]")).toBeNull();
        expect(root.querySelector('[aria-label="Zoom in"]')).toBeNull();
        root.querySelector<HTMLButtonElement>('[aria-label="Fit Flowchart diagram"]')?.click();
        expect(zoomMocks.controllers[0]?.reset).toHaveBeenCalledOnce();
        expect(zoomMocks.createSvgDiagramZoomController.mock.calls[0]?.[0]).toMatchObject({ fitMode: "contain" });
        expect(root.querySelector(".mermaid-diagram-source summary")?.textContent).toBe("View Mermaid source");
        cleanup();
    });

    it("moves the sanitized SVG into the shared native dialog and restores focus and occupancy", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);
        const occupancy: boolean[] = [];
        const unsubscribe = subscribeWorkspaceInteractionLayer((occupied) => {
            occupancy.push(occupied);
        });
        const expand = root.querySelector<HTMLButtonElement>('[aria-label="Expand Flowchart diagram"]');
        expand?.click();
        const dialog = document.querySelector<HTMLDialogElement>(".media-viewer-dialog");
        expect(dialog?.open).toBe(true);
        expect(dialog?.ariaLabel).toBe("Flowchart diagram");
        expect(dialog?.querySelector('[id$="dialog-help"]')?.textContent).toContain("Flowchart with two items.");
        expect(dialog?.querySelector(".media-viewer-dialog-box svg")).not.toBeNull();
        expect(dialog?.querySelector("[role=status]")?.textContent).toBe("100% of fit");
        expect(zoomMocks.controllers[0]?.destroy).toHaveBeenCalledOnce();
        expect(dialog?.querySelector('[aria-label="Zoom in"]')).toBeNull();
        dialog?.querySelector<HTMLButtonElement>('[aria-label="Close Flowchart diagram viewer"]')?.click();
        expect(document.querySelector(".media-viewer-dialog")).toBeNull();
        expect(root.querySelector(".mermaid-diagram-viewport svg")).not.toBeNull();
        expect(document.activeElement).toBe(expand);
        expect(occupancy).toEqual([false, true, false]);
        cleanup();
        unsubscribe();
        expect(zoomMocks.controllers[2]?.destroy).toHaveBeenCalledOnce();
    });

    it("releases a deferred native close event on reader teardown without rebuilding its controller", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);
        root.querySelector<HTMLButtonElement>('[aria-label="Expand Flowchart diagram"]')?.click();
        const dialog = document.querySelector<HTMLDialogElement>(".media-viewer-dialog");
        if (!dialog) throw new Error("Missing viewer");
        Object.defineProperty(dialog, "close", {
            value: () => {
                dialog.open = false;
            },
        });
        cleanup();
        expect(document.querySelector(".media-viewer-dialog")).toBeNull();
        expect(zoomMocks.controllers).toHaveLength(2);
        dialog.dispatchEvent(new Event("close"));
        expect(zoomMocks.controllers).toHaveLength(2);
        expect(zoomMocks.controllers[1]?.destroy).toHaveBeenCalledOnce();
    });

    it("returns to the embedded viewer on Escape", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);
        const expand = root.querySelector<HTMLButtonElement>('[aria-label="Expand Flowchart diagram"]');
        expand?.click();
        const cancel = new Event("cancel", { cancelable: true });
        document.querySelector("dialog")?.dispatchEvent(cancel);
        expect(cancel.defaultPrevented).toBe(true);
        expect(document.querySelector("dialog")).toBeNull();
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
