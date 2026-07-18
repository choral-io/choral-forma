import { beforeEach, describe, expect, it, vi } from "vitest";

const sigmaMocks = vi.hoisted(() => {
    class FakeSigma {
        readonly camera = {
            ratio: 1,
            animate: vi.fn(() => Promise.resolve()),
            animatedReset: vi.fn(() => Promise.resolve()),
            setState: vi.fn(),
        };
        readonly handlers = new Map<string, (payload: never) => void>();
        readonly kill = vi.fn();
        readonly refresh = vi.fn();
        readonly scheduleRender = vi.fn(() => this);
        readonly setGraph = vi.fn();
        readonly setSettings = vi.fn();

        emit(event: string, payload: unknown): void {
            this.handlers.get(event)?.(payload as never);
        }

        getCamera() {
            return this.camera;
        }

        getNodeDisplayData() {
            return { x: 0.4, y: 0.6 };
        }

        on(event: string, handler: (payload: never) => void): void {
            this.handlers.set(event, handler);
        }

        resize(): this {
            return this;
        }
    }

    return { FakeSigma, instances: [] as FakeSigma[] };
});

vi.mock("sigma", () => ({
    default: class FakeSigmaConstructor extends sigmaMocks.FakeSigma {
        constructor() {
            super();
            sigmaMocks.instances.push(this);
        }
    },
}));

vi.mock("sigma/rendering", () => ({
    createEdgeArrowProgram: () =>
        class EdgeArrowProgram {
            readonly type = "arrow";
        },
    createEdgeDoubleArrowProgram: () =>
        class EdgeDoubleArrowProgram {
            readonly type = "doubleArrow";
        },
}));

import { createGraphRuntime } from "./runtime.ts";
import type { GraphProjection, GraphTheme } from "./types.ts";

describe("SigmaGraphRuntime lifecycle", () => {
    const resizeObservers: FakeResizeObserver[] = [];

    beforeEach(() => {
        sigmaMocks.instances.length = 0;
        resizeObservers.length = 0;
        vi.stubGlobal(
            "ResizeObserver",
            class FakeResizeObserverConstructor extends FakeResizeObserver {
                constructor(callback: ResizeObserverCallback) {
                    super(callback);
                    resizeObservers.push(this);
                }
            },
        );
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn(() => 41),
        );
        vi.stubGlobal("cancelAnimationFrame", vi.fn());
    });

    it("keeps selection separate from activation and releases all host resources", () => {
        const removeEventListener = vi.fn();
        const container = fakeContainer(removeEventListener);
        const onOpenNode = vi.fn();
        const runtime = createGraphRuntime({
            container,
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
            onOpenNode,
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        renderer.emit("clickNode", { node: "a.md" });
        expect(runtime.snapshot().selectedNodeId).toBe("a.md");
        expect(onOpenNode).not.toHaveBeenCalled();

        renderer.emit("doubleClickNode", { node: "a.md", event: { preventSigmaDefault: vi.fn() } });
        expect(onOpenNode).toHaveBeenCalledWith(expect.objectContaining({ id: "a.md" }));

        resizeObservers[0]?.trigger();
        runtime.destroy();
        runtime.destroy();

        expect(renderer.kill).toHaveBeenCalledOnce();
        expect(resizeObservers[0]?.disconnect).toHaveBeenCalledOnce();
        expect(removeEventListener).toHaveBeenCalledOnce();
        expect(cancelAnimationFrame).toHaveBeenCalledWith(41);
    });

    it("updates theme and projection without exposing the renderer", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        runtime.update({
            activeNodeId: "b.md",
            projection: {
                nodes: projection().nodes.filter((node) => node.id === "b.md"),
                edges: [],
            },
            theme: { ...theme(), nodeSelected: "#ff00ff" },
        });

        expect(runtime.snapshot().selectedNodeId).toBe("b.md");
        expect(renderer.setGraph).toHaveBeenCalledOnce();
        expect(renderer.refresh).toHaveBeenCalled();
        runtime.destroy();
    });

    it("fits a refreshed projection when no selected node remains", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");
        renderer.emit("clickNode", { node: "a.md" });
        renderer.camera.setState.mockClear();

        runtime.update({ projection: { nodes: [], edges: [] } });

        expect(runtime.snapshot().selectedNodeId).toBeNull();
        expect(renderer.camera.setState).toHaveBeenCalledWith({ x: 0.5, y: 0.5, ratio: 1 });
        runtime.destroy();
    });
});

class FakeResizeObserver {
    readonly disconnect = vi.fn();
    readonly observe = vi.fn();
    readonly #callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
        this.#callback = callback;
    }

    trigger(): void {
        this.#callback([], this as unknown as ResizeObserver);
    }
}

function fakeContainer(removeEventListener = vi.fn()): HTMLElement {
    const attributes = new Map<string, string>();
    return {
        offsetHeight: 480,
        offsetWidth: 720,
        style: { removeProperty: vi.fn() },
        tabIndex: -1,
        addEventListener: vi.fn(),
        hasAttribute: vi.fn((name: string) => attributes.has(name)),
        removeEventListener,
        setAttribute: vi.fn((name: string, value: string) => attributes.set(name, value)),
    } as unknown as HTMLElement;
}

function projection(): GraphProjection {
    return {
        nodes: [
            { id: "a.md", path: "a.md", title: "A" },
            { id: "b.md", path: "b.md", title: "B" },
        ],
        edges: [
            {
                id: "ab",
                source: "a.md",
                target: "b.md",
                sourcePath: "a.md",
                targetPath: "b.md",
                intent: "link",
                referenceSource: "body",
                label: "links to",
            },
        ],
    };
}

function theme(): GraphTheme {
    return {
        background: "#ffffff",
        surface: "#ffffff",
        border: "#cccccc",
        node: "#777777",
        nodeSelected: "#0066ff",
        nodeNeighbor: "#3399ff",
        nodeMuted: "#dddddd",
        edge: "#999999",
        edgeSelected: "#0066ff",
        edgeMuted: "#eeeeee",
        label: "#111111",
        labelMuted: "#777777",
        focusRing: "#0066ff",
    };
}
