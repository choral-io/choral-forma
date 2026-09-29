export type PreviewFeature = {
    selector: string;
    load(): Promise<() => () => void>;
};

/** Only detection remains active while native Markdown contains no Forma views. */
export function startPreviewBootstrap(features: readonly PreviewFeature[]): () => void {
    const entries = features.map((feature) => ({
        ...feature,
        stop: undefined as (() => void) | undefined,
        pending: false,
    }));
    const selector = features.map((feature) => feature.selector).join(",");
    let stopped = false;
    let frame = 0;
    const reconcile = () => {
        frame = 0;
        if (stopped) return;
        for (const entry of entries) {
            if (!document.querySelector(entry.selector)) {
                entry.stop?.();
                entry.stop = undefined;
            } else if (!entry.stop && !entry.pending) {
                entry.pending = true;
                void entry
                    .load()
                    .then((start) => {
                        if (!stopped && document.querySelector(entry.selector)) entry.stop = start();
                    })
                    .catch(() => {
                        // Leave the semantic Markdown fallback usable if enhancement fails.
                    })
                    .finally(() => {
                        entry.pending = false;
                    });
            }
        }
    };
    const schedule = () => {
        if (!stopped && !frame) frame = requestAnimationFrame(reconcile);
    };
    const includesMarker = (node: Node) =>
        node instanceof Element && (node.matches(selector) || Boolean(node.querySelector(selector)));
    const observer = new MutationObserver((records) => {
        if (records.some((record) => [...record.addedNodes, ...record.removedNodes].some(includesMarker))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("vscode.markdown.updateContent", schedule);
    document.addEventListener("vscode.markdown.updateContent", schedule);
    const stop = () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener("vscode.markdown.updateContent", schedule);
        document.removeEventListener("vscode.markdown.updateContent", schedule);
        window.removeEventListener("pagehide", stop);
        for (const entry of entries) entry.stop?.();
    };
    window.addEventListener("pagehide", stop, { once: true });
    reconcile();
    return stop;
}
