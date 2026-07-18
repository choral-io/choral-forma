import type { GraphTheme } from "./types.ts";

export type GraphThemeTokens = {
    background: string;
    surface: string;
    border: string;
    foreground: string;
    mutedForeground: string;
    primary: string;
    accent: string;
    focusRing: string;
};

export function createGraphThemeFromTokens(tokens: GraphThemeTokens): GraphTheme {
    return {
        background: tokens.background,
        surface: tokens.surface,
        border: opaqueGraphColor(tokens.background, tokens.border),
        node: mixGraphColors(tokens.background, tokens.mutedForeground, 0.72),
        nodeSelected: opaqueGraphColor(tokens.background, tokens.primary),
        nodeNeighbor: opaqueGraphColor(tokens.background, tokens.accent),
        nodeMuted: mixGraphColors(tokens.background, tokens.mutedForeground, 0.28),
        edge: mixGraphColors(tokens.background, tokens.mutedForeground, 0.42),
        edgeSelected: opaqueGraphColor(tokens.background, tokens.primary),
        edgeMuted: mixGraphColors(tokens.background, tokens.mutedForeground, 0.18),
        label: opaqueGraphColor(tokens.background, tokens.foreground),
        labelMuted: opaqueGraphColor(tokens.background, tokens.mutedForeground),
        focusRing: opaqueGraphColor(tokens.background, tokens.focusRing),
    };
}

export function mixGraphColors(background: string, foreground: string, amount: number): string {
    const backgroundColor = parseGraphColor(background);
    const foregroundColor = parseGraphColor(foreground);
    if (!backgroundColor || !foregroundColor) return foreground;
    const opaqueBackground = compositeGraphColor(backgroundColor, { red: 255, green: 255, blue: 255, alpha: 1 });
    const opaqueForeground = compositeGraphColor(foregroundColor, opaqueBackground);
    const weight = clamp(amount, 0, 1);
    return rgbColor(
        opaqueBackground.red + (opaqueForeground.red - opaqueBackground.red) * weight,
        opaqueBackground.green + (opaqueForeground.green - opaqueBackground.green) * weight,
        opaqueBackground.blue + (opaqueForeground.blue - opaqueBackground.blue) * weight,
    );
}

export function opaqueGraphColor(background: string, foreground: string): string {
    const backgroundColor = parseGraphColor(background);
    const foregroundColor = parseGraphColor(foreground);
    if (!backgroundColor || !foregroundColor) return foreground;
    const opaqueBackground = compositeGraphColor(backgroundColor, { red: 255, green: 255, blue: 255, alpha: 1 });
    const result = compositeGraphColor(foregroundColor, opaqueBackground);
    return rgbColor(result.red, result.green, result.blue);
}

type GraphColor = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};

function parseGraphColor(value: string): GraphColor | undefined {
    const hex = /^#([0-9a-f]{6})$/i.exec(value);
    if (hex?.[1]) {
        const packed = Number.parseInt(hex[1], 16);
        return {
            red: (packed >> 16) & 0xff,
            green: (packed >> 8) & 0xff,
            blue: packed & 0xff,
            alpha: 1,
        };
    }
    const functional = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(value);
    if (!functional) return undefined;
    const [, red, green, blue, alpha] = functional;
    const channels = [red, green, blue].map(Number);
    if (channels.some((channel) => !Number.isFinite(channel))) return undefined;
    const parsedAlpha = alpha === undefined ? 1 : Number(alpha);
    if (!Number.isFinite(parsedAlpha)) return undefined;
    return {
        red: clamp(channels[0] ?? 0, 0, 255),
        green: clamp(channels[1] ?? 0, 0, 255),
        blue: clamp(channels[2] ?? 0, 0, 255),
        alpha: clamp(parsedAlpha, 0, 1),
    };
}

function compositeGraphColor(foreground: GraphColor, background: GraphColor): GraphColor {
    const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
    if (alpha <= 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
    return {
        red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
        green:
            (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) /
            alpha,
        blue:
            (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
        alpha,
    };
}

function rgbColor(red: number, green: number, blue: number): string {
    return `rgb(${String(Math.round(red))}, ${String(Math.round(green))}, ${String(Math.round(blue))})`;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}
