import {
    DEFAULT_GRAPH_PRESENTATION,
    type GraphDisplayEdge,
    type GraphDisplayEdgeState,
    type GraphEdgeInput,
    type GraphNodeInput,
    type GraphNodeState,
    type GraphPresentation,
    type GraphProjection,
    type GraphSelectionSource,
    type GraphViewSnapshot,
} from "./types.ts";

export class GraphViewModel {
    readonly #presentation: GraphPresentation;
    #activeInputId: string | null = null;
    #activeNodeId: string | null = null;
    #adjacency = new Map<string, Set<string>>();
    #displayEdges: GraphDisplayEdge[] = [];
    #nodes = new Map<string, GraphNodeInput>();
    #selectedNodeId: string | null = null;
    #selectionSource: GraphSelectionSource | null = null;

    constructor(projection: GraphProjection, presentation: Partial<GraphPresentation> = {}) {
        this.#presentation = { ...DEFAULT_GRAPH_PRESENTATION, ...presentation };
        this.replaceProjection(projection);
    }

    replaceProjection(projection: GraphProjection): GraphViewSnapshot {
        const previousSelection = this.#selectedNodeId;
        this.#nodes = uniqueNodes(projection.nodes);
        const semanticEdges = projection.edges.filter(
            (edge) => this.#nodes.has(edge.source) && this.#nodes.has(edge.target),
        );
        this.#adjacency = buildAdjacency(this.#nodes.keys(), semanticEdges);
        this.#displayEdges = aggregateDisplayEdges(semanticEdges);

        if (previousSelection && this.#nodes.has(previousSelection)) {
            this.#selectedNodeId = previousSelection;
        } else if (this.#activeNodeId && this.#nodes.has(this.#activeNodeId)) {
            this.#selectedNodeId = this.#activeNodeId;
            this.#selectionSource = "active";
        } else {
            this.#selectedNodeId = null;
            this.#selectionSource = null;
        }
        return this.snapshot();
    }

    setActiveNode(nodeId: string | null | undefined): GraphViewSnapshot {
        const activeInputId = nodeId ?? null;
        if (activeInputId === this.#activeInputId) return this.snapshot();
        this.#activeInputId = activeInputId;
        const applicableNodeId = activeInputId && this.#nodes.has(activeInputId) ? activeInputId : null;
        this.#activeNodeId = applicableNodeId;
        this.#selectedNodeId = applicableNodeId;
        this.#selectionSource = applicableNodeId ? "active" : null;
        return this.snapshot();
    }

    selectNode(nodeId: string): GraphViewSnapshot {
        if (!this.#nodes.has(nodeId)) return this.snapshot();
        this.#selectedNodeId = nodeId;
        this.#selectionSource = "user";
        return this.snapshot();
    }

    clearSelection(): GraphViewSnapshot {
        this.#selectedNodeId = null;
        this.#selectionSource = "user";
        return this.snapshot();
    }

    snapshot(): GraphViewSnapshot {
        const selectedNodeId = this.#selectedNodeId;
        const adjacentNodeIds = selectedNodeId ? new Set(this.#adjacency.get(selectedNodeId) ?? []) : new Set<string>();
        const nodes = [...this.#nodes.values()].map((node) =>
            nodeState(
                node,
                this.#adjacency.get(node.id)?.size ?? 0,
                selectedNodeId,
                adjacentNodeIds,
                this.#presentation,
            ),
        );
        const edges = this.#displayEdges.map((edge) => edgeState(edge, selectedNodeId));
        return {
            nodes,
            edges,
            selectedNodeId,
            selectionSource: this.#selectionSource,
            adjacentNodeIds,
        };
    }
}

export function aggregateDisplayEdges(edges: readonly GraphEdgeInput[]): GraphDisplayEdge[] {
    const pairs = new Map<string, GraphEdgeInput[]>();
    for (const edge of edges) {
        const key = edge.source <= edge.target ? `${edge.source}\0${edge.target}` : `${edge.target}\0${edge.source}`;
        const pair = pairs.get(key);
        if (pair) pair.push(edge);
        else pairs.set(key, [edge]);
    }

    return [...pairs.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, semanticEdges]) => {
            const [first, second] = key.split("\0") as [string, string];
            const reciprocal =
                first !== second &&
                semanticEdges.some((edge) => edge.source === first && edge.target === second) &&
                semanticEdges.some((edge) => edge.source === second && edge.target === first);
            const firstEdge = semanticEdges[0];
            if (!firstEdge) throw new Error("Graph display edge group cannot be empty.");
            return {
                id: reciprocal ? `${first}\u2194${second}` : `${firstEdge.source}\u2192${firstEdge.target}`,
                source: reciprocal ? first : firstEdge.source,
                target: reciprocal ? second : firstEdge.target,
                direction: reciprocal ? "reciprocal" : "forward",
                semanticEdges: [...semanticEdges].sort((left, right) => left.id.localeCompare(right.id)),
            };
        });
}

export function nodeSize(degree: number, presentation: GraphPresentation): number {
    const scaled = presentation.baseNodeSize + Math.log2(Math.max(0, degree) + 1) * presentation.degreeSizeScale;
    return Math.min(presentation.maxNodeSize, Math.max(presentation.minNodeSize, scaled));
}

export function graphLabel(label: string, maximumLength: number): string {
    const normalized = label.trim();
    if (normalized.length <= maximumLength) return normalized;
    if (maximumLength <= 1) return "…".slice(0, maximumLength);
    return `${normalized.slice(0, maximumLength - 1).trimEnd()}…`;
}

function uniqueNodes(nodes: readonly GraphNodeInput[]): Map<string, GraphNodeInput> {
    const result = new Map<string, GraphNodeInput>();
    for (const node of nodes) {
        if (!result.has(node.id)) result.set(node.id, node);
    }
    return result;
}

function buildAdjacency(nodeIds: Iterable<string>, edges: readonly GraphEdgeInput[]): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();
    for (const nodeId of nodeIds) adjacency.set(nodeId, new Set());
    for (const edge of edges) {
        adjacency.get(edge.source)?.add(edge.target);
        adjacency.get(edge.target)?.add(edge.source);
    }
    return adjacency;
}

function nodeState(
    node: GraphNodeInput,
    degree: number,
    selectedNodeId: string | null,
    adjacentNodeIds: ReadonlySet<string>,
    presentation: GraphPresentation,
): GraphNodeState {
    const baseSize = nodeSize(degree, presentation);
    const displayLabel = graphLabel(node.title ?? node.path, presentation.maxLabelLength);
    if (!selectedNodeId) {
        return {
            ...node,
            displayLabel,
            degree,
            size: baseSize,
            role: "default",
            opacity: 1,
            labelVisible: baseSize >= presentation.labelSizeThreshold,
        };
    }
    if (node.id === selectedNodeId) {
        return {
            ...node,
            displayLabel,
            degree,
            size: Math.min(presentation.maxNodeSize, baseSize * presentation.selectedNodeScale),
            role: "selected",
            opacity: 1,
            labelVisible: true,
        };
    }
    if (adjacentNodeIds.has(node.id)) {
        return {
            ...node,
            displayLabel,
            degree,
            size: Math.min(presentation.maxNodeSize, baseSize * presentation.neighborNodeScale),
            role: "neighbor",
            opacity: 1,
            labelVisible: true,
        };
    }
    return {
        ...node,
        displayLabel,
        degree,
        size: baseSize,
        role: "muted",
        opacity: presentation.unrelatedOpacity,
        labelVisible: false,
    };
}

function edgeState(edge: GraphDisplayEdge, selectedNodeId: string | null): GraphDisplayEdgeState {
    const emphasized = selectedNodeId !== null && (edge.source === selectedNodeId || edge.target === selectedNodeId);
    return {
        ...edge,
        emphasized,
        muted: selectedNodeId !== null && !emphasized,
    };
}
