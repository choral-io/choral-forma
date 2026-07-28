export interface StaticRuntimeConfig {
    baseUrl: string;
    dataBaseUrl: string;
    rootPath: string;
}

export const staticRuntimeConfigId = "forma-static-workspace";

function isStaticRuntimeConfig(value: unknown): value is StaticRuntimeConfig {
    if (typeof value !== "object" || value === null) return false;
    const config = value as Record<string, unknown>;
    return (
        typeof config.baseUrl === "string" &&
        typeof config.dataBaseUrl === "string" &&
        typeof config.rootPath === "string"
    );
}

export function parseStaticRuntimeConfig(value: string): StaticRuntimeConfig | undefined {
    try {
        const parsed: unknown = JSON.parse(value);
        return isStaticRuntimeConfig(parsed) ? parsed : undefined;
    } catch {
        return undefined;
    }
}

function readStaticRuntimeConfigDocument(): StaticRuntimeConfig | undefined {
    if (typeof document === "undefined") return undefined;
    const element = document.getElementById(staticRuntimeConfigId);
    if (!(element instanceof HTMLScriptElement) || element.type !== "application/json") return undefined;
    return parseStaticRuntimeConfig(element.textContent);
}

export function readStaticRuntimeConfig() {
    return readStaticRuntimeConfigDocument();
}

export function staticRouterBasename() {
    return readStaticRuntimeConfig()?.rootPath ?? "/";
}

export function rootAwareHref(href: string) {
    const rootPath = staticRouterBasename();
    if (rootPath === "/" || !href.startsWith("/") || href === rootPath || href.startsWith(`${rootPath}/`)) {
        return href;
    }
    return href === "/" ? `${rootPath}/` : `${rootPath}${href}`;
}

export function logicalHref(href: string) {
    const rootPath = staticRouterBasename();
    if (rootPath === "/" || (href !== rootPath && !href.startsWith(`${rootPath}/`))) return href;
    const logical = href.slice(rootPath.length);
    return logical === "" ? "/" : logical;
}

export function logicalPathname(pathname: string) {
    return logicalHref(pathname).replace(/\/+$/, "") || "/";
}

export function isStaticRawHref(href: string) {
    const logical = logicalHref(href);
    return logical === "/raw" || logical.startsWith("/raw/");
}
