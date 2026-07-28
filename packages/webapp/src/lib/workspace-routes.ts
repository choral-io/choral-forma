export function viewRoutePath(viewId: string) {
    return `/views/${viewId
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;
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
