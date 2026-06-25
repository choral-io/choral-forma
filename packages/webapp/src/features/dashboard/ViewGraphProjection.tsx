import { autoUpdate, flip, offset, shift, useFloating, type VirtualElement } from "@floating-ui/react-dom";
import { MultiDirectedGraph } from "graphology";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router";
import Sigma from "sigma";

import { useTheme } from "@/app/theme-context";
import { Badge } from "@/components/ui/badge";
import type { DashboardViewProjection } from "@/data/workspace-client";
import { cn } from "@/lib/utils";

export function ViewGraphProjection({
    projection,
}: {
    projection: Extract<DashboardViewProjection, { kind: "graph" }>;
}) {
    const { resolvedMode } = useTheme();
    const graphTheme = useMemo(() => readGraphThemeTokens(resolvedMode), [resolvedMode]);
    const positions = useMemo(() => graphNodePositions(projection.nodes.map((node) => node.id)), [projection.nodes]);
    const adjacentNodes = useMemo(() => graphAdjacentNodes(projection), [projection]);
    const activeNodeRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [nodePopupReference, setNodePopupReference] = useState<VirtualElement | null>(null);
    const activeNode = activeNodeId ? projection.nodes.find((node) => node.id === activeNodeId) : undefined;
    const graphNodePopupOpen = Boolean(activeNode && nodePopupReference);
    const { floatingStyles, refs } = useFloating<VirtualElement>({
        elements: {
            reference: nodePopupReference,
        },
        middleware: useMemo(() => [offset(24), flip({ padding: 12 }), shift({ padding: 12 })], []),
        open: graphNodePopupOpen,
        placement: "right",
        strategy: "fixed",
        whileElementsMounted: autoUpdate,
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        const graph = new MultiDirectedGraph<GraphNodeAttributes, GraphEdgeAttributes>();
        for (const node of projection.nodes) {
            const position = positions.get(node.id) ?? { x: 0, y: 0 };
            graph.addNode(node.id, {
                space: node.space,
                color: graphNodeColor(node.space, graphTheme),
                entryId: node.entryId ?? "",
                label: node.title,
                path: node.path,
                routePath: node.routePath ?? "",
                size: node.entryId ? 9 : 7,
                x: position.x,
                y: position.y,
            });
        }

        for (const edge of projection.edges) {
            if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
                continue;
            }

            graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
                color: graphTheme.edge,
                label: edge.label,
                size: edge.referenceSource === "body" ? 1.2 : 0.8,
            });
        }

        const renderer = new Sigma<GraphNodeAttributes, GraphEdgeAttributes>(graph, container, {
            allowInvalidContainer: true,
            defaultEdgeColor: graphTheme.edge,
            defaultNodeColor: graphTheme.node,
            edgeReducer(edge, data) {
                const active = activeNodeRef.current;
                if (!active) {
                    return data;
                }

                return graph.source(edge) === active || graph.target(edge) === active
                    ? { ...data, color: graphTheme.active, size: 2 }
                    : { ...data, color: graphTheme.edgeMuted, hidden: true };
            },
            enableEdgeEvents: false,
            defaultDrawNodeHover(context, data, settings) {
                drawGraphNodeHover(context, data, settings, graphTheme);
            },
            labelColor: { color: graphTheme.label },
            labelSize: 12,
            labelRenderedSizeThreshold: 8,
            nodeReducer(node, data) {
                const active = activeNodeRef.current;
                if (!active) {
                    return data;
                }

                if (node === active) {
                    return {
                        ...data,
                        color: graphTheme.active,
                        highlighted: true,
                        label: "",
                        size: data.size + 4,
                        zIndex: 2,
                    };
                }

                if (adjacentNodes.get(active)?.has(node)) {
                    return {
                        ...data,
                        zIndex: 1,
                    };
                }

                return {
                    ...data,
                    color: graphTheme.nodeMuted,
                    label: "",
                    zIndex: 0,
                };
            },
            renderEdgeLabels: false,
            stagePadding: 90,
            zIndex: true,
        });

        renderer.on("enterNode", ({ event, node }) => {
            activeNodeRef.current = node;
            setActiveNodeId(node);
            const nodeDisplayData = renderer.getNodeDisplayData(node);
            const popupAnchor = nodeDisplayData ? renderer.framedGraphToViewport(nodeDisplayData) : event;
            setNodePopupReference(graphNodePopupVirtualElement(popupAnchor, container));
            renderer.refresh();
        });
        renderer.on("leaveNode", () => {
            activeNodeRef.current = null;
            setActiveNodeId(null);
            setNodePopupReference(null);
            renderer.refresh();
        });
        renderer.on("clickNode", ({ node }) => {
            const routePath = graph.getNodeAttribute(node, "routePath") as string | undefined;
            if (routePath) {
                void navigate(routePath);
            }
        });
        renderer.on("clickStage", () => {
            activeNodeRef.current = null;
            setActiveNodeId(null);
            setNodePopupReference(null);
            renderer.refresh();
        });

        let resizeFrame = 0;
        let resizeSettleTimeout: ReturnType<typeof setTimeout> | null = null;
        let graphSize = {
            height: container.offsetHeight,
            width: container.offsetWidth,
        };

        const resizeGraph = () => {
            const nextSize = {
                height: container.offsetHeight,
                width: container.offsetWidth,
            };

            if (nextSize.width <= 0 || nextSize.height <= 0) {
                return;
            }

            if (nextSize.width === graphSize.width && nextSize.height === graphSize.height) {
                renderer.scheduleRender();
                return;
            }

            graphSize = nextSize;
            renderer.resize().scheduleRender();
        };

        const resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                resizeGraph();

                if (resizeSettleTimeout) {
                    clearTimeout(resizeSettleTimeout);
                }
                resizeSettleTimeout = setTimeout(resizeGraph, GRAPH_RESIZE_SETTLE_DELAY_MS);
            });
        });
        resizeObserver.observe(container);

        return () => {
            cancelAnimationFrame(resizeFrame);
            if (resizeSettleTimeout) {
                clearTimeout(resizeSettleTimeout);
            }
            resizeObserver.disconnect();
            renderer.kill();
        };
    }, [adjacentNodes, graphTheme, navigate, positions, projection.edges, projection.nodes]);

    return (
        <div className="flex flex-col gap-4">
            <div className="border-border bg-muted/20 relative overflow-hidden rounded-lg border">
                <div
                    aria-label="Interactive graph preview"
                    className="relative h-96 w-full outline-none"
                    ref={containerRef}
                    role="img"
                />
                {activeNode && nodePopupReference ? (
                    <GraphNodePopupCard
                        floatingRef={refs.setFloating}
                        floatingStyles={floatingStyles}
                        linkedCount={adjacentNodes.get(activeNode.id)?.size ?? 0}
                        node={activeNode}
                    />
                ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {projection.nodes.map((node) => (
                    <GraphNodeLink active={node.id === activeNodeId} key={node.id} node={node} />
                ))}
            </div>
            {projection.nodes.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                    No nodes match this graph view.
                </p>
            ) : null}
        </div>
    );
}

const GRAPH_RESIZE_SETTLE_DELAY_MS = 150;
function GraphNodePopupCard({
    floatingRef,
    floatingStyles,
    linkedCount,
    node,
}: {
    floatingRef: (node: HTMLElement | null) => void;
    floatingStyles: CSSProperties;
    linkedCount: number;
    node: Extract<DashboardViewProjection, { kind: "graph" }>["nodes"][number];
}) {
    return (
        <div
            className="bg-popover text-popover-foreground pointer-events-none z-10 w-72 rounded-md border p-3 shadow-lg"
            ref={floatingRef}
            style={floatingStyles}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={node.title}>
                        {node.title}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-xs" title={node.path}>
                        {node.space} / {node.path}
                    </p>
                </div>
                <Badge className="shrink-0" variant="outline">
                    {String(linkedCount)} linked
                </Badge>
            </div>
        </div>
    );
}

function graphNodePopupVirtualElement(anchor: { x: number; y: number }, container: HTMLElement): VirtualElement {
    const containerRect = container.getBoundingClientRect();
    const x = containerRect.left + anchor.x;
    const y = containerRect.top + anchor.y;
    const rect = {
        bottom: y,
        height: 0,
        left: x,
        right: x,
        top: y,
        width: 0,
        x,
        y,
    };

    return {
        getBoundingClientRect() {
            return rect;
        },
    };
}

function GraphNodeLink({
    active,
    node,
}: {
    active: boolean;
    node: Extract<DashboardViewProjection, { kind: "graph" }>["nodes"][number];
}) {
    const content = (
        <>
            <span className="block truncate text-sm font-medium" title={node.title}>
                {node.title}
            </span>
            <span className="text-muted-foreground mt-1 block truncate text-xs" title={node.path}>
                {node.space} / {node.path}
            </span>
        </>
    );

    if (!node.routePath) {
        return (
            <div className={cn("bg-card rounded-md border p-3 shadow-sm", active && "border-primary/50 bg-accent/40")}>
                {content}
            </div>
        );
    }

    return (
        <Link
            aria-current={active ? "true" : undefined}
            className={cn(
                "bg-card hover:bg-accent/50 focus-visible:ring-ring/50 rounded-md border p-3 shadow-sm transition-colors outline-none focus-visible:ring-3",
                active && "border-primary/50 bg-accent/40",
            )}
            to={node.routePath}
        >
            {content}
        </Link>
    );
}

function graphNodePositions(nodeIds: string[]) {
    const positions = new Map<string, { x: number; y: number }>();
    const radius = nodeIds.length < 5 ? 0.85 : 1.1;
    const center = { x: 0, y: 0 };

    nodeIds.forEach((nodeId, index) => {
        const angle = (2 * Math.PI * index) / Math.max(nodeIds.length, 1) - Math.PI / 2;
        positions.set(nodeId, {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
        });
    });

    return positions;
}

function graphAdjacentNodes(projection: Extract<DashboardViewProjection, { kind: "graph" }>) {
    const adjacentNodes = new Map<string, Set<string>>();
    for (const node of projection.nodes) {
        adjacentNodes.set(node.id, new Set());
    }

    for (const edge of projection.edges) {
        adjacentNodes.get(edge.source)?.add(edge.target);
        adjacentNodes.get(edge.target)?.add(edge.source);
    }

    return adjacentNodes;
}

function graphNodeColor(space: string, theme: GraphThemeTokens) {
    const palette = [theme.spaceA, theme.spaceB, theme.spaceC, theme.node];
    let hash = 0;
    for (let index = 0; index < space.length; index += 1) {
        hash += space.charCodeAt(index);
    }
    const index = hash % palette.length;
    return palette[index] ?? theme.node;
}

function readGraphThemeTokens(resolvedMode: "light" | "dark"): GraphThemeTokens {
    const styles = getComputedStyle(document.documentElement);
    const colorContext = document.createElement("canvas").getContext("2d");
    const dark = resolvedMode === "dark";
    const token = (name: string, fallback: string) =>
        normalizeGraphColor(styles.getPropertyValue(name).trim(), fallback, colorContext);

    return {
        active: token("--primary", "#0f9f75"),
        spaceA: token("--chart-1", "#38bdf8"),
        spaceB: token("--chart-2", "#0ea5e9"),
        spaceC: token("--chart-3", "#2563eb"),
        edge: token("--muted-foreground", dark ? "#94a3b8" : "#64748b"),
        edgeMuted: token("--border", dark ? "#334155" : "#e2e8f0"),
        hoverBackground: token("--card", dark ? "#1e293b" : "#ffffff"),
        label: token("--foreground", dark ? "#f8fafc" : "#0f172a"),
        node: token("--muted-foreground", dark ? "#94a3b8" : "#64748b"),
        nodeMuted: token("--border", dark ? "#334155" : "#e2e8f0"),
    };
}

function normalizeGraphColor(value: string, fallback: string, context: CanvasRenderingContext2D | null) {
    if (!value || !context) {
        return fallback;
    }

    const oklchColor = parseOklchColor(value);
    if (oklchColor) {
        return oklchColor;
    }

    context.fillStyle = fallback;
    context.fillStyle = value;

    const normalized = typeof context.fillStyle === "string" && context.fillStyle ? context.fillStyle : fallback;

    return parseOklchColor(normalized) ?? normalized;
}

function parseOklchColor(value: string) {
    const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/u.exec(value);
    if (!match) {
        return undefined;
    }

    const [, lightnessValue, chromaValue, hueValue, alphaValue] = match;
    if (!lightnessValue || !chromaValue || !hueValue) {
        return undefined;
    }

    const lightness = parseCssNumber(lightnessValue, 1);
    const chroma = Number(chromaValue);
    const hue = Number(hueValue);
    const alpha = alphaValue ? parseCssNumber(alphaValue, 1) : 1;
    if (![lightness, chroma, hue, alpha].every(Number.isFinite)) {
        return undefined;
    }

    const hueRadians = (hue * Math.PI) / 180;
    const labA = chroma * Math.cos(hueRadians);
    const labB = chroma * Math.sin(hueRadians);
    const lPrime = lightness + 0.3963377774 * labA + 0.2158037573 * labB;
    const mPrime = lightness - 0.1055613458 * labA - 0.0638541728 * labB;
    const sPrime = lightness - 0.0894841775 * labA - 1.291485548 * labB;
    const l = lPrime ** 3;
    const m = mPrime ** 3;
    const s = sPrime ** 3;
    const red = linearSrgbToByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
    const green = linearSrgbToByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
    const blue = linearSrgbToByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
    const clampedAlpha = clamp(alpha, 0, 1);

    return clampedAlpha < 1
        ? `rgba(${String(red)}, ${String(green)}, ${String(blue)}, ${String(clampedAlpha)})`
        : `rgb(${String(red)}, ${String(green)}, ${String(blue)})`;
}

function parseCssNumber(value: string, percentBase: number) {
    return value.endsWith("%") ? (Number(value.slice(0, -1)) / 100) * percentBase : Number(value);
}

function linearSrgbToByte(value: number) {
    const gamma = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

    return Math.round(clamp(gamma, 0, 1) * 255);
}

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(Math.max(value, minimum), maximum);
}

function drawGraphNodeHover(
    context: CanvasRenderingContext2D,
    data: { color: string; size: number; x: number; y: number },
    _settings: { labelFont: string; labelSize: number; labelWeight: string },
    theme: GraphThemeTokens,
) {
    const haloSize = data.size + 4;

    context.save();
    context.beginPath();
    context.arc(data.x, data.y, haloSize, 0, Math.PI * 2);
    context.fillStyle = theme.hoverBackground;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = theme.active;
    context.stroke();

    context.beginPath();
    context.arc(data.x, data.y, data.size + 1, 0, Math.PI * 2);
    context.fillStyle = data.color;
    context.fill();

    context.restore();
}

interface GraphThemeTokens {
    active: string;
    spaceA: string;
    spaceB: string;
    spaceC: string;
    edge: string;
    edgeMuted: string;
    hoverBackground: string;
    label: string;
    node: string;
    nodeMuted: string;
}

interface GraphNodeAttributes extends Record<string, unknown> {
    space: string;
    color: string;
    entryId: string;
    label: string;
    path: string;
    routePath: string;
    size: number;
    x: number;
    y: number;
}

interface GraphEdgeAttributes extends Record<string, unknown> {
    color: string;
    label: string;
    size: number;
}
