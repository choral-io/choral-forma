import "./graph-preview.ts";
import { startStickyPreview } from "./sticky-preview.ts";

if (typeof document !== "undefined" && typeof MutationObserver !== "undefined") {
    if (document.readyState === "loading")
        document.addEventListener("DOMContentLoaded", startStickyPreview, { once: true });
    else startStickyPreview();
}
