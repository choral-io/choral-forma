export interface WorkspaceLinkDocument {
    path: string;
}

export function isExternalHref(href: string) {
    return /^[a-z][a-z0-9+.-]*:/i.test(href);
}

export function normalizeWorkspaceHref(href: string, currentPath: string, documents: WorkspaceLinkDocument[]) {
    const [pathPart = "", hashPart] = href.split("#", 2);
    const hash = hashPart ? `#${hashPart}` : "";
    const directPath = pathPart.replace(/^\.\//, "").replace(/^\//, "");

    if (documents.some((document) => document.path === directPath)) {
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
