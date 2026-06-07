export interface WorkspaceLinkEntry {
    path: string;
}

export function isExternalHref(href: string) {
    return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

export function normalizeWorkspaceHref(href: string, currentPath: string, entries: WorkspaceLinkEntry[]) {
    const [pathPart = "", hashPart] = href.split("#", 2);
    const hash = hashPart ? `#${hashPart}` : "";
    const directPath = pathPart.replace(/^\.\//, "").replace(/^\//, "");

    if (entries.some((entry) => entry.path === directPath)) {
        return {
            hash,
            path: directPath,
        };
    }

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

    return {
        hash,
        path: pathSegments.join("/"),
    };
}
