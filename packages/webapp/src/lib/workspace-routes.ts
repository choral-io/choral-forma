/**
 * The public URL layout Core defines. Content owns the root namespace: a page or a directory is
 * served at its workspace path, and the workspace root is `/`. Everything Forma adds lives under
 * the reserved segment `-`, so no configured name shadows a system page.
 */
export const systemRouteSegment = "-";
export const browseRoutePath = "/-/browse";
export const viewsRoutePath = "/-/views";
export const healthRoutePath = "/-/health";
export const rawRoutePrefix = "/-/raw";
export const rpcEndpointPath = "/-/rpc";

/** Whether a route is inside the reserved segment rather than the content namespace. */
export function isSystemRoutePath(routePath: string) {
    return routePath === `/${systemRouteSegment}` || routePath.startsWith(`/${systemRouteSegment}/`);
}

/**
 * A View's route, as Core defines it: its public id, the last segment of its path id, below
 * `/-/views`. A local server names a View by its full path id and a static artifact by its
 * public id; both resolve to the same route, so a View link works on either.
 */
export function viewRoutePath(viewId: string) {
    return `${viewsRoutePath}/${encodeRouteSegment(viewId.split("/").at(-1) ?? viewId)}`;
}

/**
 * A directory's page; the empty path is the workspace root, home. Segments are encoded the way
 * Core encodes page routes, so a directory and a document served at its route, such as its
 * `index` file, compare equal.
 */
export function directoryRoutePath(path: string) {
    const segments = path.split("/").filter((segment) => segment.length > 0);
    return `/${segments.map(encodeRouteSegment).join("/")}`;
}

/** The directory path a content route names, or undefined for a system route. */
export function directoryPathFromRoutePath(routePath: string): string | undefined {
    if (!routePath.startsWith("/") || isSystemRoutePath(routePath)) return undefined;
    try {
        return routePath
            .slice(1)
            .split("/")
            .filter((segment) => segment.length > 0)
            .map((segment) => decodeURIComponent(segment))
            .join("/");
    } catch {
        return undefined;
    }
}

/**
 * The directory a content route names when no document is served there: a path below the root
 * that holds at least one indexed document. Returns undefined for any other route, including
 * the root itself, whose page is home.
 */
export function directoryForRoutePath(entries: readonly { path: string }[], routePath: string) {
    const directory = directoryPathFromRoutePath(routePath);
    if (!directory) return undefined;
    return entries.some((entry) => entry.path.startsWith(`${directory}/`)) ? directory : undefined;
}

/** Core keeps ASCII letters, digits, and `-._~`; `encodeURIComponent` also keeps `!'()*`. */
export function encodeRouteSegment(segment: string) {
    return encodeURIComponent(segment).replace(
        /[!'()*]/gu,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

export function taxonomyRoutePath(taxonomyId: string) {
    return `${browseRoutePath}/${encodeRouteSegment(taxonomyId)}`;
}

export function taxonomyTermRoutePath(taxonomyId: string, termId: string) {
    return `${taxonomyRoutePath(taxonomyId)}/${encodeRouteSegment(termId)}`;
}
