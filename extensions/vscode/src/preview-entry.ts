import { startPreviewBootstrap } from "./preview-bootstrap.ts";

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    const start = () => {
        // esbuild's classic IIFE keeps these imports in one contributed resource.
        // Module initialization is deferred; transfer and parsing are still global.
        startPreviewBootstrap([
            {
                selector: "[data-forma-graph-host]",
                load: async () => (await import("./graph-preview.ts")).startGraphPreview,
            },
            {
                selector: "[data-forma-sticky-boundary]",
                load: async () => (await import("./sticky-preview.ts")).startStickyPreview,
            },
            {
                selector: "[data-forma-temporal-host]",
                load: async () => (await import("./temporal-preview.ts")).startTemporalPreview,
            },
        ]);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
}
