import { rawRoutePrefix } from "@/lib/workspace-routes";

export interface StaticRuntimeConfig {
    baseUrl: string;
    dataBaseUrl: string;
    rootPath: string;
}

export const staticRuntimeConfigSelector = 'script[type="application/json"][data-forma-static-workspace]';

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
    const element =
        document.head.querySelector(staticRuntimeConfigSelector) ??
        document.head.querySelector('script[type="application/json"]#forma-static-workspace');
    if (!element) return undefined;
    return parseStaticRuntimeConfig(element.textContent);
}

export function readStaticRuntimeConfig() {
    return readStaticRuntimeConfigDocument();
}

/**
 * The deployment root the app is served under, such as `/forma`, or `/` at the origin root. A
 * static artifact states it in its runtime configuration; `forma serve --root-path` states it in
 * the `<base href>` it injects into the app's index. Every app-relative href is resolved below it.
 */
export function staticRouterBasename() {
    return readStaticRuntimeConfig()?.rootPath ?? readBaseElementRootPath() ?? "/";
}

function readBaseElementRootPath() {
    if (typeof document === "undefined") return undefined;
    const href = document.querySelector("base[href]")?.getAttribute("href");
    if (!href?.startsWith("/") || href.startsWith("//")) return undefined;
    return trimRoutePathname(href);
}

/** Convert an app-relative href to a public href under the deployment root. */
export function rootAwareHref(href: string) {
    const rootPath = staticRouterBasename();
    if (rootPath === "/" || !href.startsWith("/") || href.startsWith("//")) return href;
    return `${rootPath}${href}`;
}

export function logicalHref(href: string) {
    const rootPath = staticRouterBasename();
    if (rootPath === "/" || (href !== rootPath && !href.startsWith(`${rootPath}/`))) return href;
    const logical = href.slice(rootPath.length);
    return logical === "" ? "/" : logical;
}

export function logicalPathname(pathname: string) {
    return trimRoutePathname(logicalHref(pathname));
}

export function trimRoutePathname(pathname: string) {
    return pathname.replace(/\/+$/, "") || "/";
}

export function isStaticRawHref(href: string) {
    const logical = logicalHref(href);
    return logical === rawRoutePrefix || logical.startsWith(`${rawRoutePrefix}/`);
}
