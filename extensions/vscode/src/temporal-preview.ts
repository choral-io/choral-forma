import type { CalendarProjection, GanttProjection } from "@choral-forma/shared";
import type { TemporalProjection, TemporalViewState } from "@choral-forma/temporal-view";
import styles from "@choral-forma/temporal-view/preview.css";
import { mountTemporalView } from "@choral-forma/temporal-view/runtime";
import { relativePreviewHref } from "./preview-links.ts";

type Projection = CalendarProjection | GanttProjection;
type Controller = ReturnType<typeof mountTemporalView> & {
    fingerprint: string;
    ready: boolean;
    failed: boolean;
    key: string;
};

export function parseTemporalPreviewData(text: string): Projection | undefined {
    try {
        const data = JSON.parse(text) as { schemaVersion?: number; projection?: Partial<Projection> } | null;
        const projection = data?.projection;
        if (data?.schemaVersion !== 1 || !projection || typeof projection.timeZone !== "string" || !projection.counts)
            return undefined;
        if (projection.kind === "calendar" && Array.isArray(projection.events) && Array.isArray(projection.unscheduled))
            return projection as Projection;
        if (
            projection.kind === "gantt" &&
            Array.isArray(projection.nodes) &&
            Array.isArray(projection.rows) &&
            Array.isArray(projection.edges)
        )
            return projection as Projection;
    } catch {
        /* Invalid or incompatible data retains the semantic fallback. */
    }
    return undefined;
}

const states = new Map<string, TemporalViewState>();

/** Native Markdown Preview can replace the entire mount on every saved edit. */
export function startTemporalPreview(): () => void {
    const controllers = new Map<HTMLElement, Controller>();
    let frame = 0;
    let stopped = false;

    const reconcile = () => {
        frame = 0;
        if (stopped) return;
        const hosts = new Set(document.querySelectorAll<HTMLElement>("[data-forma-temporal-host]"));
        for (const [host, controller] of controllers) {
            if (hosts.has(host)) continue;
            controller.destroy();
            controllers.delete(host);
        }
        for (const host of hosts) {
            const section = host.closest<HTMLElement>("[data-forma-view]");
            const sourcePath = section?.dataset.formaViewSource;
            const fallback = section?.querySelector<HTMLElement>("[data-forma-temporal-fallback]");
            // The native sanitizer removes custom attributes on inert scripts.
            const text = section?.querySelector("script[type='application/json']")?.textContent ?? "";
            const projection = parseTemporalPreviewData(text);
            let existing = controllers.get(host);
            if (!projection || !sourcePath) {
                existing?.destroy();
                controllers.delete(host);
                host.hidden = true;
                delete host.dataset.formaTemporalReady;
                if (fallback) fallback.hidden = false;
                continue;
            }
            const key = `${sourcePath}:${projection.kind}`;
            if (existing && (existing.key !== key || (existing.failed && existing.fingerprint !== text))) {
                existing.destroy();
                controllers.delete(host);
                existing = undefined;
            }
            host.style.setProperty(
                "--forma-color-scheme",
                document.body.classList.contains("vscode-dark") ||
                    document.body.classList.contains("vscode-high-contrast")
                    ? "dark"
                    : "light",
            );
            if (existing?.fingerprint === text) {
                if (fallback) fallback.hidden = existing.ready;
                continue;
            }
            const entries =
                projection.kind === "calendar" ? [...projection.events, ...projection.unscheduled] : projection.nodes;
            const routes = Object.fromEntries(
                entries.map((entry) => [entry.path, relativePreviewHref(sourcePath, entry.path)]),
            );
            const mapped: TemporalProjection = { ...projection, routes };
            if (existing) {
                existing.fingerprint = text;
                existing.update(mapped);
                if (fallback) fallback.hidden = existing.ready;
                continue;
            }
            const state = states.get(key) ?? {};
            states.delete(key);
            states.set(key, state);
            // Bound saved viewer state when a preview follows many documents.
            if (states.size > 32) states.delete(states.keys().next().value ?? "");
            const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
            const style = document.createElement("style");
            style.textContent = styles;
            const container = document.createElement("div");
            shadow.replaceChildren(style, container);
            host.hidden = false;
            const runtime = mountTemporalView({
                container,
                projection: mapped,
                state,
                locale: document.documentElement.lang || navigator.language || "en",
                onNavigate: (href, event) => {
                    // The WebView's window handler opens anchors from composedPath even
                    // when defaultPrevented. Only the light-DOM bridge must reach the host.
                    event.stopPropagation();
                    // Native Markdown's delegated navigation observes the light DOM.
                    const anchor = document.createElement("a");
                    anchor.href = href;
                    anchor.dataset.href = href;
                    anchor.hidden = true;
                    section.append(anchor);
                    const click = new MouseEvent("click", {
                        bubbles: true,
                        cancelable: true,
                        ctrlKey: event.ctrlKey,
                        metaKey: event.metaKey,
                        shiftKey: event.shiftKey,
                        altKey: event.altKey,
                    });
                    // Suppress default navigation if native Markdown did not handle the bridge.
                    anchor.addEventListener(
                        "click",
                        (clickEvent) => {
                            clickEvent.preventDefault();
                        },
                        { once: true },
                    );
                    try {
                        anchor.dispatchEvent(click);
                    } finally {
                        anchor.remove();
                    }
                },
                onReady: () => {
                    const controller = controllers.get(host);
                    if (controller) controller.ready = true;
                    host.dataset.formaTemporalReady = "true";
                    const currentFallback = host
                        .closest("[data-forma-view]")
                        ?.querySelector<HTMLElement>("[data-forma-temporal-fallback]");
                    if (currentFallback) currentFallback.hidden = true;
                },
                onError: () => {
                    host.hidden = true;
                    const controller = controllers.get(host);
                    if (controller) {
                        controller.ready = false;
                        controller.failed = true;
                    }
                    delete host.dataset.formaTemporalReady;
                    const currentFallback = host
                        .closest("[data-forma-view]")
                        ?.querySelector<HTMLElement>("[data-forma-temporal-fallback]");
                    if (currentFallback) currentFallback.hidden = false;
                },
            });
            controllers.set(host, { ...runtime, fingerprint: text, ready: false, failed: false, key });
        }
    };
    const schedule = () => {
        if (stopped || frame) return;
        frame = requestAnimationFrame(reconcile);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const themeObserver = new MutationObserver(schedule);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("vscode.markdown.updateContent", schedule);
    document.addEventListener("vscode.markdown.updateContent", schedule);
    const stop = () => {
        stopped = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        themeObserver.disconnect();
        window.removeEventListener("vscode.markdown.updateContent", schedule);
        document.removeEventListener("vscode.markdown.updateContent", schedule);
        window.removeEventListener("pagehide", stop);
        for (const controller of controllers.values()) controller.destroy();
        controllers.clear();
    };
    window.addEventListener("pagehide", stop, { once: true });
    reconcile();
    return stop;
}
