/**
 * The public URL layout Core defines. Content owns the root namespace: a page or a directory is
 * served at its exact workspace path. Logical organization and system capabilities own their
 * respective first segments, leaving the workspace root as `/`.
 */
export const systemRouteSegment = "-";
export const taxonomyRouteSegment = "~";
export const browseRoutePath = "/~";
export const viewsRoutePath = "/-/views";
export const healthRoutePath = "/-/health";
export const rawRoutePrefix = "/-/raw";
export const rpcEndpointPath = "/-/rpc";

/** Whether a route is inside the reserved segment rather than the content namespace. */
export function isSystemRoutePath(routePath: string) {
    return [systemRouteSegment, taxonomyRouteSegment].some(
        (segment) => routePath === `/${segment}` || routePath.startsWith(`/${segment}/`),
    );
}

/** Core keeps ASCII letters, digits, and `-._~`; `encodeURIComponent` also keeps `!'()*`. */
export function encodeRouteSegment(segment: string) {
    return encodeURIComponent(segment).replace(
        /[!'()*]/gu,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}
