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

/** Split URI delimiters before decoding the workspace filename once. */
export function splitWorkspaceUri(href: string) {
    const hashIndex = href.indexOf("#");
    const withoutHash = hashIndex < 0 ? href : href.slice(0, hashIndex);
    const hash = hashIndex < 0 ? "" : href.slice(hashIndex);
    const queryIndex = withoutHash.indexOf("?");
    const rawPath = queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex);
    const query = queryIndex < 0 ? "" : withoutHash.slice(queryIndex);
    let invalidPath = false;
    const path = rawPath
        .split("/")
        .map((segment) => {
            try {
                const decoded = decodeURIComponent(segment);
                if (
                    decoded.includes("/") ||
                    decoded.includes("\\") ||
                    (decoded !== segment && /^\.{1,2}$/u.test(decoded))
                ) {
                    invalidPath = true;
                }
                return decoded;
            } catch {
                // Preserve malformed percent escapes as authored filename characters.
                return segment;
            }
        })
        .join("/");
    return { path, query, hash, invalidPath };
}

/** Resolve an already parsed path without interpreting filename characters as URI syntax. */
export function normalizeWorkspacePath(pathPart: string, currentPath: string, entries: WorkspaceLinkEntry[]) {
    const relativePath = normalizeRelativeWorkspacePath(pathPart, currentPath) ?? "";
    if (pathPart.startsWith("/")) return relativePath;
    if (entries.some((entry) => entry.path === relativePath)) {
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

/** Normalize lexical segments, with source references bounded by the workspace. */
export function normalizeRelativeWorkspacePath(pathPart: string, currentPath: string, strictSource = false) {
    const rooted = pathPart.startsWith("/");
    const pathSegments = rooted ? [] : currentPath.split("/").slice(0, -1);

    for (const segment of pathPart.split("/")) {
        if (!segment || segment === ".") {
            continue;
        }

        if (segment === "..") {
            if (strictSource && (rooted || !pathSegments.length)) return undefined;
            pathSegments.pop();
            continue;
        }

        pathSegments.push(segment);
    }

    return pathSegments.join("/");
}
