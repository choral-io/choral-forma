export function viewRoutePath(viewId: string) {
    return `/views/${viewId
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;
}

/** The workspace root's directory page. Directories share the page namespace with the documents in them. */
export const pagesRootRoutePath = "/pages";

/**
 * A directory's page; the empty path is the workspace root. Segments are encoded the way
 * Core encodes page routes, so a directory and a document served at its route, such as its
 * `index` file, compare equal.
 */
export function directoryRoutePath(path: string) {
    const segments = path.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) return pagesRootRoutePath;
    return `${pagesRootRoutePath}/${segments.map(encodePageRouteSegment).join("/")}`;
}

/** The directory path a page route names, or undefined for a route outside `/pages`. */
export function directoryPathFromRoutePath(routePath: string): string | undefined {
    if (routePath === pagesRootRoutePath) return "";
    if (!routePath.startsWith(`${pagesRootRoutePath}/`)) return undefined;
    try {
        return routePath
            .slice(pagesRootRoutePath.length + 1)
            .split("/")
            .filter((segment) => segment.length > 0)
            .map((segment) => decodeURIComponent(segment))
            .join("/");
    } catch {
        return undefined;
    }
}

/** Core keeps ASCII letters, digits, and `-._~`; `encodeURIComponent` also keeps `!'()*`. */
function encodePageRouteSegment(segment: string) {
    return encodeURIComponent(segment).replace(
        /[!'()*]/gu,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

export function taxonomyRoutePath(taxonomyId: string) {
    return `/${encodeURIComponent(taxonomyId)}`;
}

export function taxonomyTermRoutePath(taxonomyId: string, termId: string) {
    return `${taxonomyRoutePath(taxonomyId)}/${encodeURIComponent(termId)}`;
}

export function legacyWorkspaceRouteRedirect(pathname: string) {
    return pathname.replace(/\/+$/u, "") === "/taxonomies" ? "/browse" : undefined;
}
