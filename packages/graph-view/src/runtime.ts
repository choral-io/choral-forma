import Sigma from "sigma";
import { createEdgeArrowProgram, createEdgeDoubleArrowProgram, drawDiscNodeLabel } from "sigma/rendering";
import type { Settings } from "sigma/settings";

import {
    buildGraphologyGraph,
    GraphLayoutSession,
    graphPositions,
    type GraphologyEdgeAttributes,
    type GraphologyNodeAttributes,
    type GraphologyViewGraph,
} from "./layout.ts";
import { GraphViewModel } from "./model.ts";
import { mixGraphColors } from "./theme.ts";
import {
    DEFAULT_GRAPH_LAYOUT_OPTIONS,
    DEFAULT_GRAPH_PRESENTATION,
    type GraphDisplayEdgeState,
    type GraphLayoutOptions,
    type GraphLayoutSettleMode,
    type GraphNodeInput,
    type GraphNodeState,
    type GraphPresentation,
    type GraphRuntime,
    type GraphRuntimeOptions,
    type GraphRuntimeSnapshot,
    type GraphRuntimeUpdate,
    type GraphTheme,
    type GraphViewSnapshot,
} from "./types.ts";

type GraphRenderer = Sigma<GraphologyNodeAttributes, GraphologyEdgeAttributes>;
type GraphWheelZoomModifierState = {
    isMacOS: boolean;
    isPhysicalControlKeyPressed: boolean;
    isPhysicalMetaKeyPressed: boolean;
};

export function createGraphRuntime(options: GraphRuntimeOptions): GraphRuntime {
    return new SigmaGraphRuntime(options);
}

export function shouldAllowGraphWheelZoom(
    event: Pick<WheelEvent, "ctrlKey" | "metaKey">,
    modifierState: GraphWheelZoomModifierState,
): boolean {
    // Chromium uses ctrlKey for trackpad pinch WheelEvents. A physical Control
    // key distinguishes an intentional Ctrl-wheel from that synthetic pinch.
    if (event.ctrlKey && !modifierState.isPhysicalControlKeyPressed) return true;
    if (modifierState.isMacOS) return event.metaKey && modifierState.isPhysicalMetaKeyPressed;
    return event.ctrlKey && modifierState.isPhysicalControlKeyPressed;
}

class SigmaGraphRuntime implements GraphRuntime {
    readonly #container: HTMLElement;
    readonly #layoutOptions: GraphLayoutOptions;
    readonly #model: GraphViewModel;
    readonly #onOpenNode: ((node: GraphNodeInput) => void) | undefined;
    readonly #onFirstRender: (() => void) | undefined;
    readonly #onLayoutSettled: ((mode: GraphLayoutSettleMode) => void) | undefined;
    readonly #onSelectionChange: ((snapshot: GraphViewSnapshot) => void) | undefined;
    #destroyed = false;
    #firstRenderReported = false;
    #initialLayoutReady = false;
    #initialVisibility = "";
    #layoutSettledReported = false;
    #edgeFocusCanvas: HTMLCanvasElement;
    #edgeFocusContext: CanvasRenderingContext2D | null;
    #edgeFocusEdges: readonly GraphDisplayEdgeState[] = [];
    #graph: GraphologyViewGraph;
    #layoutGraph: GraphologyViewGraph | null;
    #layout: GraphLayoutSession;
    #edgeStates = new Map<string, GraphDisplayEdgeState>();
    #nodeStates = new Map<string, GraphNodeState>();
    readonly #presentation: GraphPresentation;
    #renderer: GraphRenderer;
    #resizeFrame = 0;
    #resizeObserver: ResizeObserver;
    #snapshot: GraphViewSnapshot;
    #theme: GraphTheme;
    #isMacOS = isMacOSPlatform();
    #isPhysicalControlKeyPressed = false;
    #isPhysicalMetaKeyPressed = false;
    #windowEventTarget: Window | undefined;

    constructor(options: GraphRuntimeOptions) {
        this.#container = options.container;
        this.#layoutOptions = { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, ...options.layout };
        this.#presentation = { ...DEFAULT_GRAPH_PRESENTATION, ...options.presentation };
        this.#model = new GraphViewModel(options.projection, this.#presentation);
        this.#onOpenNode = options.onOpenNode;
        this.#onFirstRender = options.onFirstRender;
        this.#onLayoutSettled = options.onLayoutSettled;
        this.#onSelectionChange = options.onSelectionChange;
        this.#theme = options.theme;
        this.#snapshot = this.#model.snapshot();
        if (options.activeNodeId !== undefined) this.#snapshot = this.#model.setActiveNode(options.activeNodeId);

        this.#graph = buildGraphologyGraph(this.#snapshot);
        this.#layoutGraph = buildGraphologyGraph(this.#snapshot);
        this.#layout = this.#createLayoutSession(this.#layoutGraph);
        this.#initialLayoutReady = this.#layout.isSettled;
        if (this.#initialLayoutReady) copyGraphPositions(this.#layoutGraph, this.#graph);
        else {
            this.#initialVisibility = this.#container.style.visibility;
            this.#container.style.visibility = "hidden";
            this.#container.setAttribute("aria-busy", "true");
        }
        this.#renderer = this.#createRenderer(this.#graph);
        this.#edgeFocusCanvas = this.#renderer.createCanvas("forma-edge-focus", {
            afterLayer: "nodes",
            style: { pointerEvents: "none" },
        });
        this.#edgeFocusContext = this.#edgeFocusCanvas.getContext("2d");
        this.#container.setAttribute("role", "application");
        this.#container.setAttribute("aria-label", options.ariaLabel ?? "Interactive knowledge graph");
        if (!this.#container.hasAttribute("tabindex")) this.#container.tabIndex = 0;
        this.#container.addEventListener("keydown", this.#handleKeyDown);
        this.#bindWheelZoomModifier();
        this.#resizeObserver = new ResizeObserver(this.#handleResize);
        this.#resizeObserver.observe(this.#container);
        this.#bindRendererEvents();
        this.#applySnapshot(this.#snapshot);
        if (this.#snapshot.selectedNodeId) this.#centerNode(this.#snapshot.selectedNodeId, false);
        else this.#fit(false);
    }

    update(update: GraphRuntimeUpdate): void {
        if (this.#destroyed) return;
        if (update.theme) {
            this.#theme = update.theme;
            this.#renderer.setSettings({
                defaultEdgeColor: this.#theme.edge,
                defaultNodeColor: this.#theme.node,
                labelColor: { color: this.#theme.label },
            });
        }
        if (update.projection) {
            const previousPositions = graphPositions(this.#graph);
            this.#snapshot = this.#model.replaceProjection(update.projection);
            this.#replaceGraph(buildGraphologyGraph(this.#snapshot, previousPositions));
        }
        if (update.activeNodeId !== undefined) {
            this.#snapshot = this.#model.setActiveNode(update.activeNodeId);
        }
        this.#applySnapshot(this.#snapshot);
        if (update.activeNodeId !== undefined) {
            if (this.#snapshot.selectedNodeId) this.#centerNode(this.#snapshot.selectedNodeId);
            else this.fit();
        } else if (update.projection && !this.#snapshot.selectedNodeId) {
            this.fit();
        }
    }

    fit(): void {
        this.#fit(true);
    }

    #fit(animate: boolean): void {
        if (this.#destroyed) return;
        const camera = this.#renderer.getCamera();
        if (this.#layoutOptions.reducedMotion || !animate) camera.setState({ x: 0.5, y: 0.5, ratio: 1 });
        else void camera.animatedReset({ duration: 250 });
    }

    openSelected(): void {
        if (!this.#snapshot.selectedNodeId) return;
        const node = this.#snapshot.nodes.find((candidate) => candidate.id === this.#snapshot.selectedNodeId);
        if (node) this.#onOpenNode?.(node);
    }

    snapshot(): GraphRuntimeSnapshot {
        return { ...this.#snapshot, positions: graphPositions(this.#graph) };
    }

    destroy(): void {
        if (this.#destroyed) return;
        this.#destroyed = true;
        const canvasResources = graphCanvasResources(this.#container);
        cancelAnimationFrame(this.#resizeFrame);
        this.#container.removeEventListener("keydown", this.#handleKeyDown);
        this.#container.removeEventListener("wheel", this.#handleWheelCapture, { capture: true });
        this.#windowEventTarget?.removeEventListener("keydown", this.#handleModifierKeyDown);
        this.#windowEventTarget?.removeEventListener("keyup", this.#handleModifierKeyUp);
        this.#windowEventTarget?.removeEventListener("blur", this.#clearModifierKeys);
        this.#resizeObserver.disconnect();
        this.#layout.destroy();
        this.#layoutGraph = null;
        this.#restoreInitialVisibility();
        this.#renderer.kill();
        for (const context of canvasResources.webGlContexts) context.getExtension("WEBGL_lose_context")?.loseContext();
        for (const canvas of canvasResources.canvases) {
            canvas.width = 0;
            canvas.height = 0;
        }
    }

    #createRenderer(graph: GraphologyViewGraph): GraphRenderer {
        return new Sigma<GraphologyNodeAttributes, GraphologyEdgeAttributes>(graph, this.#container, {
            allowInvalidContainer: true,
            defaultEdgeColor: this.#theme.edge,
            defaultNodeColor: this.#theme.node,
            defaultDrawNodeHover: (context, data, settings) => {
                drawGraphNodeHover(context, data, settings, this.#theme);
            },
            edgeProgramClasses: {
                arrow: createEdgeArrowProgram<GraphologyNodeAttributes, GraphologyEdgeAttributes>(
                    EDGE_ARROW_HEAD_OPTIONS,
                ),
                doubleArrow: createEdgeDoubleArrowProgram<GraphologyNodeAttributes, GraphologyEdgeAttributes>(
                    EDGE_ARROW_HEAD_OPTIONS,
                ),
            },
            edgeReducer: (edge, data) => this.#reduceEdge(edge, data),
            enableEdgeEvents: false,
            labelColor: { color: this.#theme.label },
            labelDensity: this.#presentation.labelDensity,
            labelFont: this.#presentation.labelFont,
            labelGridCellSize: this.#presentation.labelGridCellSize,
            labelRenderedSizeThreshold: this.#presentation.labelSizeThreshold,
            labelSize: this.#presentation.labelSize,
            labelWeight: this.#presentation.labelWeight,
            nodeReducer: (node, data) => this.#reduceNode(node, data),
            renderEdgeLabels: false,
            stagePadding: this.#presentation.stagePadding,
            zIndex: true,
        });
    }

    #bindRendererEvents(): void {
        this.#renderer.on("clickNode", ({ node }) => {
            this.#snapshot = this.#model.selectNode(node);
            this.#applySnapshot(this.#snapshot);
        });
        this.#renderer.on("doubleClickNode", ({ event, node }) => {
            event.preventSigmaDefault();
            const selected = this.#snapshot.nodes.find((candidate) => candidate.id === node);
            if (selected) this.#onOpenNode?.(selected);
        });
        this.#renderer.on("clickStage", () => {
            this.#snapshot = this.#model.clearSelection();
            this.#applySnapshot(this.#snapshot);
        });
        this.#renderer.on("enterNode", () => {
            this.#container.style.cursor = "pointer";
        });
        this.#renderer.on("leaveNode", () => {
            this.#container.style.removeProperty("cursor");
        });
        this.#renderer.on("afterRender", () => {
            this.#drawEdgeFocus();
            if (!this.#initialLayoutReady) return;
            if (!this.#firstRenderReported) {
                this.#firstRenderReported = true;
                this.#onFirstRender?.();
            }
            if (!this.#layoutSettledReported && !this.#layout.usesWorker) {
                this.#layoutSettledReported = true;
                this.#onLayoutSettled?.("synchronous");
            }
        });
    }

    #bindWheelZoomModifier(): void {
        // Sigma consumes wheel events to zoom. Capture non-opted-in events before
        // its bubble listener without cancelling their browser scroll default.
        this.#container.addEventListener("wheel", this.#handleWheelCapture, { capture: true });
        if (typeof window === "undefined") return;
        this.#windowEventTarget = window;
        this.#windowEventTarget.addEventListener("keydown", this.#handleModifierKeyDown);
        this.#windowEventTarget.addEventListener("keyup", this.#handleModifierKeyUp);
        this.#windowEventTarget.addEventListener("blur", this.#clearModifierKeys);
    }

    #replaceGraph(graph: GraphologyViewGraph): void {
        this.#layout.destroy();
        this.#layoutGraph = null;
        this.#initialLayoutReady = true;
        this.#restoreInitialVisibility();
        this.#graph = graph;
        // A projection refresh already carries forward every surviving coordinate,
        // while new nodes are seeded near known neighbors. Running another full
        // settle here would turn a small content edit into a whole-graph jump.
        this.#layout = this.#createLayoutSession(graph, false);
        this.#renderer.setGraph(graph);
    }

    #createLayoutSession(graph: GraphologyViewGraph, runLayout = true): GraphLayoutSession {
        return new GraphLayoutSession(graph, {
            ...this.#layoutOptions,
            runLayout,
            onSettled: (mode) => {
                if (this.#destroyed) return;
                if (this.#layoutGraph) {
                    copyGraphPositions(this.#layoutGraph, this.#graph);
                    this.#layoutGraph = null;
                }
                this.#initialLayoutReady = true;
                this.#restoreInitialVisibility();
                this.#renderer.refresh();
                if (this.#snapshot.selectedNodeId) this.#centerNode(this.#snapshot.selectedNodeId, false);
                else this.#fit(false);
                if (!this.#layoutSettledReported) {
                    this.#layoutSettledReported = true;
                    this.#onLayoutSettled?.(mode);
                }
            },
        });
    }

    #applySnapshot(snapshot: GraphViewSnapshot): void {
        this.#snapshot = snapshot;
        this.#nodeStates = new Map(snapshot.nodes.map((node) => [node.id, node]));
        this.#edgeStates = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
        this.#edgeFocusEdges = snapshot.edges.filter((edge) => edge.emphasized);
        this.#renderer.refresh();
        this.#drawEdgeFocus();
        this.#onSelectionChange?.(snapshot);
    }

    #drawEdgeFocus(): void {
        if (!this.#edgeFocusContext) return;
        drawGraphEdgeFocus(
            this.#edgeFocusCanvas,
            this.#edgeFocusContext,
            this.#renderer,
            this.#edgeFocusEdges,
            this.#theme,
        );
    }

    #reduceNode(nodeId: string, data: GraphologyNodeAttributes) {
        const node = this.#nodeStates.get(nodeId);
        if (!node) return { ...data, hidden: true };
        const classificationColor = node.classification?.color;
        const color =
            node.role === "selected"
                ? (classificationColor ?? this.#theme.nodeSelected)
                : node.role === "neighbor"
                  ? (classificationColor ?? this.#theme.nodeNeighbor)
                  : node.role === "muted"
                    ? classificationColor
                        ? mixGraphColors(this.#theme.background, classificationColor, node.opacity)
                        : this.#theme.nodeMuted
                    : (classificationColor ?? this.#theme.node);
        return {
            ...data,
            color,
            forceLabel: node.role === "selected" || node.role === "neighbor",
            highlighted: node.role === "selected",
            label: node.labelVisible ? node.displayLabel : null,
            size: node.size,
            zIndex: node.role === "selected" ? 10 : node.role === "neighbor" ? 5 : 0,
        };
    }

    #reduceEdge(edgeId: string, data: GraphologyEdgeAttributes) {
        const edge = this.#edgeStates.get(edgeId);
        if (!edge) return { ...data, hidden: true };
        return {
            ...data,
            color: edge.emphasized ? this.#theme.edgeSelected : edge.muted ? this.#theme.edgeMuted : this.#theme.edge,
            size: edge.emphasized ? 2 : edge.muted ? 0.65 : 1,
            zIndex: edge.emphasized ? 10 : 0,
        };
    }

    #centerNode(nodeId: string, animate = true): void {
        const data = this.#renderer.getNodeDisplayData(nodeId);
        if (!data) return;
        const state = { x: data.x, y: data.y, ratio: Math.min(this.#renderer.getCamera().ratio, 0.65) };
        if (this.#layoutOptions.reducedMotion || !animate) this.#renderer.getCamera().setState(state);
        else void this.#renderer.getCamera().animate(state, { duration: 250 });
    }

    #restoreInitialVisibility(): void {
        if (!this.#container.hasAttribute("aria-busy")) return;
        this.#container.style.visibility = this.#initialVisibility;
        this.#container.removeAttribute("aria-busy");
    }

    #handleResize = (): void => {
        cancelAnimationFrame(this.#resizeFrame);
        this.#resizeFrame = requestAnimationFrame(() => {
            if (this.#destroyed || this.#container.offsetWidth <= 0 || this.#container.offsetHeight <= 0) return;
            this.#renderer.resize().scheduleRender();
        });
    };

    #handleWheelCapture = (event: WheelEvent): void => {
        if (
            shouldAllowGraphWheelZoom(event, {
                isMacOS: this.#isMacOS,
                isPhysicalControlKeyPressed: this.#isPhysicalControlKeyPressed,
                isPhysicalMetaKeyPressed: this.#isPhysicalMetaKeyPressed,
            })
        ) {
            return;
        }
        event.stopImmediatePropagation();
    };

    #handleModifierKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Control") this.#isPhysicalControlKeyPressed = true;
        if (event.key === "Meta") this.#isPhysicalMetaKeyPressed = true;
    };

    #handleModifierKeyUp = (event: KeyboardEvent): void => {
        if (event.key === "Control") this.#isPhysicalControlKeyPressed = false;
        if (event.key === "Meta") this.#isPhysicalMetaKeyPressed = false;
    };

    #clearModifierKeys = (): void => {
        this.#isPhysicalControlKeyPressed = false;
        this.#isPhysicalMetaKeyPressed = false;
    };

    #handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Enter") {
            event.preventDefault();
            this.openSelected();
        } else if (event.key === "Escape") {
            this.#snapshot = this.#model.clearSelection();
            this.#applySnapshot(this.#snapshot);
        } else if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            this.fit();
        }
    };
}

function copyGraphPositions(source: GraphologyViewGraph, target: GraphologyViewGraph): void {
    target.updateEachNodeAttributes((node, attributes) => {
        const position = source.getNodeAttributes(node);
        return { ...attributes, x: position.x, y: position.y };
    });
}

function graphCanvasResources(container: HTMLElement): {
    canvases: readonly HTMLCanvasElement[];
    webGlContexts: readonly (WebGLRenderingContext | WebGL2RenderingContext)[];
} {
    const canvases = Array.from(container.children).filter(
        (element): element is HTMLCanvasElement => element.tagName === "CANVAS",
    );
    const contexts: (WebGLRenderingContext | WebGL2RenderingContext)[] = [];
    for (const canvas of canvases) {
        const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        if (context) contexts.push(context);
    }
    return { canvases, webGlContexts: contexts };
}

function isMacOSPlatform(): boolean {
    return typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
}

type EdgeFocusRenderer = Pick<
    GraphRenderer,
    "framedGraphToViewport" | "getDimensions" | "getNodeDisplayData" | "scaleSize"
>;

function drawGraphEdgeFocus(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    renderer: EdgeFocusRenderer,
    edges: readonly GraphDisplayEdgeState[],
    theme: GraphTheme,
): void {
    const dimensions = renderer.getDimensions();
    const pixelRatio = Math.max(1, globalThis.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(dimensions.width * pixelRatio));
    const height = Math.max(1, Math.round(dimensions.height * pixelRatio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    canvas.style.width = `${String(dimensions.width)}px`;
    canvas.style.height = `${String(dimensions.height)}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, dimensions.width, dimensions.height);
    context.strokeStyle = theme.edgeSelected;
    context.fillStyle = theme.edgeSelected;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.globalAlpha = 0.92;
    for (const edge of edges) {
        const sourceData = renderer.getNodeDisplayData(edge.source);
        const targetData = renderer.getNodeDisplayData(edge.target);
        if (!sourceData || !targetData) continue;
        const source = renderer.framedGraphToViewport(sourceData);
        const target = renderer.framedGraphToViewport(targetData);
        const segment = trimEdgeSegment(
            source,
            target,
            renderer.scaleSize(sourceData.size) + EDGE_FOCUS_NODE_GAP,
            renderer.scaleSize(targetData.size) + EDGE_FOCUS_NODE_GAP,
        );
        if (!segment) continue;
        context.beginPath();
        context.moveTo(segment.source.x, segment.source.y);
        context.lineTo(segment.target.x, segment.target.y);
        context.stroke();
        drawEdgeFocusArrow(context, segment.source, segment.target);
        if (edge.direction === "reciprocal") drawEdgeFocusArrow(context, segment.target, segment.source);
    }
    context.globalAlpha = 1;
}

function trimEdgeSegment(
    source: { x: number; y: number },
    target: { x: number; y: number },
    sourceOffset: number,
    targetOffset: number,
): { source: { x: number; y: number }; target: { x: number; y: number } } | undefined {
    const deltaX = target.x - source.x;
    const deltaY = target.y - source.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= sourceOffset + targetOffset || distance === 0) return;
    const unitX = deltaX / distance;
    const unitY = deltaY / distance;
    return {
        source: { x: source.x + unitX * sourceOffset, y: source.y + unitY * sourceOffset },
        target: { x: target.x - unitX * targetOffset, y: target.y - unitY * targetOffset },
    };
}

function drawEdgeFocusArrow(
    context: CanvasRenderingContext2D,
    source: { x: number; y: number },
    target: { x: number; y: number },
): void {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    context.beginPath();
    context.moveTo(target.x, target.y);
    context.lineTo(
        target.x - Math.cos(angle - EDGE_FOCUS_ARROW_ANGLE) * EDGE_FOCUS_ARROW_LENGTH,
        target.y - Math.sin(angle - EDGE_FOCUS_ARROW_ANGLE) * EDGE_FOCUS_ARROW_LENGTH,
    );
    context.lineTo(
        target.x - Math.cos(angle + EDGE_FOCUS_ARROW_ANGLE) * EDGE_FOCUS_ARROW_LENGTH,
        target.y - Math.sin(angle + EDGE_FOCUS_ARROW_ANGLE) * EDGE_FOCUS_ARROW_LENGTH,
    );
    context.closePath();
    context.fill();
}

const EDGE_ARROW_HEAD_OPTIONS = {
    lengthToThicknessRatio: 5,
    widenessToThicknessRatio: 4,
} as const;
const EDGE_FOCUS_ARROW_ANGLE = Math.PI / 6;
const EDGE_FOCUS_ARROW_LENGTH = 7;
const EDGE_FOCUS_NODE_GAP = 2;

function drawGraphNodeHover(
    context: CanvasRenderingContext2D,
    data: { x: number; y: number; size: number; label: string | null; color: string },
    settings: Settings<GraphologyNodeAttributes, GraphologyEdgeAttributes>,
    theme: GraphTheme,
): void {
    const label = typeof data.label === "string" ? data.label : undefined;
    const labelSize = settings.labelSize;
    const labelGap = 3;
    const paddingX = 6;
    const paddingY = 3;
    context.save();
    context.font = `${settings.labelWeight} ${String(labelSize)}px ${settings.labelFont}`;
    context.fillStyle = theme.surface;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    context.shadowBlur = 8;
    context.shadowColor = theme.border;
    context.beginPath();
    context.arc(data.x, data.y, data.size + 2, 0, Math.PI * 2);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    if (label) {
        const textWidth = context.measureText(label).width;
        const labelX = data.x + data.size + labelGap;
        const left = labelX - paddingX;
        const top = data.y - labelSize / 2 - paddingY;
        const width = textWidth + paddingX * 2;
        const height = labelSize + paddingY * 2;
        context.fillStyle = theme.surface;
        context.shadowOffsetY = 1;
        context.shadowBlur = 8;
        context.beginPath();
        roundedRectangle(context, left, top, width, height, Math.min(4, height / 2));
        context.closePath();
        context.fill();
        context.shadowBlur = 0;
    }
    drawDiscNodeLabel<GraphologyNodeAttributes, GraphologyEdgeAttributes>(context, data, settings);
    context.restore();
}

function roundedRectangle(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
): void {
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
}
