export interface WorkspaceLinkEntry {
    path: string;
}

export function isExternalHref(href: string) {
    return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

export function normalizeWorkspaceHref(href: string, currentPath: string, entries: WorkspaceLinkEntry[]) {
    const [pathPart = "", hashPart] = href.split("#", 2);
    const hash = hashPart ? `#${hashPart}` : "";
    return { hash, path: normalizeWorkspacePath(pathPart, currentPath, entries) };
}

/** Resolve an already parsed path without interpreting filename characters as URI syntax. */
export function normalizeWorkspacePath(pathPart: string, currentPath: string, entries: WorkspaceLinkEntry[]) {
    const relativePath = resolvePathSegments(pathPart, currentPath);
    if (pathPart.startsWith("/")) return relativePath;
    if (
        (pathPart.startsWith("./") || pathPart.startsWith("../")) &&
        entries.some((entry) => entry.path === relativePath)
    ) {
        return relativePath;
    }

    // Generated wiki links can use `./` followed by a workspace-wide source path.
    const directPath = pathPart.replace(/^\.\//, "");

    if (entries.some((entry) => entry.path === directPath)) {
        return directPath;
    }

    if (!directPath.includes("/")) {
        const basenameMatches = entries.filter((entry) => entry.path.split("/").at(-1) === directPath);
        const [basenameMatch] = basenameMatches;
        if (basenameMatch && basenameMatches.length === 1) {
            return basenameMatch.path;
        }
    }

    return relativePath;
}

function resolvePathSegments(pathPart: string, currentPath: string) {
    const pathSegments = pathPart.startsWith("/") ? [] : currentPath.split("/").slice(0, -1);

    for (const segment of pathPart.split("/")) {
        if (!segment || segment === ".") {
            continue;
        }

        if (segment === "..") {
            pathSegments.pop();
            continue;
        }

        pathSegments.push(segment);
    }

    return pathSegments.join("/");
}
