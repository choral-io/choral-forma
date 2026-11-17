import { isExternalHref, normalizeRelativeWorkspacePath, splitWorkspaceUri } from "@/lib/workspace-links";

export interface ReaderLinkTarget {
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
    directories: readonly ReaderLinkTarget[] = [],
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
    if (linkSource === "published" && !href.startsWith("?")) {
        return { href, kind: "internal", opensInNewTab: false };
    }

    const { path, query, hash, invalidPath } = splitWorkspaceUri(href);
    if (invalidPath) return { href, kind: "internal", opensInNewTab: false };
    if (path === "" && currentRoutePath) {
        return { href: `${currentRoutePath}${query}${hash}`, kind: "internal", opensInNewTab: false };
    }
    const targetEntry = resolveAuthorDocument(path, currentPath, linkTargets(entries), directories);

    return {
        href: targetEntry ? `${targetEntry.routePath}${query}${hash}` : href,
        kind: "internal",
        opensInNewTab: false,
    };
}

// Keep the browser's managed source-path lookup in step with Core's
// PathIndex::resolve_author_document. Suffix lookup removes one leading
// workspace segment. Only a bare name may then use the basename tier.
function resolveAuthorDocument(
    path: string,
    sourcePath: string,
    targets: readonly ReaderLinkTarget[],
    directories: readonly ReaderLinkTarget[],
) {
    const relative = path === "" ? sourcePath : normalizeRelativeWorkspacePath(path, sourcePath, true);
    if (!relative) return undefined;
    const directory = directories.find((entry) => entry.path === relative);
    if (path.endsWith("/") && directory) return directory;

    const rooted = path.startsWith("/");
    const direct = path.replace(/^(?:\.\/)+/u, "");
    const paths = new Map(targets.map((target) => [target.path, target]));
    const lookup = rooted || direct === relative ? [relative] : [relative, direct];
    for (const name of lookup) {
        for (const candidate of authorDocumentCandidates(name, true)) {
            const entry = paths.get(candidate);
            if (entry) return entry;
        }
    }
    if (rooted) return directory;

    const shortPaths =
        relative !== direct && (path.startsWith("./") || path.startsWith("../")) ? [relative, direct] : [direct];
    const entries = [...paths.values()];
    for (const name of shortPaths) {
        const matches = shortAuthorMatches(name, entries);
        if (matches.length) return matches.length === 1 ? matches[0] : undefined;
    }
    return directory;
}

function shortAuthorMatches(path: string, targets: readonly ReaderLinkTarget[]) {
    const candidates = new Set(authorDocumentCandidates(path, false));
    const shortMatches = targets.filter((entry) => {
        const separator = entry.path.indexOf("/");
        return separator >= 0 && candidates.has(entry.path.slice(separator + 1));
    });
    return shortMatches.length || path.includes("/")
        ? shortMatches
        : targets.filter((entry) => candidates.has(entry.path.split("/").at(-1) ?? ""));
}

function authorDocumentCandidates(path: string, directoryIntro: boolean) {
    const candidates = [path];
    if (!/\.(?:md|mdx)$/iu.test(path)) {
        candidates.push(`${path}.md`, `${path}.mdx`);
        if (directoryIntro) candidates.push(`${path}/index.md`, `${path}/index.mdx`);
    }
    return candidates;
}

function linkTargets(entries: ReaderLinkEntry[]) {
    return entries.flatMap((entry) => (entry.variants?.length ? [entry, ...entry.variants] : entry));
}

function isExternalWebHref(href: string) {
    return /^(?:https?:)?\/\//iu.test(href);
}
