export type GraphNodeInput = {
    id: string;
    path: string;
    title?: string;
    kind?: string;
};

export type GraphEdgeInput = {
    id: string;
    source: string;
    target: string;
    sourcePath: string;
    targetPath: string;
    fragment?: string;
    fragmentKind?: "heading" | "block";
    intent: "reference" | "link" | "embed";
    referenceSource: "frontmatter" | "body";
    label: string;
    field?: string;
    semanticType?: string;
};

export type GraphProjection = {
    nodes: readonly GraphNodeInput[];
    edges: readonly GraphEdgeInput[];
};

export type GraphTheme = {
    background: string;
    surface: string;
    border: string;
    node: string;
    nodeSelected: string;
    nodeNeighbor: string;
    nodeMuted: string;
    edge: string;
    edgeSelected: string;
    edgeMuted: string;
    label: string;
    labelMuted: string;
    focusRing: string;
};

export type GraphPresentation = {
    baseNodeSize: number;
    degreeSizeScale: number;
    minNodeSize: number;
    maxNodeSize: number;
    maxLabelLength: number;
    unrelatedOpacity: number;
    selectedNodeScale: number;
    neighborNodeScale: number;
    labelDensity: number;
    labelGridCellSize: number;
    labelSize: number;
    labelSizeThreshold: number;
    stagePadding: number;
};

export type GraphLayoutEngine = "auto" | "force" | "forceAtlas2";

export type GraphLayoutOptions = {
    engine: GraphLayoutEngine;
    reducedMotion: boolean;
    settleDurationMs: number;
};

export const DEFAULT_GRAPH_LAYOUT_OPTIONS: Readonly<GraphLayoutOptions> = Object.freeze({
    engine: "auto",
    reducedMotion: false,
    settleDurationMs: 1_200,
});

export const DEFAULT_GRAPH_PRESENTATION: Readonly<GraphPresentation> = Object.freeze({
    baseNodeSize: 4,
    degreeSizeScale: 1.4,
    minNodeSize: 4,
    maxNodeSize: 12,
    maxLabelLength: 42,
    unrelatedOpacity: 0.22,
    selectedNodeScale: 1.45,
    neighborNodeScale: 1.12,
    labelDensity: 0.35,
    labelGridCellSize: 120,
    labelSize: 11,
    labelSizeThreshold: 8.5,
    stagePadding: 72,
});

export type GraphSelectionSource = "active" | "user";

export type GraphDisplayEdge = {
    id: string;
    source: string;
    target: string;
    direction: "forward" | "reciprocal";
    semanticEdges: readonly GraphEdgeInput[];
};

export type GraphNodeVisualRole = "default" | "selected" | "neighbor" | "muted";

export type GraphNodeState = GraphNodeInput & {
    displayLabel: string;
    degree: number;
    size: number;
    role: GraphNodeVisualRole;
    opacity: number;
    labelVisible: boolean;
};

export type GraphDisplayEdgeState = GraphDisplayEdge & {
    emphasized: boolean;
    muted: boolean;
};

export type GraphViewSnapshot = {
    nodes: readonly GraphNodeState[];
    edges: readonly GraphDisplayEdgeState[];
    selectedNodeId: string | null;
    selectionSource: GraphSelectionSource | null;
    adjacentNodeIds: ReadonlySet<string>;
};

export type GraphPosition = Readonly<{ x: number; y: number }>;

export type GraphRuntimeSnapshot = GraphViewSnapshot & {
    positions: ReadonlyMap<string, GraphPosition>;
};

export type GraphRuntimeOptions = {
    container: HTMLElement;
    projection: GraphProjection;
    theme: GraphTheme;
    presentation?: Partial<GraphPresentation>;
    layout?: Partial<GraphLayoutOptions>;
    activeNodeId?: string | null;
    ariaLabel?: string;
    onOpenNode?: (node: GraphNodeInput) => void;
    onSelectionChange?: (snapshot: GraphViewSnapshot) => void;
};

export type GraphRuntimeUpdate = {
    projection?: GraphProjection;
    theme?: GraphTheme;
    activeNodeId?: string | null;
};

export type GraphRuntime = {
    update(update: GraphRuntimeUpdate): void;
    fit(): void;
    openSelected(): void;
    snapshot(): GraphRuntimeSnapshot;
    destroy(): void;
};
