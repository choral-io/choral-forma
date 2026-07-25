// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const zoomMocks = vi.hoisted(() => {
    const controllers: {
        destroy: ReturnType<typeof vi.fn>;
        getState: ReturnType<typeof vi.fn>;
        panBy: ReturnType<typeof vi.fn>;
        reset: ReturnType<typeof vi.fn>;
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

    it("adds a compact, accessible contextual control surface without changing the source disclosure", () => {
        const root = fixture();
        const cleanup = enhanceMermaidDiagrams(root);

        const controls = root.querySelector<HTMLDetailsElement>(".mermaid-diagram-tools");
        expect(controls?.querySelector("summary")?.getAttribute("aria-label")).toBe(
            "Diagram controls for Flowchart diagram",
        );
        expect(root.querySelector('[aria-label="Zoom in Flowchart diagram"]')?.getAttribute("aria-controls")).toBe(
            "diagram-viewport",
        );
        expect(
            root.querySelector<HTMLButtonElement>('[aria-label="Reset Flowchart diagram zoom to 100%"]')?.disabled,
        ).toBe(true);
        expect(root.querySelector(".mermaid-diagram-source summary")?.textContent).toBe("View Mermaid source");
        expect(root.querySelector(".mermaid-diagram-viewport")?.getAttribute("aria-keyshortcuts")).toBe(
            "ArrowUp ArrowDown ArrowLeft ArrowRight + - 0",
        );

        root.querySelector<HTMLButtonElement>('[aria-label="Zoom in Flowchart diagram"]')?.click();
        expect(zoomMocks.controllers[0]?.zoomIn).toHaveBeenCalledOnce();
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
        expect(dialog?.querySelector("code")?.textContent).toContain("A --> B");
        expect(dialog?.querySelector("pre")?.getAttribute("aria-label")).toBe("Mermaid source for Flowchart diagram");
        expect(dialog?.querySelector("pre")?.getAttribute("role")).toBe("region");
        expect(dialog?.querySelector("pre")?.tabIndex).toBe(0);
        expect(zoomMocks.controllers[0]?.destroy).toHaveBeenCalledOnce();

        dialog?.close();
        expect(root.querySelector(".mermaid-diagram-viewport svg")).not.toBeNull();
        expect(document.activeElement).toBe(expand);
        expect(zoomMocks.controllers).toHaveLength(3);
        cleanup();
        expect(zoomMocks.controllers[2]?.destroy).toHaveBeenCalledOnce();
        expect(root.querySelector(".mermaid-diagram-tools")).toBeNull();
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
