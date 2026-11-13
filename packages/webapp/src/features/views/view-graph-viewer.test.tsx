// @vitest-environment jsdom
import { createMediaViewerControls } from "@/lib/media-viewer-controls";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ViewGraphProjection } from "./ViewGraphProjection";

const runtime = vi.hoisted(() => ({
    fit: vi.fn(),
    destroy: vi.fn(),
    update: vi.fn(),
}));
const createRuntime = vi.hoisted(() => vi.fn(() => runtime));
vi.mock("@choral-forma/graph-view", () => ({
    createGraphRuntime: createRuntime,
    createGraphThemeFromTokens: () => ({}),
    graphExpandPresentation: (expanded: boolean) => ({ ariaLabel: expanded ? "Exit expanded graph" : "Expand graph" }),
    graphSummaryPresentation: () => undefined,
}));
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    Object.defineProperties(HTMLDialogElement.prototype, {
        showModal: {
            configurable: true,
            value(this: HTMLDialogElement) {
                this.open = true;
            },
        },
        close: {
            configurable: true,
            value(this: HTMLDialogElement) {
                this.open = false;
            },
        },
    });
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
});

it("keeps the live Graph runtime across native expansion, fit and Escape", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
        root.render(
            <MemoryRouter>
                <ViewGraphProjection projection={{ kind: "graph", nodes: [], edges: [], legend: [] }} />
            </MemoryRouter>,
        );
    });
    const controls = container.querySelector('[aria-label="Graph controls"]');
    const mediaControls = createMediaViewerControls("image", false);
    expect(controls?.className).toBe(mediaControls.element.className);
    const graphButtons = Array.from(controls?.querySelectorAll("button") ?? []);
    expect(graphButtons.map((button) => button.ariaLabel)).toEqual(["Reset graph view", "Expand graph"]);
    expect(graphButtons.every((button) => button.className === mediaControls.reset.className)).toBe(true);
    const opener = container.querySelector<HTMLButtonElement>('[aria-label="Expand graph"]');
    act(() => {
        opener?.click();
    });
    const dialog = document.querySelector("dialog");
    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector('[aria-label="Graph controls"]')).not.toBeNull();
    expect(createRuntime).toHaveBeenCalledOnce();
    act(() => {
        dialog?.querySelector<HTMLButtonElement>('[aria-label="Reset graph view"]')?.click();
    });
    expect(runtime.fit).toHaveBeenCalledOnce();
    const canvas = dialog?.querySelector<HTMLElement>("[id]");
    const engineEscape = vi.fn();
    canvas?.addEventListener("keydown", engineEscape);
    act(() => {
        canvas?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(engineEscape).not.toHaveBeenCalled();
    expect(document.querySelector("dialog")).toBeNull();
    expect(container.contains(opener)).toBe(true);
    expect(document.activeElement).toBe(opener);
    expect(createRuntime).toHaveBeenCalledOnce();
    act(() => {
        opener?.click();
    });
    expect(document.querySelector("dialog")?.open).toBe(true);
    act(() => {
        root.unmount();
    });
    expect(document.querySelector("dialog")).toBeNull();
    expect(runtime.destroy).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("");
});

it("restores the expanded graph when a live projection removes its legend sibling", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = (legend: { key: string; label: string; field: string }[]) => {
        act(() => {
            root.render(
                <MemoryRouter>
                    <ViewGraphProjection projection={{ kind: "graph", nodes: [], edges: [], legend }} />
                </MemoryRouter>,
            );
        });
    };
    render([{ key: "configured", label: "Configured", field: "fields.status" }]);
    act(() => {
        container.querySelector<HTMLButtonElement>('[aria-label="Expand graph"]')?.click();
    });
    render([]);
    expect(container.querySelector('[aria-label="Graph node colors"]')).toBeNull();
    act(() => {
        document.querySelector<HTMLButtonElement>('[aria-label="Exit expanded graph"]')?.click();
    });
    expect(document.querySelector("dialog")).toBeNull();
    expect(container.querySelector('[aria-label="Expand graph"]')).not.toBeNull();
    const restored = container.querySelector('[aria-label="Expand graph"]');
    expect(document.activeElement).toBe(restored);
    const emptyMessage = Array.from(container.querySelectorAll("p")).find((p) =>
        p.textContent.includes("No nodes match"),
    );
    if (!restored || !emptyMessage) throw new Error("Missing restored graph or empty-state message");
    expect(restored.compareDocumentPosition(emptyMessage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.body.style.overflow).toBe("");
    act(() => {
        root.unmount();
    });
});

it("retains the inline graph when native modal dialogs are unavailable", () => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: undefined });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
        root.render(
            <MemoryRouter>
                <ViewGraphProjection projection={{ kind: "graph", nodes: [], edges: [], legend: [] }} />
            </MemoryRouter>,
        );
    });
    act(() => {
        container.querySelector<HTMLButtonElement>('[aria-label="Expand graph"]')?.click();
    });
    expect(document.querySelector("dialog")).toBeNull();
    expect(container.querySelector('[aria-label="Expand graph"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe("");
    act(() => {
        root.unmount();
    });
});
