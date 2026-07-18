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
        readonly setSettings = vi.fn((settings: Record<string, unknown>) => {
            Object.assign(this.settings, settings);
        });
        readonly settings: Record<string, unknown>;
        readonly flowArc = vi.fn();
        readonly flowClearRect = vi.fn();
        readonly flowLineTo = vi.fn();
        readonly flowMoveTo = vi.fn();
        readonly flowStroke = vi.fn();
        readonly flowContext = {
            arc: this.flowArc,
            beginPath: vi.fn(),
            closePath: vi.fn(),
            clearRect: this.flowClearRect,
            fill: vi.fn(),
            lineTo: this.flowLineTo,
            moveTo: this.flowMoveTo,
            setTransform: vi.fn(),
            stroke: this.flowStroke,
        } as unknown as CanvasRenderingContext2D;
        readonly flowCanvas = {
            getContext: vi.fn(() => this.flowContext),
            height: 0,
            style: {},
            width: 0,
        } as unknown as HTMLCanvasElement;
        readonly createCanvas = vi.fn(() => this.flowCanvas);

        constructor(settings: Record<string, unknown> = {}) {
            this.settings = settings;
        }

        emit(event: string, payload: unknown): void {
            this.handlers.get(event)?.(payload as never);
        }

        getCamera() {
            return this.camera;
        }

        framedGraphToViewport(coordinates: { x: number; y: number }) {
            return coordinates;
        }

        getDimensions() {
            return { height: 480, width: 720 };
        }

        getNodeDisplayData(nodeId: string) {
            return nodeId === "a.md" ? { size: 4, x: 0, y: 0 } : { size: 4, x: 100, y: 0 };
        }

        on(event: string, handler: (payload: never) => void): void {
            this.handlers.set(event, handler);
        }

        resize(): this {
            return this;
        }

        scaleSize(size = 1): number {
            return size;
        }
    }

    return {
        FakeSigma,
        arrowProgramOptions: [] as unknown[],
        doubleArrowProgramOptions: [] as unknown[],
        instances: [] as FakeSigma[],
    };
});

vi.mock("sigma", () => ({
    default: class FakeSigmaConstructor extends sigmaMocks.FakeSigma {
        constructor(_graph: unknown, _container: unknown, settings: Record<string, unknown>) {
            super(settings);
            sigmaMocks.instances.push(this);
        }
    },
}));

vi.mock("sigma/rendering", () => ({
    createEdgeArrowProgram: (options: unknown) => {
        sigmaMocks.arrowProgramOptions.push(options);
        return class EdgeArrowProgram {
            readonly type = "arrow";
        };
    },
    createEdgeDoubleArrowProgram: (options: unknown) => {
        sigmaMocks.doubleArrowProgramOptions.push(options);
        return class EdgeDoubleArrowProgram {
            readonly type = "doubleArrow";
        };
    },
}));

import { createGraphRuntime } from "./runtime.ts";
import { mixGraphColors } from "./theme.ts";
import type { GraphProjection, GraphTheme } from "./types.ts";

describe("SigmaGraphRuntime lifecycle", () => {
    const animationFrames: FrameRequestCallback[] = [];
    const resizeObservers: FakeResizeObserver[] = [];

    beforeEach(() => {
        sigmaMocks.arrowProgramOptions.length = 0;
        sigmaMocks.doubleArrowProgramOptions.length = 0;
        sigmaMocks.instances.length = 0;
        animationFrames.length = 0;
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
            vi.fn((callback: FrameRequestCallback) => {
                animationFrames.push(callback);
                return 40 + animationFrames.length;
            }),
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

    it("keeps selection visible and applies theme settings before refreshing reducers", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");
        renderer.emit("clickNode", { node: "a.md" });
        renderer.setSettings.mockClear();
        renderer.refresh.mockClear();
        renderer.setGraph.mockClear();
        renderer.camera.animate.mockClear();
        renderer.camera.animatedReset.mockClear();
        renderer.camera.setState.mockClear();
        const updatedTheme = {
            ...theme(),
            nodeSelected: "#ff00ff",
            nodeNeighbor: "#00aaff",
            nodeMuted: "#333333",
            edgeSelected: "#ff00ff",
        };

        runtime.update({ theme: updatedTheme });

        expect(runtime.snapshot().selectedNodeId).toBe("a.md");
        expect(renderer.setGraph).not.toHaveBeenCalled();
        expect(renderer.camera.animate).not.toHaveBeenCalled();
        expect(renderer.camera.animatedReset).not.toHaveBeenCalled();
        expect(renderer.camera.setState).not.toHaveBeenCalled();
        expect(renderer.setSettings).toHaveBeenCalledOnce();
        expect(renderer.setSettings.mock.invocationCallOrder[0]).toBeLessThan(
            renderer.refresh.mock.invocationCallOrder[0] ?? 0,
        );
        const nodeReducer = renderer.settings.nodeReducer as (
            node: string,
            data: Record<string, unknown>,
        ) => Record<string, unknown>;
        const edgeReducer = renderer.settings.edgeReducer as (
            edge: string,
            data: Record<string, unknown>,
        ) => Record<string, unknown>;
        expect(nodeReducer("a.md", {}).color).toBe("#ff00ff");
        expect(nodeReducer("b.md", {}).color).toBe("#00aaff");
        expect(nodeReducer("c.md", {}).color).toBe("#333333");
        expect(nodeReducer("a.md", {}).zIndex).toBe(10);
        expect(nodeReducer("b.md", {}).zIndex).toBe(5);
        expect(nodeReducer("c.md", {}).zIndex).toBe(0);
        const edge = runtime.snapshot().edges[0];
        if (!edge) throw new Error("Expected display edge.");
        expect(edgeReducer(edge.id, {}).color).toBe("#ff00ff");
        expect(edgeReducer(edge.id, {}).zIndex).toBe(10);
        expect(renderer.flowStroke).toHaveBeenCalled();
        runtime.destroy();
    });

    it("preserves configured classification fill across default, selected, and neighbor states", () => {
        const base = projection();
        const classified = {
            ...base,
            nodes: base.nodes.map((node, index) => ({
                ...node,
                classification: {
                    key: `areas:${String(index)}`,
                    label: `Area ${String(index)}`,
                    color: index === 0 ? "#a855f7" : "#4f7cac",
                },
            })),
        };
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: classified,
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");
        const nodeReducer = renderer.settings.nodeReducer as (
            node: string,
            data: Record<string, unknown>,
        ) => Record<string, unknown>;

        expect(nodeReducer("a.md", {}).color).toBe("#a855f7");
        renderer.emit("clickNode", { node: "a.md" });
        expect(nodeReducer("a.md", {}).color).toBe("#a855f7");
        expect(nodeReducer("b.md", {}).color).toBe("#4f7cac");
        expect(nodeReducer("c.md", {}).color).toBe(mixGraphColors(theme().background, "#4f7cac", 0.22));
        runtime.destroy();
    });

    it("draws highlighted labels with the shared theme instead of a fixed white background", () => {
        const currentTheme = theme();
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: currentTheme,
            layout: { engine: "force", reducedMotion: true },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");
        const fills: string[] = [];
        const strokes: string[] = [];
        const context = fakeCanvasContext(fills, strokes);
        const drawHover = renderer.settings.defaultDrawNodeHover as (
            context: CanvasRenderingContext2D,
            data: { x: number; y: number; size: number; label: string; color: string },
            settings: { labelSize: number; labelFont: string; labelWeight: string },
        ) => void;

        drawHover(
            context,
            { x: 10, y: 10, size: 6, label: "Selected node", color: currentTheme.nodeSelected },
            { labelSize: 11, labelFont: "sans-serif", labelWeight: "normal" },
        );

        expect(fills).toEqual([currentTheme.surface, currentTheme.label]);
        expect(strokes).toEqual([currentTheme.focusRing]);
        runtime.destroy();
    });

    it("uses more legible arrowhead proportions for one-way and reciprocal edges", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });

        expect(sigmaMocks.arrowProgramOptions).toEqual([{ lengthToThicknessRatio: 5, widenessToThicknessRatio: 4 }]);
        expect(sigmaMocks.doubleArrowProgramOptions).toEqual([
            { lengthToThicknessRatio: 5, widenessToThicknessRatio: 4 },
        ]);
        const renderer = sigmaMocks.instances[0];
        expect(renderer?.createCanvas).toHaveBeenCalledWith("forma-edge-flow", {
            afterLayer: "nodes",
            style: { pointerEvents: "none" },
        });
        runtime.destroy();
    });

    it("animates only emphasized edge directions and stops the frame loop when selection clears", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: false },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        expect(requestAnimationFrame).not.toHaveBeenCalled();
        renderer.emit("clickNode", { node: "a.md" });
        expect(requestAnimationFrame).toHaveBeenCalledOnce();
        const firstFrame = animationFrames.shift();
        if (!firstFrame) throw new Error("Expected first edge flow frame.");
        firstFrame(0);

        expect(renderer.flowArc).toHaveBeenCalledTimes(1);
        expect(renderer.flowArc).toHaveBeenNthCalledWith(1, 16.56, 0, 1.8, 0, Math.PI * 2);
        expect(renderer.flowCanvas).toMatchObject({
            height: 480,
            style: { height: "480px", width: "720px" },
            width: 720,
        });
        expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
        const easedFrame = animationFrames.shift();
        if (!easedFrame) throw new Error("Expected eased edge flow frame.");
        easedFrame(900);
        expect(renderer.flowArc).toHaveBeenCalledTimes(4);
        expect(renderer.flowArc.mock.calls[1]?.[0]).toBeCloseTo(69.3325);
        expect(renderer.flowArc.mock.calls[1]?.slice(1)).toEqual([0, 1.8, 0, Math.PI * 2]);
        expect(renderer.flowArc).toHaveBeenNthCalledWith(3, 50, 0, 1.8, 0, Math.PI * 2);
        expect(renderer.flowArc.mock.calls[3]?.[0]).toBeCloseTo(30.6675);
        expect(renderer.flowArc.mock.calls[3]?.slice(1)).toEqual([0, 1.8, 0, Math.PI * 2]);
        expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
        const finalFrame = animationFrames.shift();
        if (!finalFrame) throw new Error("Expected final edge flow frame.");
        finalFrame(1_800);
        expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
        expect(renderer.flowClearRect).toHaveBeenLastCalledWith(0, 0, 720, 480);
        renderer.emit("clickStage", {});
        expect(cancelAnimationFrame).toHaveBeenCalled();
        expect(renderer.flowClearRect).toHaveBeenLastCalledWith(0, 0, 720, 480);
        runtime.destroy();
    });

    it("does not start directional edge animation when reduced motion is enabled", () => {
        const runtime = createGraphRuntime({
            activeNodeId: "a.md",
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });

        expect(requestAnimationFrame).not.toHaveBeenCalled();
        runtime.destroy();
    });

    it("skips directional animation when the selected neighborhood exceeds the edge budget", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: denseProjection(65),
            theme: theme(),
            layout: { engine: "force", reducedMotion: false },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        renderer.emit("clickNode", { node: "a.md" });

        expect(requestAnimationFrame).not.toHaveBeenCalled();
        runtime.destroy();
    });

    it("animates reciprocal edges in both directions", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: reciprocalProjection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: false },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        renderer.emit("clickNode", { node: "a.md" });
        const drawFrame = animationFrames.shift();
        if (!drawFrame) throw new Error("Expected edge flow frame.");
        drawFrame(0);

        expect(renderer.flowArc).toHaveBeenCalledTimes(2);
        expect(renderer.flowArc).toHaveBeenNthCalledWith(1, 16.56, 0, 1.8, 0, Math.PI * 2);
        expect(renderer.flowArc).toHaveBeenNthCalledWith(2, 83.44, 0, 1.8, 0, Math.PI * 2);
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
            { id: "c.md", path: "c.md", title: "C" },
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

function reciprocalProjection(): GraphProjection {
    const base = projection();
    return {
        nodes: base.nodes,
        edges: [
            ...base.edges,
            {
                id: "ba",
                source: "b.md",
                target: "a.md",
                sourcePath: "b.md",
                targetPath: "a.md",
                intent: "link",
                referenceSource: "body",
                label: "links back",
            },
        ],
    };
}

function denseProjection(edgeCount: number): GraphProjection {
    const neighbors = Array.from({ length: edgeCount }, (_, index) => ({
        id: `node-${String(index)}.md`,
        path: `node-${String(index)}.md`,
        title: `Node ${String(index)}`,
    }));
    return {
        nodes: [{ id: "a.md", path: "a.md", title: "A" }, ...neighbors],
        edges: neighbors.map((node, index) => ({
            id: `edge-${String(index)}`,
            source: "a.md",
            target: node.id,
            sourcePath: "a.md",
            targetPath: node.path,
            intent: "link" as const,
            referenceSource: "body" as const,
            label: "links",
        })),
    };
}

function fakeCanvasContext(fills: string[], strokes: string[]): CanvasRenderingContext2D {
    const context = {
        arc: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        lineTo: vi.fn(),
        measureText: vi.fn(() => ({ width: 64 })),
        moveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        restore: vi.fn(),
        save: vi.fn(),
        stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(context, "fillStyle", {
        set(value: string) {
            fills.push(value);
        },
    });
    Object.defineProperty(context, "strokeStyle", {
        set(value: string) {
            strokes.push(value);
        },
    });
    return context;
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
