import Sigma from "sigma";
import { createEdgeArrowProgram, createEdgeDoubleArrowProgram } from "sigma/rendering";

import {
    buildGraphologyGraph,
    GraphLayoutSession,
    graphPositions,
    type GraphologyEdgeAttributes,
    type GraphologyNodeAttributes,
    type GraphologyViewGraph,
} from "./layout.ts";
import { GraphViewModel } from "./model.ts";
import {
    DEFAULT_GRAPH_LAYOUT_OPTIONS,
    DEFAULT_GRAPH_PRESENTATION,
    type GraphDisplayEdgeState,
    type GraphLayoutOptions,
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

export function createGraphRuntime(options: GraphRuntimeOptions): GraphRuntime {
    return new SigmaGraphRuntime(options);
}

class SigmaGraphRuntime implements GraphRuntime {
    readonly #container: HTMLElement;
    readonly #layoutOptions: GraphLayoutOptions;
    readonly #model: GraphViewModel;
    readonly #onOpenNode: ((node: GraphNodeInput) => void) | undefined;
    readonly #onSelectionChange: ((snapshot: GraphViewSnapshot) => void) | undefined;
    #destroyed = false;
    #graph: GraphologyViewGraph;
    #layout: GraphLayoutSession;
    #edgeStates = new Map<string, GraphDisplayEdgeState>();
    #nodeStates = new Map<string, GraphNodeState>();
    readonly #presentation: GraphPresentation;
    #renderer: GraphRenderer;
    #resizeFrame = 0;
    #resizeObserver: ResizeObserver;
    #snapshot: GraphViewSnapshot;
    #theme: GraphTheme;

    constructor(options: GraphRuntimeOptions) {
        this.#container = options.container;
        this.#layoutOptions = { ...DEFAULT_GRAPH_LAYOUT_OPTIONS, ...options.layout };
        this.#presentation = { ...DEFAULT_GRAPH_PRESENTATION, ...options.presentation };
        this.#model = new GraphViewModel(options.projection, this.#presentation);
        this.#onOpenNode = options.onOpenNode;
        this.#onSelectionChange = options.onSelectionChange;
        this.#theme = options.theme;
        this.#snapshot = this.#model.snapshot();
        if (options.activeNodeId !== undefined) this.#snapshot = this.#model.setActiveNode(options.activeNodeId);

        this.#graph = buildGraphologyGraph(this.#snapshot);
        this.#layout = new GraphLayoutSession(this.#graph, this.#layoutOptions);
        this.#renderer = this.#createRenderer(this.#graph);
        this.#container.setAttribute("role", "application");
        this.#container.setAttribute("aria-label", options.ariaLabel ?? "Interactive knowledge graph");
        if (!this.#container.hasAttribute("tabindex")) this.#container.tabIndex = 0;
        this.#container.addEventListener("keydown", this.#handleKeyDown);
        this.#resizeObserver = new ResizeObserver(this.#handleResize);
        this.#resizeObserver.observe(this.#container);
        this.#bindRendererEvents();
        this.#applySnapshot(this.#snapshot);
        if (this.#snapshot.selectedNodeId) this.#centerNode(this.#snapshot.selectedNodeId);
        else this.fit();
    }

    update(update: GraphRuntimeUpdate): void {
        if (this.#destroyed) return;
        if (update.theme) this.#theme = update.theme;
        if (update.projection) {
            const previousPositions = graphPositions(this.#graph);
            this.#snapshot = this.#model.replaceProjection(update.projection);
            this.#replaceGraph(buildGraphologyGraph(this.#snapshot, previousPositions));
        }
        if (update.activeNodeId !== undefined) {
            this.#snapshot = this.#model.setActiveNode(update.activeNodeId);
        }
        this.#applySnapshot(this.#snapshot);
        if (update.theme) {
            this.#renderer.setSettings({
                defaultEdgeColor: this.#theme.edge,
                defaultNodeColor: this.#theme.node,
                labelColor: { color: this.#theme.label },
            });
        }
        if (update.activeNodeId !== undefined) {
            if (this.#snapshot.selectedNodeId) this.#centerNode(this.#snapshot.selectedNodeId);
            else this.fit();
        } else if (update.projection && !this.#snapshot.selectedNodeId) {
            this.fit();
        }
    }

    fit(): void {
        if (this.#destroyed) return;
        const camera = this.#renderer.getCamera();
        if (this.#layoutOptions.reducedMotion) camera.setState({ x: 0.5, y: 0.5, ratio: 1 });
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
        cancelAnimationFrame(this.#resizeFrame);
        this.#container.removeEventListener("keydown", this.#handleKeyDown);
        this.#resizeObserver.disconnect();
        this.#layout.destroy();
        this.#renderer.kill();
    }

    #createRenderer(graph: GraphologyViewGraph): GraphRenderer {
        return new Sigma<GraphologyNodeAttributes, GraphologyEdgeAttributes>(graph, this.#container, {
            allowInvalidContainer: true,
            defaultEdgeColor: this.#theme.edge,
            defaultNodeColor: this.#theme.node,
            edgeProgramClasses: {
                arrow: createEdgeArrowProgram<GraphologyNodeAttributes, GraphologyEdgeAttributes>(),
                doubleArrow: createEdgeDoubleArrowProgram<GraphologyNodeAttributes, GraphologyEdgeAttributes>(),
            },
            edgeReducer: (edge, data) => this.#reduceEdge(edge, data),
            enableEdgeEvents: false,
            labelColor: { color: this.#theme.label },
            labelRenderedSizeThreshold: this.#presentation.labelSizeThreshold,
            labelSize: 12,
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
    }

    #replaceGraph(graph: GraphologyViewGraph): void {
        this.#layout.destroy();
        this.#graph = graph;
        this.#layout = new GraphLayoutSession(graph, this.#layoutOptions);
        this.#renderer.setGraph(graph);
    }

    #applySnapshot(snapshot: GraphViewSnapshot): void {
        this.#snapshot = snapshot;
        this.#nodeStates = new Map(snapshot.nodes.map((node) => [node.id, node]));
        this.#edgeStates = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
        this.#renderer.refresh();
        this.#onSelectionChange?.(snapshot);
    }

    #reduceNode(nodeId: string, data: GraphologyNodeAttributes) {
        const node = this.#nodeStates.get(nodeId);
        if (!node) return { ...data, hidden: true };
        const color =
            node.role === "selected"
                ? this.#theme.nodeSelected
                : node.role === "neighbor"
                  ? this.#theme.nodeNeighbor
                  : node.role === "muted"
                    ? this.#theme.nodeMuted
                    : this.#theme.node;
        return {
            ...data,
            color,
            forceLabel: node.role === "selected" || node.role === "neighbor",
            highlighted: node.role === "selected",
            label: node.labelVisible ? (node.title ?? node.path) : null,
            size: node.size,
            zIndex: node.role === "selected" ? 2 : node.role === "neighbor" ? 1 : 0,
        };
    }

    #reduceEdge(edgeId: string, data: GraphologyEdgeAttributes) {
        const edge = this.#edgeStates.get(edgeId);
        if (!edge) return { ...data, hidden: true };
        return {
            ...data,
            color: edge.emphasized ? this.#theme.edgeSelected : edge.muted ? this.#theme.edgeMuted : this.#theme.edge,
            size: edge.emphasized ? 2 : edge.muted ? 0.65 : 1,
            zIndex: edge.emphasized ? 1 : 0,
        };
    }

    #centerNode(nodeId: string): void {
        const data = this.#renderer.getNodeDisplayData(nodeId);
        if (!data) return;
        const state = { x: data.x, y: data.y, ratio: Math.min(this.#renderer.getCamera().ratio, 0.65) };
        if (this.#layoutOptions.reducedMotion) this.#renderer.getCamera().setState(state);
        else void this.#renderer.getCamera().animate(state, { duration: 250 });
    }

    #handleResize = (): void => {
        cancelAnimationFrame(this.#resizeFrame);
        this.#resizeFrame = requestAnimationFrame(() => {
            if (this.#destroyed || this.#container.offsetWidth <= 0 || this.#container.offsetHeight <= 0) return;
            this.#renderer.resize().scheduleRender();
        });
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
