import { Buffer } from "node:buffer";

import { normalizeDisplayColor } from "@choral-forma/shared";

const bundledStrokePattern = /(<svg\b[^>]*\bstroke=")(?:#424242|#C5C5C5)(")/u;

export function colorizeBundledLucideSvg(source: string, requestedColor: string): string {
    const color = normalizeDisplayColor(requestedColor);
    if (!color) throw new Error(`Invalid Forma display color: ${requestedColor}`);
    if (!bundledStrokePattern.test(source)) throw new Error("Bundled Lucide SVG has an unexpected root stroke.");
    return source.replace(bundledStrokePattern, `$1${color}$2`);
}

export function configuredIconColor(requestedColor: string | undefined, highContrast: boolean): string | undefined {
    return highContrast ? undefined : normalizeDisplayColor(requestedColor);
}

export function uniformThemeIconPath<T>(uri: T): { light: T; dark: T } {
    return { light: uri, dark: uri };
}

export function svgDataUri(source: string): string {
    return `data:image/svg+xml;base64,${Buffer.from(source, "utf8").toString("base64")}`;
}
