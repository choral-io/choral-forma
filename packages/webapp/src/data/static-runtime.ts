declare global {
    var __FORMA_STATIC_WORKSPACE__:
        | {
              dataBaseUrl: string;
              homeEntryId?: string;
              rootPath: string;
          }
        | undefined;
}

export function readStaticRuntimeConfig() {
    return globalThis.__FORMA_STATIC_WORKSPACE__;
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
