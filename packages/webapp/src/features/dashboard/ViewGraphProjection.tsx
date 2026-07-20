import {
    createGraphRuntime,
    createGraphThemeFromTokens,
    graphExpandPresentation,
    graphSummaryPresentation,
    type GraphRuntime,
    type GraphTheme,
} from "@choral-forma/graph-view";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { useTheme } from "@/app/theme-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { activeGraphNodeId, mapDashboardGraphProjection, type DashboardGraphProjection } from "./graph-adapter";

export function ViewGraphProjection({ projection }: { projection: DashboardGraphProjection }) {
    const { resolvedMode } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const navigateRef = useRef(navigate);
    const runtimeRef = useRef<GraphRuntime | null>(null);
    const routesRef = useRef(new Map<string, string>());
    const [graphTheme, setGraphTheme] = useState<GraphTheme>(() => readGraphThemeTokens(resolvedMode));
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const runtimeProjection = useMemo(() => mapDashboardGraphProjection(projection), [projection]);
    const activeNodeId = useMemo(
        () => activeGraphNodeId(projection, location.pathname),
        [location.pathname, projection],
    );
    const runtimeInputRef = useRef({ activeNodeId, graphTheme, projection: runtimeProjection });
    const adjacentNodes = useMemo(() => graphAdjacentNodes(projection), [projection]);
    const selectedNode = selectedNodeId ? projection.nodes.find((node) => node.id === selectedNodeId) : undefined;
    const routes = useMemo(
        () => new Map(projection.nodes.flatMap((node) => (node.routePath ? [[node.id, node.routePath] as const] : []))),
        [projection.nodes],
    );
    const expandPresentation = graphExpandPresentation(isExpanded);

    useEffect(() => {
        routesRef.current = routes;
    }, [routes]);

    useEffect(() => {
        navigateRef.current = navigate;
    }, [navigate]);

    useEffect(() => {
        if (!isExpanded) return;
        const previousOverflow = document.body.style.overflow;
        const exitExpandedView = (event: KeyboardEvent) => {
            if (event.key === "Escape") setIsExpanded(false);
        };
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", exitExpandedView);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", exitExpandedView);
        };
    }, [isExpanded]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setGraphTheme(readGraphThemeTokens(resolvedMode));
        });
        return () => {
            cancelAnimationFrame(frame);
        };
    }, [resolvedMode]);

    const initialInputRef = useRef({ activeNodeId, graphTheme, projection: runtimeProjection });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const initialInput = initialInputRef.current;
        const runtime = createGraphRuntime({
            container,
            projection: initialInput.projection,
            theme: initialInput.graphTheme,
            activeNodeId: initialInput.activeNodeId,
            layout: {
                reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            },
            ariaLabel:
                "Interactive graph preview. Select a node with one click and open it with Enter or double click.",
            onOpenNode(node) {
                const routePath = routesRef.current.get(node.id);
                if (routePath) void navigateRef.current(routePath);
            },
            onSelectionChange(snapshot) {
                setSelectedNodeId(snapshot.selectedNodeId);
            },
        });
        runtimeRef.current = runtime;
        return () => {
            runtimeRef.current = null;
            runtime.destroy();
        };
    }, []);

    useEffect(() => {
        const previousInput = runtimeInputRef.current;
        const activeNodeChanged = previousInput.activeNodeId !== activeNodeId;
        const projectionChanged = previousInput.projection !== runtimeProjection;
        const themeChanged = previousInput.graphTheme !== graphTheme;
        runtimeInputRef.current = { activeNodeId, graphTheme, projection: runtimeProjection };
        if (!activeNodeChanged && !projectionChanged && !themeChanged) return;
        runtimeRef.current?.update({
            ...(activeNodeChanged ? { activeNodeId } : {}),
            ...(projectionChanged ? { projection: runtimeProjection } : {}),
            ...(themeChanged ? { theme: graphTheme } : {}),
        });
    }, [activeNodeId, graphTheme, runtimeProjection]);

    return (
        <div className="flex flex-col gap-4">
            <div
                className={cn(
                    "border-border bg-muted/20 relative overflow-hidden rounded-lg border",
                    isExpanded && "bg-background fixed inset-0 z-50 h-dvh w-dvw rounded-none border-0",
                )}
            >
                <div
                    className="focus-visible:ring-ring/50 relative w-full outline-none focus-visible:ring-3 focus-visible:ring-inset"
                    data-expanded={isExpanded || undefined}
                    data-forma-graph-stage
                    ref={containerRef}
                />
                <Button
                    aria-label={expandPresentation.ariaLabel}
                    className="bg-background/80 absolute top-3 right-3 z-20 shadow-sm backdrop-blur-sm"
                    onClick={() => {
                        setIsExpanded((expanded) => !expanded);
                    }}
                    size="icon"
                    title={expandPresentation.title}
                    type="button"
                    variant="outline"
                >
                    {isExpanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
                </Button>
                {selectedNode ? (
                    <GraphNodeSummary linkedCount={adjacentNodes.get(selectedNode.id)?.size ?? 0} node={selectedNode} />
                ) : null}
            </div>

            {projection.legend.length > 0 ? <GraphLegend items={projection.legend} /> : null}

            {projection.nodes.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                    No nodes match this graph view.
                </p>
            ) : null}
        </div>
    );
}

function GraphNodeSummary({
    linkedCount,
    node,
}: {
    linkedCount: number;
    node: DashboardGraphProjection["nodes"][number];
}) {
    const summary = graphSummaryPresentation(node, linkedCount);
    if (!summary) return null;
    return (
        <div className="bg-popover text-popover-foreground pointer-events-none absolute bottom-3 left-3 z-10 w-[min(18rem,calc(100%-1.5rem))] rounded-md border p-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={summary.title}>
                        {summary.title}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-xs" title={summary.path}>
                        {summary.path}
                    </p>
                    {node.classification ? (
                        <p className="text-muted-foreground mt-1 truncate text-xs" title={node.classification.label}>
                            {node.classification.label}
                        </p>
                    ) : null}
                </div>
                <Badge className="shrink-0" variant="outline">
                    {summary.links}
                </Badge>
            </div>
        </div>
    );
}

function GraphLegend({ items }: { items: DashboardGraphProjection["legend"] }) {
    return (
        <section aria-label="Graph node colors" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            {items.map((item) => (
                <span className="inline-flex items-center gap-1.5" key={item.key}>
                    <span
                        aria-hidden="true"
                        className={cn(
                            "border-border size-2.5 rounded-full border",
                            !item.color && "bg-muted-foreground",
                        )}
                        style={item.color ? { backgroundColor: item.color } : undefined}
                    />
                    <span>{item.label}</span>
                </span>
            ))}
        </section>
    );
}

function graphAdjacentNodes(projection: DashboardGraphProjection) {
    const adjacentNodes = new Map<string, Set<string>>();
    for (const node of projection.nodes) adjacentNodes.set(node.id, new Set());
    for (const edge of projection.edges) {
        adjacentNodes.get(edge.source)?.add(edge.target);
        adjacentNodes.get(edge.target)?.add(edge.source);
    }
    return adjacentNodes;
}

function readGraphThemeTokens(resolvedMode: "light" | "dark"): GraphTheme {
    const styles = getComputedStyle(document.documentElement);
    const colorContext = document.createElement("canvas").getContext("2d");
    const dark = resolvedMode === "dark";
    const token = (name: string, fallback: string) =>
        normalizeGraphColor(styles.getPropertyValue(name).trim(), fallback, colorContext);

    return createGraphThemeFromTokens({
        background: token("--background", dark ? "#0f172a" : "#ffffff"),
        surface: token("--card", dark ? "#1e293b" : "#ffffff"),
        border: token("--border", dark ? "#334155" : "#e2e8f0"),
        foreground: token("--foreground", dark ? "#f8fafc" : "#0f172a"),
        mutedForeground: token("--muted-foreground", dark ? "#94a3b8" : "#64748b"),
        primary: token("--primary", "#0f9f75"),
        accent: token("--chart-1", dark ? "#38bdf8" : "#0284c7"),
        focusRing: token("--ring", "#0f9f75"),
    });
}

function normalizeGraphColor(value: string, fallback: string, context: CanvasRenderingContext2D | null) {
    if (!value || !context) return fallback;
    const oklchColor = parseOklchColor(value);
    if (oklchColor) return oklchColor;
    context.fillStyle = fallback;
    context.fillStyle = value;
    const normalized = typeof context.fillStyle === "string" && context.fillStyle ? context.fillStyle : fallback;
    return parseOklchColor(normalized) ?? normalized;
}

function parseOklchColor(value: string) {
    const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+%?))?\s*\)$/u.exec(value);
    if (!match) return undefined;
    const [, lightnessValue, chromaValue, hueValue, alphaValue] = match;
    if (!lightnessValue || !chromaValue || !hueValue) return undefined;
    const lightness = parseCssNumber(lightnessValue, 1);
    const chroma = Number(chromaValue);
    const hue = Number(hueValue);
    const alpha = alphaValue ? parseCssNumber(alphaValue, 1) : 1;
    if (![lightness, chroma, hue, alpha].every(Number.isFinite)) return undefined;
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
