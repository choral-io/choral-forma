import { isExternalHref, normalizeWorkspaceHref } from "@/lib/workspace-links";

interface ReaderLinkEntry {
    path: string;
    routePath: string;
}

export interface ResolvedReaderLink {
    href: string;
    kind: "anchor" | "external" | "internal";
    opensInNewTab: boolean;
}

export function resolveReaderLink(
    href: string,
    currentPath: string,
    entries: ReaderLinkEntry[],
    currentRoutePath?: string,
    linkSource: "workspace" | "published" = "workspace",
): ResolvedReaderLink {
    if (href.startsWith("#")) {
        const currentEntry = entries.find((entry) => entry.path === currentPath);

        return {
            href: currentRoutePath
                ? `${currentRoutePath}${href}`
                : currentEntry
                  ? `${currentEntry.routePath}${href}`
                  : href,
            kind: "anchor",
            opensInNewTab: false,
        };
    }

    if (isExternalWebHref(href)) {
        return {
            href,
            kind: "external",
            opensInNewTab: true,
        };
    }

    if (isExternalHref(href)) {
        return {
            href,
            kind: "external",
            opensInNewTab: false,
        };
    }

    // Static Markdown already contains Core's public routes. A route can also be a
    // different entry's source path (target.md.md -> /target.md), so do not resolve it again.
    if (linkSource === "published" && href.startsWith("/")) {
        return { href, kind: "internal", opensInNewTab: false };
    }

    const targetPath = normalizeWorkspaceHref(href, currentPath, entries);
    const targetEntry = entries.find((entry) => entry.path === targetPath.path);

    return {
        href: targetEntry ? `${targetEntry.routePath}${targetPath.hash}` : href,
        kind: "internal",
        opensInNewTab: false,
    };
}

function isExternalWebHref(href: string) {
    return /^(?:https?:)?\/\//iu.test(href);
}
