import {
    createGraphRuntime,
    createGraphThemeFromTokens,
    type GraphRuntime,
    type GraphTheme,
} from "@choral-forma/graph-view";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useTheme } from "@/app/theme-context";
import { Badge } from "@/components/ui/badge";
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
    const [search, setSearch] = useState("");
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const runtimeProjection = useMemo(() => mapDashboardGraphProjection(projection), [projection]);
    const activeNodeId = useMemo(
        () => activeGraphNodeId(projection, location.pathname),
        [location.pathname, projection],
    );
    const runtimeInputRef = useRef({ activeNodeId, graphTheme, projection: runtimeProjection });
    const adjacentNodes = useMemo(() => graphAdjacentNodes(projection), [projection]);
    const selectedNode = selectedNodeId ? projection.nodes.find((node) => node.id === selectedNodeId) : undefined;
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const matchingNodes = useMemo(
        () =>
            projection.nodes.filter((node) => {
                if (!normalizedSearch) return true;
                return `${node.title}\n${node.path}`.toLocaleLowerCase().includes(normalizedSearch);
            }),
        [normalizedSearch, projection.nodes],
    );
    const visibleNodes = matchingNodes.slice(0, MAX_COMPANION_NODES);

    const routes = useMemo(
        () => new Map(projection.nodes.flatMap((node) => (node.routePath ? [[node.id, node.routePath] as const] : []))),
        [projection.nodes],
    );

    useEffect(() => {
        routesRef.current = routes;
    }, [routes]);

    useEffect(() => {
        navigateRef.current = navigate;
    }, [navigate]);

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
            <div className="border-border bg-muted/20 relative overflow-hidden rounded-lg border">
                <div
                    className="focus-visible:ring-ring/50 relative h-128 w-full outline-none focus-visible:ring-3 focus-visible:ring-inset"
                    ref={containerRef}
                />
                {selectedNode ? (
                    <GraphNodeSummary linkedCount={adjacentNodes.get(selectedNode.id)?.size ?? 0} node={selectedNode} />
                ) : null}
            </div>

            {projection.nodes.length > 0 ? (
                <section aria-label="Graph nodes" className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <label className="text-sm font-medium" htmlFor="forma-graph-search">
                            Search graph nodes
                        </label>
                        <input
                            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-3 sm:max-w-sm"
                            id="forma-graph-search"
                            onChange={(event) => {
                                setSearch(event.target.value);
                            }}
                            placeholder="Title or path"
                            type="search"
                            value={search}
                        />
                    </div>
                    <p aria-live="polite" className="text-muted-foreground text-xs">
                        Showing {String(visibleNodes.length)} of {String(matchingNodes.length)} matching nodes.
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {visibleNodes.map((node) => (
                            <GraphNodeLink active={node.id === selectedNodeId} key={node.id} node={node} />
                        ))}
                    </div>
                </section>
            ) : (
                <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                    No nodes match this graph view.
                </p>
            )}
        </div>
    );
}

const MAX_COMPANION_NODES = 100;

function GraphNodeSummary({
    linkedCount,
    node,
}: {
    linkedCount: number;
    node: DashboardGraphProjection["nodes"][number];
}) {
    return (
        <div className="bg-popover text-popover-foreground pointer-events-none absolute bottom-3 left-3 z-10 w-[min(18rem,calc(100%-1.5rem))] rounded-md border p-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={node.title}>
                        {node.title}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-xs" title={node.path}>
                        {node.path}
                    </p>
                </div>
                <Badge className="shrink-0" variant="outline">
                    {String(linkedCount)} linked
                </Badge>
            </div>
        </div>
    );
}

function GraphNodeLink({ active, node }: { active: boolean; node: DashboardGraphProjection["nodes"][number] }) {
    const content = (
        <>
            <span className="block truncate text-sm font-medium" title={node.title}>
                {node.title}
            </span>
            <span className="text-muted-foreground mt-1 block truncate text-xs" title={node.path}>
                {node.path}
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
