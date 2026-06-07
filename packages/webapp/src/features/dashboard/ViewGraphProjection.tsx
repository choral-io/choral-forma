import { MultiDirectedGraph } from "graphology";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import Sigma from "sigma";

import { useTheme } from "@/app/theme-context";
import { Badge } from "@/components/ui/badge";
import type { DashboardViewProjection } from "@/data/workspace-client";

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
    const [activeNodeId, setActiveNodeId] = useState(projection.nodes[0]?.id ?? "");
    const activeNode = projection.nodes.find((node) => node.id === activeNodeId) ?? projection.nodes[0];

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
                hoverLabel: node.title,
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
                label: edge.intent,
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

        renderer.on("enterNode", ({ node }) => {
            activeNodeRef.current = node;
            setActiveNodeId(node);
            renderer.refresh();
        });
        renderer.on("leaveNode", () => {
            activeNodeRef.current = null;
            renderer.refresh();
        });
        renderer.on("clickNode", ({ node }) => {
            const routePath = graph.getNodeAttribute(node, "routePath") as string | undefined;
            if (routePath) {
                void navigate(routePath);
            }
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
            <div className="border-border bg-muted/20 overflow-hidden rounded-lg border">
                <div
                    aria-label="Interactive graph preview"
                    className="relative h-96 w-full outline-none"
                    ref={containerRef}
                    role="img"
                />
            </div>
            {activeNode ? (
                <div className="bg-card text-card-foreground rounded-lg border p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-medium" title={activeNode.title}>
                                {activeNode.title}
                            </h3>
                            <p className="text-muted-foreground mt-1 truncate text-xs" title={activeNode.path}>
                                {activeNode.space} / {activeNode.path}
                            </p>
                        </div>
                        <Badge variant="outline">{String(adjacentNodes.get(activeNode.id)?.size ?? 0)} linked</Badge>
                    </div>
                </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {projection.nodes.map((node) => (
                    <GraphNodeLink key={node.id} node={node} />
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

function GraphNodeLink({ node }: { node: Extract<DashboardViewProjection, { kind: "graph" }>["nodes"][number] }) {
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
        return <div className="bg-card rounded-md border p-3 shadow-sm">{content}</div>;
    }

    return (
        <Link
            className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 rounded-md border p-3 shadow-sm transition-colors outline-none focus-visible:ring-3"
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
    if (space === "notes") {
        return theme.spaceA;
    }

    if (space === "todos") {
        return theme.spaceB;
    }

    if (space === "users") {
        return theme.spaceC;
    }

    return theme.node;
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
        hoverBorder: token("--border", dark ? "#334155" : "#e2e8f0"),
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
    data: { color: string; hoverLabel?: unknown; label?: unknown; size: number; x: number; y: number },
    settings: { labelFont: string; labelSize: number; labelWeight: string },
    theme: GraphThemeTokens,
) {
    const label =
        typeof data.hoverLabel === "string" ? data.hoverLabel : typeof data.label === "string" ? data.label : "";
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

    if (label) {
        const paddingX = 8;
        const paddingY = 5;
        const gap = 8;
        context.font = `${settings.labelWeight} ${String(settings.labelSize)}px ${settings.labelFont}`;
        const canvasRect = context.canvas.getBoundingClientRect();
        const canvasWidth = canvasRect.width || context.canvas.width;
        const canvasHeight = canvasRect.height || context.canvas.height;
        const boxHeight = settings.labelSize + paddingY * 2;
        const maxBoxWidth = Math.min(360, Math.max(160, canvasWidth - 32));
        const displayLabel = truncateCanvasText(context, label, maxBoxWidth - paddingX * 2);
        const labelWidth = Math.ceil(context.measureText(displayLabel).width);
        const boxWidth = labelWidth + paddingX * 2;
        const canPlaceRight = data.x + haloSize + gap + boxWidth <= canvasWidth - 8;
        const boxX = canPlaceRight ? data.x + haloSize + gap : Math.max(8, data.x - haloSize - gap - boxWidth);
        const boxY = clamp(data.y - boxHeight / 2, 8, Math.max(8, canvasHeight - boxHeight - 8));

        drawRoundedRect(context, boxX, boxY, boxWidth, boxHeight, 6);
        context.fillStyle = theme.hoverBackground;
        context.fill();
        context.strokeStyle = theme.hoverBorder;
        context.lineWidth = 1;
        context.stroke();
        context.fillStyle = theme.label;
        context.textBaseline = "middle";
        context.fillText(displayLabel, boxX + paddingX, boxY + boxHeight / 2);
    }

    context.restore();
}

function truncateCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (context.measureText(text).width <= maxWidth) {
        return text;
    }

    const ellipsis = "...";
    let truncated = text;

    while (truncated.length > 1 && context.measureText(`${truncated}${ellipsis}`).width > maxWidth) {
        truncated = truncated.slice(0, -1);
    }

    return `${truncated}${ellipsis}`;
}

function drawRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
) {
    const normalizedRadius = Math.min(radius, width / 2, height / 2);

    context.beginPath();
    context.moveTo(x + normalizedRadius, y);
    context.lineTo(x + width - normalizedRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + normalizedRadius);
    context.lineTo(x + width, y + height - normalizedRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - normalizedRadius, y + height);
    context.lineTo(x + normalizedRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - normalizedRadius);
    context.lineTo(x, y + normalizedRadius);
    context.quadraticCurveTo(x, y, x + normalizedRadius, y);
    context.closePath();
}

interface GraphThemeTokens {
    active: string;
    spaceA: string;
    spaceB: string;
    spaceC: string;
    edge: string;
    edgeMuted: string;
    hoverBackground: string;
    hoverBorder: string;
    label: string;
    node: string;
    nodeMuted: string;
}

interface GraphNodeAttributes extends Record<string, unknown> {
    space: string;
    color: string;
    entryId: string;
    hoverLabel: string;
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
