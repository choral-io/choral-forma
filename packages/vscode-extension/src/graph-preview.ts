import {
    createGraphRuntime,
    createGraphThemeFromTokens,
    type GraphNodeInput,
    type GraphTheme,
    type GraphViewSnapshot,
} from "@choral-forma/graph-view";
import {
    mapPreviewGraphProjection,
    parsePreviewGraphData,
    type GraphRenderOutput,
    type PreviewGraphData,
} from "./graph-preview-data.ts";
import { graphSummaryPresentation, shouldScheduleGraphReconcile } from "./graph-preview-lifecycle.ts";

type GraphController = {
    host: HTMLElement;
    update(data: PreviewGraphData): void;
    updateTheme(): void;
    destroy(): void;
};

const MAX_COMPANION_NODES = 100;
const controllers = new Map<HTMLElement, GraphController>();
const preservedSelections = new Map<string, string | null>();
let reconcileFrame = 0;
let contentObserver: MutationObserver | undefined;
let themeObserver: MutationObserver | undefined;

function start(): void {
    reconcile();
    contentObserver = new MutationObserver((records) => {
        if (shouldScheduleGraphReconcile(records)) scheduleReconcile();
    });
    contentObserver.observe(document.body, { childList: true, subtree: true });
    themeObserver = new MutationObserver(() => {
        for (const controller of controllers.values()) controller.updateTheme();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("vscode.markdown.updateContent", scheduleReconcile);
    document.addEventListener("vscode.markdown.updateContent", scheduleReconcile);
    window.addEventListener("pagehide", stop, { once: true });
}

function stop(): void {
    cancelAnimationFrame(reconcileFrame);
    reconcileFrame = 0;
    contentObserver?.disconnect();
    themeObserver?.disconnect();
    window.removeEventListener("vscode.markdown.updateContent", scheduleReconcile);
    document.removeEventListener("vscode.markdown.updateContent", scheduleReconcile);
    for (const controller of controllers.values()) controller.destroy();
    controllers.clear();
    preservedSelections.clear();
}

function scheduleReconcile(): void {
    cancelAnimationFrame(reconcileFrame);
    reconcileFrame = requestAnimationFrame(() => {
        reconcileFrame = 0;
        reconcile();
    });
}

function reconcile(): void {
    const hosts = new Set(document.querySelectorAll<HTMLElement>("[data-forma-graph-host]"));
    for (const [host, controller] of controllers) {
        if (hosts.has(host) && document.contains(host)) continue;
        controller.destroy();
        controllers.delete(host);
    }
    for (const host of hosts) {
        const data = graphDataForHost(host);
        const existing = controllers.get(host);
        if (!data) {
            existing?.destroy();
            controllers.delete(host);
            markGraphUnavailable(host);
            continue;
        }
        try {
            host.removeAttribute("aria-disabled");
            host.removeAttribute("data-forma-graph-error");
            if (existing) existing.update(data);
            else controllers.set(host, createController(host, data));
        } catch {
            existing?.destroy();
            controllers.delete(host);
            markGraphUnavailable(host);
        }
    }
}

function markGraphUnavailable(host: HTMLElement): void {
    host.dataset.formaGraphError = "true";
    host.setAttribute("aria-disabled", "true");
    host.setAttribute("aria-label", "Interactive graph preview unavailable. Use the graph node list below.");
}

function graphDataForHost(host: HTMLElement): PreviewGraphData | undefined {
    const section = host.closest<HTMLElement>("[data-forma-view]");
    // VS Code's native Markdown preview preserves inert JSON scripts but strips
    // custom attributes from script elements. Keep the explicit Forma selector
    // for other hosts and fall back to the section-local JSON script here.
    const dataElement = section?.querySelector<HTMLElement>("[data-forma-graph-data], script[type='application/json']");
    return parsePreviewGraphData(dataElement?.textContent ?? "");
}

function createController(host: HTMLElement, initialData: PreviewGraphData): GraphController {
    const graphKey = host.id;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.textContent =
        ":host{display:block;width:100%;height:100%}div{width:100%;height:100%}div:focus-visible{outline:2px solid var(--vscode-focusBorder,currentColor);outline-offset:-2px}";
    const container = document.createElement("div");
    shadow.append(style, container);

    let data = initialData;
    let projection = mapPreviewGraphProjection(data.projection);
    let projectionFingerprint = JSON.stringify(data.projection);
    let theme = readGraphTheme();
    let themeFingerprint = JSON.stringify(theme);
    let activeNodeId = data.activeNodeId;
    let selectedNodeId: string | null = readPreservedSelection(graphKey, data.activeNodeId);
    let search = "";
    let renderedList: HTMLElement | undefined;
    let renderedCount: HTMLElement | undefined;
    let renderedProjectionFingerprint = "";
    let renderedSearch = "";
    const runtime = createGraphRuntime({
        container,
        projection,
        theme,
        activeNodeId: selectedNodeId,
        presentation: readGraphTypography(),
        layout: {
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            useWorker: false,
        },
        ariaLabel: "Interactive graph preview. Select a node with one click and open it with Enter or double click.",
        onOpenNode: (node) => {
            openNodeSource(host, node);
        },
        onSelectionChange: (snapshot) => {
            selectedNodeId = snapshot.selectedNodeId;
            preserveSelection(graphKey, selectedNodeId);
            updateSelectionSurface(host, data.projection, snapshot);
        },
    });

    const renderCompanion = (): void => {
        const section = host.closest<HTMLElement>("[data-forma-view]");
        const input = section?.querySelector<HTMLInputElement>("[data-forma-graph-search]");
        if (input && input.dataset.formaGraphBound !== "true") {
            input.dataset.formaGraphBound = "true";
            input.value = search;
            input.addEventListener("input", () => {
                search = input.value;
                renderCompanion();
            });
        }
        const list = section?.querySelector<HTMLElement>("[data-forma-graph-node-list]");
        const count = section?.querySelector<HTMLElement>("[data-forma-graph-count]");
        if (!list || !count) return;
        if (
            list === renderedList &&
            count === renderedCount &&
            projectionFingerprint === renderedProjectionFingerprint &&
            search === renderedSearch
        ) {
            return;
        }
        const normalizedSearch = search.trim().toLocaleLowerCase();
        const matching = data.projection.nodes.filter((node) => {
            if (!normalizedSearch) return true;
            return `${node.title ?? ""}\n${node.path}`.toLocaleLowerCase().includes(normalizedSearch);
        });
        const visible = matching.slice(0, MAX_COMPANION_NODES);
        list.replaceChildren(...visible.map((node) => graphNodeLink(node, selectedNodeId)));
        count.textContent = `Showing ${String(visible.length)} of ${String(matching.length)} matching nodes.`;
        renderedList = list;
        renderedCount = count;
        renderedProjectionFingerprint = projectionFingerprint;
        renderedSearch = search;
    };

    renderCompanion();
    updateSelectionSurface(host, data.projection, runtime.snapshot());

    return {
        host,
        update(nextData) {
            data = nextData;
            const nextProjectionFingerprint = JSON.stringify(nextData.projection);
            const projectionChanged = projectionFingerprint !== nextProjectionFingerprint;
            const activeNodeChanged = activeNodeId !== nextData.activeNodeId;
            if (projectionChanged) {
                projectionFingerprint = nextProjectionFingerprint;
                projection = mapPreviewGraphProjection(nextData.projection);
            }
            if (activeNodeChanged) activeNodeId = nextData.activeNodeId;
            if (projectionChanged || activeNodeChanged) {
                runtime.update({
                    ...(projectionChanged ? { projection } : {}),
                    ...(activeNodeChanged ? { activeNodeId } : {}),
                });
            }
            renderCompanion();
            updateSelectionSurface(host, data.projection, runtime.snapshot());
        },
        updateTheme() {
            const nextTheme = readGraphTheme();
            const nextThemeFingerprint = JSON.stringify(nextTheme);
            if (themeFingerprint === nextThemeFingerprint) return;
            theme = nextTheme;
            themeFingerprint = nextThemeFingerprint;
            runtime.update({ theme });
        },
        destroy() {
            runtime.destroy();
            shadow.replaceChildren();
        },
    };
}

function readPreservedSelection(graphKey: string, fallback: string | null): string | null {
    if (preservedSelections.has(graphKey)) return preservedSelections.get(graphKey) ?? null;
    try {
        const stored = sessionStorage.getItem(`forma.graph.selection.${graphKey}`);
        if (stored === null) return fallback;
        const parsed: unknown = JSON.parse(stored);
        if (parsed === null || typeof parsed === "string") return parsed;
    } catch {
        // Ephemeral webview storage is optional; the in-memory fallback remains valid.
    }
    return fallback;
}

function preserveSelection(graphKey: string, selectedNodeId: string | null): void {
    preservedSelections.set(graphKey, selectedNodeId);
    try {
        sessionStorage.setItem(`forma.graph.selection.${graphKey}`, JSON.stringify(selectedNodeId));
    } catch {
        // Keep preview interaction functional when storage is unavailable.
    }
}

function readGraphTheme(): GraphTheme {
    const bodyStyle = getComputedStyle(document.body);
    const rootStyle = getComputedStyle(document.documentElement);
    const token = (names: readonly string[], fallback: string): string => {
        for (const name of names) {
            const value = bodyStyle.getPropertyValue(name).trim() || rootStyle.getPropertyValue(name).trim();
            if (value) return value;
        }
        return fallback;
    };
    return createGraphThemeFromTokens({
        background: token(["--vscode-editor-background"], "#ffffff"),
        surface: token(["--vscode-editorWidget-background", "--vscode-sideBar-background"], "#ffffff"),
        border: token(["--vscode-contrastBorder", "--vscode-panel-border"], "#d4d4d4"),
        foreground: token(["--vscode-editor-foreground"], "#1f2328"),
        mutedForeground: token(["--vscode-descriptionForeground"], "#656d76"),
        primary: token(["--vscode-textLink-foreground", "--vscode-charts-green"], "#0969da"),
        accent: token(["--vscode-charts-blue", "--vscode-focusBorder"], "#0969da"),
        focusRing: token(["--vscode-focusBorder", "--vscode-contrastActiveBorder"], "#0969da"),
    });
}

function readGraphTypography(): { labelFont: string; labelWeight: string } {
    const bodyStyle = getComputedStyle(document.body);
    const font = bodyStyle.getPropertyValue("--vscode-editor-font-family").trim() || bodyStyle.fontFamily;
    const weight = bodyStyle.getPropertyValue("--vscode-editor-font-weight").trim() || bodyStyle.fontWeight;
    return { labelFont: font || "sans-serif", labelWeight: weight || "normal" };
}

function openNodeSource(host: HTMLElement, node: GraphNodeInput): void {
    const section = host.closest<HTMLElement>("[data-forma-view]");
    const existing = [...(section?.querySelectorAll<HTMLAnchorElement>("[data-forma-graph-node-id]") ?? [])].find(
        (anchor) => anchor.dataset.formaGraphNodeId === node.id,
    );
    if (existing) {
        existing.click();
        return;
    }
    const anchor = document.createElement("a");
    anchor.href = `/${node.path}`;
    anchor.hidden = true;
    section?.append(anchor);
    anchor.click();
    anchor.remove();
}

function updateSelectionSurface(host: HTMLElement, projection: GraphRenderOutput, snapshot: GraphViewSnapshot): void {
    const section = host.closest<HTMLElement>("[data-forma-view]");
    const summary = section?.querySelector<HTMLElement>("[data-forma-graph-summary]");
    const selected = projection.nodes.find((node) => node.id === snapshot.selectedNodeId);
    if (summary) {
        const presentation = graphSummaryPresentation(selected, snapshot.adjacentNodeIds.size);
        const fingerprint = presentation?.fingerprint ?? "";
        if (summary.dataset.formaGraphSummaryState !== fingerprint) {
            summary.dataset.formaGraphSummaryState = fingerprint;
            summary.replaceChildren();
            summary.hidden = !presentation;
        }
        if (presentation && summary.childElementCount === 0) {
            const title = document.createElement("strong");
            title.textContent = presentation.title;
            const path = document.createElement("span");
            path.textContent = presentation.path;
            const links = document.createElement("span");
            links.textContent = presentation.links;
            summary.append(title, path, links);
        }
    }
    for (const anchor of section?.querySelectorAll<HTMLAnchorElement>("[data-forma-graph-node-id]") ?? []) {
        const active = anchor.dataset.formaGraphNodeId === snapshot.selectedNodeId;
        anchor.classList.toggle("is-selected", active);
        if (active) anchor.setAttribute("aria-current", "true");
        else anchor.removeAttribute("aria-current");
    }
}

function graphNodeLink(node: GraphRenderOutput["nodes"][number], selectedNodeId: string | null): HTMLAnchorElement {
    const anchor = document.createElement("a");
    anchor.className = "graph-node-link";
    anchor.href = `/${node.path}`;
    anchor.dataset.formaGraphNodeId = node.id;
    if (node.id === selectedNodeId) {
        anchor.classList.add("is-selected");
        anchor.setAttribute("aria-current", "true");
    }
    const title = document.createElement("span");
    title.className = "graph-node-title";
    title.textContent = node.title ?? node.path;
    const path = document.createElement("span");
    path.className = "graph-node-path";
    path.textContent = node.path;
    anchor.append(title, path);
    if (node.classification?.label) {
        const classification = document.createElement("span");
        classification.className = "graph-node-classification";
        classification.textContent = node.classification.label;
        anchor.append(classification);
    }
    return anchor;
}

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
}
