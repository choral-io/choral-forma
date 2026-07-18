import { createHash } from "node:crypto";

import { normalizeDisplayColor } from "@choral-forma/shared";

const bundledStrokePattern = /(<svg\b[^>]*\bstroke=")(?:#424242|#C5C5C5)(")/u;

export function colorizeBundledLucideSvg(source: string, requestedColor: string): string {
    const color = normalizeDisplayColor(requestedColor);
    if (!color) throw new Error(`Invalid Forma display color: ${requestedColor}`);
    if (!bundledStrokePattern.test(source)) throw new Error("Bundled Lucide SVG has an unexpected root stroke.");
    return source.replace(bundledStrokePattern, `$1${color}$2`);
}

export function presentationIconCacheName(icon: string, color: string): string {
    const digest = createHash("sha256").update(`v1\0${icon}\0${color}`).digest("hex");
    return `${digest}.svg`;
}

export function configuredIconColor(requestedColor: string | undefined, highContrast: boolean): string | undefined {
    return highContrast ? undefined : normalizeDisplayColor(requestedColor);
}
