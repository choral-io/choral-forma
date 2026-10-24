import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sigmaMocks = vi.hoisted(() => {
    class FakeSigma {
        readonly camera = {
            ratio: 1,
            cancelAnimation: vi.fn(),
            getBoundedRatio: vi.fn((ratio: number) => ratio),
            animate: vi.fn(() => Promise.resolve()),
            reset: vi.fn(() => Promise.resolve()),
            setState: vi.fn(),
        };
        readonly handlers = new Map<string, (payload: never) => void>();
        readonly kill = vi.fn();
        readonly refresh = vi.fn();
        readonly scheduleRender = vi.fn(() => this);
        readonly setGraph = vi.fn();
        readonly settings: Record<string, unknown>;
        readonly focusClearRect = vi.fn();
        readonly focusFill = vi.fn();
        readonly focusLineTo = vi.fn();
        readonly focusMoveTo = vi.fn();
        readonly focusStroke = vi.fn();
        readonly focusContext = {
            beginPath: vi.fn(),
            closePath: vi.fn(),
            clearRect: this.focusClearRect,
            fill: this.focusFill,
            lineTo: this.focusLineTo,
            moveTo: this.focusMoveTo,
            setTransform: vi.fn(),
            stroke: this.focusStroke,
        } as unknown as CanvasRenderingContext2D;
        readonly focusCanvas = {
            getContext: vi.fn(() => this.focusContext),
            height: 0,
            style: {},
            width: 0,
        } as unknown as HTMLCanvasElement;
        readonly createCanvas = vi.fn(() => this.focusCanvas);

        constructor(settings: Record<string, unknown> = {}) {
            const reduce = settings.nodeReducer as (...args: unknown[]) => unknown;
            this.settings = {
                ...settings,
                nodeReducer: (node: string, data: unknown, attrs = {}, state = { isHovered: false }) =>
                    reduce(node, data, attrs, state),
            };
        }

        emit(event: string, payload: unknown): void {
            this.handlers.get(event)?.(payload as never);
        }

        getViewportZoomedState = vi.fn((target: { x: number; y: number }, ratio: number) => ({ ...target, ratio }));

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
    extremityArrow: (options: unknown) => {
        sigmaMocks.arrowProgramOptions.push(options);
        return { name: "arrow" };
    },
}));

import { createGraphRuntime, shouldAllowGraphWheelZoom } from "./runtime.ts";
import { mixGraphColors } from "./theme.ts";
import type { GraphProjection, GraphTheme } from "./types.ts";

describe("SigmaGraphRuntime lifecycle", () => {
    const animationFrames: FrameRequestCallback[] = [];
    const resizeObservers: FakeResizeObserver[] = [];

    beforeEach(() => {
        sigmaMocks.arrowProgramOptions.length = 0;
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

    afterEach(() => {
        vi.unstubAllGlobals();
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
        expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
        expect(removeEventListener).toHaveBeenCalledWith("wheel", expect.any(Function), { capture: true });
        expect(cancelAnimationFrame).toHaveBeenCalledWith(41);
    });

    it("reports the first renderer frame and synchronous layout completion once", () => {
        const onFirstRender = vi.fn();
        const onLayoutSettled = vi.fn();
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
            onFirstRender,
            onLayoutSettled,
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        renderer.emit("afterRender", undefined);
        renderer.emit("afterRender", undefined);

        expect(onFirstRender).toHaveBeenCalledOnce();
        expect(onLayoutSettled).toHaveBeenCalledOnce();
        expect(onLayoutSettled).toHaveBeenCalledWith("synchronous");
        runtime.destroy();
    });

    it("applies the opt-in media gesture around its pointer without changing graph selection", () => {
        const container = fakeContainer();
        const wheelZoomFactor = (event: WheelEvent) =>
            event.ctrlKey || event.metaKey ? Math.exp(-event.deltaY * 0.02) : undefined;
        const runtime = createGraphRuntime({
            container,
            projection: projection(),
            theme: theme(),
            wheelZoomFactor,
            layout: { useWorker: false },
        });
        const renderer = sigmaMocks.instances[0];
        const capture = container.eventListeners.get("wheel");
        if (!renderer || !capture) throw new Error("Missing renderer or wheel capture");
        renderer.emit("clickNode", { node: "a.md" });
        const selected = runtime.snapshot().selectedNodeId;
        renderer.camera.setState.mockClear();
        const preventDefault = vi.fn();
        const stopImmediatePropagation = vi.fn();
        capture({
            metaKey: true,
            deltaY: -10,
            clientX: 40,
            clientY: 60,
            preventDefault,
            stopImmediatePropagation,
        } as unknown as Event);
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(renderer.camera.cancelAnimation).toHaveBeenCalledOnce();
        expect(renderer.getViewportZoomedState).toHaveBeenCalledWith({ x: 40, y: 60 }, Math.exp(-0.2));
        expect(runtime.snapshot().selectedNodeId).toBe(selected);
        preventDefault.mockClear();
        capture({ ctrlKey: false, metaKey: false, preventDefault, stopImmediatePropagation } as unknown as Event);
        expect(preventDefault).not.toHaveBeenCalled();
        runtime.destroy();
    });

    it("publishes the initial synchronous layout without an animated camera reset", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: false, useWorker: false },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        expect(renderer.camera.reset).not.toHaveBeenCalled();
        expect(renderer.camera.setState).toHaveBeenCalledWith({ x: 0.5, y: 0.5, ratio: 1 });
        runtime.destroy();
    });

    it("explicitly releases retained WebGL contexts after renderer disposal", () => {
        const loseContext = vi.fn();
        const getExtension = vi.fn((name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null));
        const webGlContext = {
            getExtension,
        } as unknown as WebGL2RenderingContext;
        const canvas = {
            getContext: vi.fn((name: string) => (name === "webgl2" ? webGlContext : null)),
            height: 480,
            tagName: "CANVAS",
            width: 720,
        } as unknown as HTMLCanvasElement;
        const container = fakeContainer();
        Object.defineProperty(container, "children", { value: [canvas] });
        const runtime = createGraphRuntime({
            container,
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });

        runtime.destroy();

        expect(sigmaMocks.instances[0]?.kill).toHaveBeenCalledOnce();
        expect(getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
        expect(loseContext).toHaveBeenCalledOnce();
        expect(canvas.width).toBe(0);
        expect(canvas.height).toBe(0);
    });

    it("supports shared Enter, Escape, and fit keyboard actions", () => {
        const container = fakeContainer();
        const onOpenNode = vi.fn();
        const runtime = createGraphRuntime({
            container,
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
            onOpenNode,
        });
        const renderer = sigmaMocks.instances[0];
        const keyDown = container.eventListeners.get("keydown");
        if (!renderer || typeof keyDown !== "function") throw new Error("Expected Graph keyboard listener.");
        renderer.emit("clickNode", { node: "a.md" });
        const preventEnter = vi.fn();

        keyDown({ key: "Enter", preventDefault: preventEnter } as unknown as Event);
        expect(preventEnter).toHaveBeenCalledOnce();
        expect(onOpenNode).toHaveBeenCalledWith(expect.objectContaining({ id: "a.md" }));

        keyDown({ key: "Escape", preventDefault: vi.fn() } as unknown as Event);
        expect(runtime.snapshot().selectedNodeId).toBeNull();

        renderer.camera.setState.mockClear();
        const preventFit = vi.fn();
        keyDown({ key: "F", preventDefault: preventFit } as unknown as Event);
        expect(preventFit).toHaveBeenCalledOnce();
        expect(renderer.camera.setState).toHaveBeenCalledWith({ x: 0.5, y: 0.5, ratio: 1 });
        runtime.destroy();
    });

    it("passes platform-approved wheel zoom and trackpad pinch events through to Sigma", () => {
        const browserWindow = fakeWindowEventTarget();
        vi.stubGlobal("window", browserWindow);
        vi.stubGlobal("navigator", { platform: "Win32" });
        const container = fakeContainer();
        const runtime = createGraphRuntime({
            container,
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const wheelCapture = container.eventListeners.get("wheel");
        if (typeof wheelCapture !== "function") throw new Error("Expected Graph wheel capture listener.");
        const stopPlainWheel = vi.fn();
        const preventPlainWheel = vi.fn();

        wheelCapture({
            ctrlKey: false,
            preventDefault: preventPlainWheel,
            stopImmediatePropagation: stopPlainWheel,
        } as unknown as Event);
        expect(stopPlainWheel).toHaveBeenCalledOnce();
        expect(preventPlainWheel).not.toHaveBeenCalled();

        browserWindow.emit("keydown", { key: "Control" } as KeyboardEvent);
        const stopControlWheel = vi.fn();
        wheelCapture({ ctrlKey: true, stopImmediatePropagation: stopControlWheel } as unknown as Event);
        expect(stopControlWheel).not.toHaveBeenCalled();

        browserWindow.emit("keyup", { key: "Control" } as KeyboardEvent);
        const stopPinchLikeWheel = vi.fn();
        wheelCapture({ ctrlKey: true, stopImmediatePropagation: stopPinchLikeWheel } as unknown as Event);
        expect(stopPinchLikeWheel).not.toHaveBeenCalled();

        runtime.destroy();
        expect(browserWindow.removedEventTypes).toEqual(expect.arrayContaining(["keydown", "keyup", "blur"]));
    });

    it("uses Command-wheel on macOS, Control-wheel elsewhere, and preserves trackpad pinch", () => {
        const macOS = {
            isMacOS: true,
            isPhysicalControlKeyPressed: false,
            isPhysicalMetaKeyPressed: false,
        };
        const windows = { ...macOS, isMacOS: false };

        expect(shouldAllowGraphWheelZoom({ ctrlKey: false, metaKey: false }, macOS)).toBe(false);
        expect(
            shouldAllowGraphWheelZoom(
                { ctrlKey: true, metaKey: false },
                { ...macOS, isPhysicalControlKeyPressed: true },
            ),
        ).toBe(false);
        expect(
            shouldAllowGraphWheelZoom({ ctrlKey: false, metaKey: true }, { ...macOS, isPhysicalMetaKeyPressed: true }),
        ).toBe(true);
        expect(shouldAllowGraphWheelZoom({ ctrlKey: true, metaKey: false }, macOS)).toBe(true);
        expect(
            shouldAllowGraphWheelZoom(
                { ctrlKey: true, metaKey: false },
                { ...windows, isPhysicalControlKeyPressed: true },
            ),
        ).toBe(true);
        expect(shouldAllowGraphWheelZoom({ ctrlKey: true, metaKey: false }, windows)).toBe(true);
    });

    it("uses v4 native labels and backdrops for hover and selection", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");
        const reduce = renderer.settings.nodeReducer as (...args: unknown[]) => Record<string, unknown>;
        expect(reduce("a.md", {}, {}, { isHovered: true })).toMatchObject({
            labelVisibility: "visible",
            backdropVisibility: "visible",
            depth: "topNodes",
        });
        expect(reduce("a.md", {}, {}, { isHovered: false })).toMatchObject({ backdropVisibility: "hidden" });
        renderer.emit("clickNode", { node: "a.md" });
        expect(reduce("a.md", {}, {}, { isHovered: false })).toMatchObject({
            labelVisibility: "visible",
            backdropVisibility: "visible",
            depth: "topNodes",
        });
        expect((renderer.settings.settings as Record<string, unknown>).itemSizesReference).toBe("screen");
        runtime.destroy();
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

    it("preserves surviving coordinates when a projection refresh adds a neighboring node", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const before = runtime.snapshot().positions;
        const base = projection();

        runtime.update({
            projection: {
                nodes: [...base.nodes, { id: "new.md", path: "new.md", title: "New" }],
                edges: [
                    ...base.edges,
                    {
                        id: "a-new",
                        source: "a.md",
                        target: "new.md",
                        sourcePath: "a.md",
                        targetPath: "new.md",
                        intent: "link",
                        referenceSource: "body",
                        label: "links to",
                    },
                ],
            },
        });

        const after = runtime.snapshot().positions;
        for (const nodeId of ["a.md", "b.md", "c.md"]) {
            expect(after.get(nodeId)).toEqual(before.get(nodeId));
        }
        expect(positionDistance(after.get("a.md"), after.get("new.md"))).toBeLessThan(0.12);
        runtime.destroy();
    });

    it("keeps selection visible while refreshing v4 theme styles", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");
        renderer.emit("clickNode", { node: "a.md" });
        renderer.refresh.mockClear();
        renderer.setGraph.mockClear();
        renderer.camera.animate.mockClear();
        renderer.camera.reset.mockClear();
        renderer.camera.setState.mockClear();
        const updatedTheme = {
            ...theme(),
            nodeSelected: "#ff00ff",
            nodeNeighbor: "#00aaff",
            nodeMuted: "#333333",
            edgeSelected: "#ff00ff",
            label: "#ffeeaa",
            surface: "#101010",
        };

        runtime.update({ theme: updatedTheme });

        expect(runtime.snapshot().selectedNodeId).toBe("a.md");
        expect(renderer.setGraph).not.toHaveBeenCalled();
        expect(renderer.camera.animate).not.toHaveBeenCalled();
        expect(renderer.camera.reset).not.toHaveBeenCalled();
        expect(renderer.camera.setState).not.toHaveBeenCalled();

        const nodeReducer = renderer.settings.nodeReducer as (
            node: string,
            data: Record<string, unknown>,
        ) => Record<string, unknown>;
        const edgeReducer = renderer.settings.edgeReducer as (
            edge: string,
            data: Record<string, unknown>,
        ) => Record<string, unknown>;
        const styles = renderer.settings.styles as { nodes: { labelColor: () => string; backdropColor: () => string } };
        expect(styles.nodes.labelColor()).toBe(updatedTheme.label);
        expect(styles.nodes.backdropColor()).toBe(updatedTheme.surface);
        expect(nodeReducer("a.md", {}).labelColor).toBe(updatedTheme.label);
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
        expect(renderer.focusStroke).toHaveBeenCalled();
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

    it("uses more legible arrowhead proportions for one-way and reciprocal edges", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: projection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: true },
        });

        expect(sigmaMocks.arrowProgramOptions).toEqual([{ lengthRatio: 5, widthRatio: 4 }]);
        const renderer = sigmaMocks.instances[0];
        expect(renderer?.createCanvas).toHaveBeenCalledWith("forma-edge-focus", {
            afterLayer: "stage",
            style: { pointerEvents: "none" },
        });
        if (!renderer) throw new Error("Expected Sigma renderer.");
        const styles = renderer.settings.styles as {
            edges: { head: string; tail: (attributes: { type: string }) => string };
        };
        expect(styles.edges.head).toBe("arrow");
        expect(styles.edges.tail({ type: "arrow" })).toBe("none");
        expect(styles.edges.tail({ type: "doubleArrow" })).toBe("arrow");
        runtime.destroy();
    });

    it("draws static emphasized edge directions without starting an animation loop", () => {
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
        expect(requestAnimationFrame).not.toHaveBeenCalled();
        expect(renderer.focusStroke).toHaveBeenCalled();
        expect(renderer.focusFill).toHaveBeenCalledOnce();
        expect(renderer.focusCanvas).toMatchObject({
            height: 480,
            style: { height: "480px", width: "720px" },
            width: 720,
        });
        renderer.emit("clickStage", {});
        expect(requestAnimationFrame).not.toHaveBeenCalled();
        expect(renderer.focusClearRect).toHaveBeenLastCalledWith(0, 0, 720, 480);
        runtime.destroy();
    });

    it("draws both static arrowheads for a reciprocal focused edge", () => {
        const runtime = createGraphRuntime({
            container: fakeContainer(),
            projection: reciprocalProjection(),
            theme: theme(),
            layout: { engine: "force", reducedMotion: false },
        });
        const renderer = sigmaMocks.instances[0];
        if (!renderer) throw new Error("Expected Sigma renderer.");

        renderer.emit("clickNode", { node: "a.md" });

        expect(requestAnimationFrame).not.toHaveBeenCalled();
        expect(renderer.focusStroke).toHaveBeenCalledOnce();
        expect(renderer.focusFill).toHaveBeenCalledTimes(2);
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

function fakeContainer(removeEventListener = vi.fn()): HTMLElement & { eventListeners: Map<string, EventListener> } {
    const attributes = new Map<string, string>();
    const eventListeners = new Map<string, EventListener>();
    return {
        eventListeners,
        children: [],
        clientHeight: 480,
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        offsetHeight: 480,
        offsetWidth: 720,
        style: { removeProperty: vi.fn() },
        tabIndex: -1,
        addEventListener: vi.fn((type: string, listener: EventListener) => {
            eventListeners.set(type, listener);
        }),
        hasAttribute: vi.fn((name: string) => attributes.has(name)),
        removeEventListener,
        setAttribute: vi.fn((name: string, value: string) => attributes.set(name, value)),
    } as unknown as HTMLElement & { eventListeners: Map<string, EventListener> };
}

function fakeWindowEventTarget(): Window & {
    emit(type: string, event: Event): void;
    removedEventTypes: string[];
} {
    const listeners = new Map<string, EventListener>();
    const removedEventTypes: string[] = [];
    const removeEventListener = (type: string, listener: EventListener) => {
        removedEventTypes.push(type);
        if (listeners.get(type) === listener) listeners.delete(type);
    };
    return {
        addEventListener: vi.fn((type: string, listener: EventListener) => {
            listeners.set(type, listener);
        }),
        emit(type: string, event: Event) {
            listeners.get(type)?.(event);
        },
        removeEventListener,
        removedEventTypes,
    } as unknown as Window & { emit(type: string, event: Event): void; removedEventTypes: string[] };
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

function positionDistance(
    left: Readonly<{ x: number; y: number }> | undefined,
    right: Readonly<{ x: number; y: number }> | undefined,
): number {
    if (!left || !right) return Number.POSITIVE_INFINITY;
    return Math.hypot(left.x - right.x, left.y - right.y);
}
