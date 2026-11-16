import { isExternalHref, normalizeWorkspacePath, splitWorkspaceUri } from "@/lib/workspace-links";
import { directoryRoutePath } from "@/lib/workspace-routes";

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

    const { path, query, hash } = splitWorkspaceUri(href);
    if (path === "" && currentRoutePath) {
        return { href: `${currentRoutePath}${query}${hash}`, kind: "internal", opensInNewTab: false };
    }
    const targets = linkTargets(entries);
    const targetPath = path === "" ? currentPath : normalizeWorkspacePath(path, currentPath, targets);
    const routePath = directoryRoutePath(targetPath);
    const targetEntry =
        targets.find((entry) => entry.path === targetPath) ?? targets.find((entry) => entry.routePath === routePath);

    return {
        href: targetEntry ? `${targetEntry.routePath}${query}${hash}` : href,
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
