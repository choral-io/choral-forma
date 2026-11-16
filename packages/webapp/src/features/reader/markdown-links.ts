import { isExternalHref, normalizeWorkspacePath } from "@/lib/workspace-links";

interface ReaderLinkTarget {
    path: string;
    routePath: string;
}

interface ReaderLinkEntry extends ReaderLinkTarget {
    variants?: readonly ReaderLinkTarget[];
}

export type MarkdownLinkSource = "workspace" | "published";

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
    linkSource: MarkdownLinkSource = "workspace",
): ResolvedReaderLink {
    if (href.startsWith("#")) {
        const currentEntry = currentRoutePath
            ? undefined
            : linkTargets(entries).find((entry) => entry.path === currentPath);

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

    const hashIndex = href.indexOf("#");
    const withoutHash = hashIndex < 0 ? href : href.slice(0, hashIndex);
    const hash = hashIndex < 0 ? "" : href.slice(hashIndex);
    const queryIndex = withoutHash.indexOf("?");
    const rawPath = queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex);
    const query = queryIndex < 0 ? "" : withoutHash.slice(queryIndex);
    let decodedPath = rawPath;
    try {
        decodedPath = decodeURIComponent(rawPath);
    } catch {
        // Preserve malformed percent escapes as authored filename characters.
    }
    const targets = linkTargets(entries);
    const targetPath = rawPath === "" ? currentPath : normalizeWorkspacePath(decodedPath, currentPath, targets);
    const targetEntry = targets.find((entry) => entry.path === targetPath);

    return {
        href: targetEntry
            ? `${rawPath === "" && currentRoutePath ? currentRoutePath : targetEntry.routePath}${query}${hash}`
            : href,
        kind: "internal",
        opensInNewTab: false,
    };
}

function linkTargets(entries: ReaderLinkEntry[]) {
    return entries.flatMap((entry) => (entry.variants?.length ? [entry, ...entry.variants] : entry));
}

function isExternalWebHref(href: string) {
    return /^(?:https?:)?\/\//iu.test(href);
}
