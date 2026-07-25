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

export function resolveReaderLink(href: string, currentPath: string, entries: ReaderLinkEntry[]): ResolvedReaderLink {
    if (href.startsWith("#")) {
        const currentEntry = entries.find((entry) => entry.path === currentPath);

        return {
            href: currentEntry ? `${currentEntry.routePath}${href}` : href,
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
