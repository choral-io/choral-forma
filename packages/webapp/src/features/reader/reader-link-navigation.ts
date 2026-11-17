import { isStaticRawHref, logicalHref } from "@/data/static-runtime";

export interface ReaderLinkNavigation {
    href: string;
    samePageFragment: boolean;
}

export function updateReaderFragmentHrefs(reader: HTMLElement, pathname: string, search: string) {
    // Fragment-only links inherit the document query even when a deployment
    // base requires their href to name the document path explicitly.
    for (const anchor of reader.querySelectorAll<HTMLAnchorElement>('a[data-link-kind="anchor"][href]')) {
        const href = anchor.getAttribute("href") ?? "";
        const fragmentIndex = href.indexOf("#");
        if (fragmentIndex < 0) continue;
        const path = href.slice(0, fragmentIndex).replace(/\?.*/su, "");
        const destination = `${path === "" ? pathname : path}${search}${href.slice(fragmentIndex)}`;
        if (href !== destination) anchor.setAttribute("href", destination);
    }
}

export function resolveReaderLinkNavigation(
    anchor: HTMLAnchorElement,
    currentHref = window.location.href,
): ReaderLinkNavigation | undefined {
    if (
        anchor.dataset.linkKind === "external" ||
        anchor.target ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("rel")?.split(/\s+/u).includes("external")
    ) {
        return undefined;
    }

    const href = anchor.getAttribute("href");
    if (!href?.startsWith("/")) {
        return undefined;
    }

    const current = new URL(currentHref);
    const destination = new URL(href, current);
    if (destination.origin !== current.origin || isStaticRawHref(destination.pathname)) {
        return undefined;
    }
    const destinationPath = logicalHref(destination.pathname);
    const currentPath = logicalHref(current.pathname);
    const samePath = destinationPath.replace(/\/$/u, "") === currentPath.replace(/\/$/u, "");
    const hasFragment = destination.hash.length > 0;
    const sameQuery = destination.search === current.search;
    // A query transition with a fragment still belongs to the current reader, even when
    // the static host serves a trailing slash and the generated link uses a canonical path.
    const routerPath = samePath && hasFragment && !sameQuery ? currentPath : destinationPath;
    return {
        href: `${routerPath}${destination.search}${destination.hash}`,
        samePageFragment: samePath && sameQuery && hasFragment,
    };
}
