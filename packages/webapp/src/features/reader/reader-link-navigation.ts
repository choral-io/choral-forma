import { isStaticRawHref, logicalHref } from "@/data/static-runtime";

export interface ReaderLinkNavigation {
    href: string;
    samePageFragment: boolean;
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
    if (isStaticRawHref(destination.pathname)) {
        return undefined;
    }
    const destinationPath = logicalHref(destination.pathname);
    return {
        href: `${destinationPath}${destination.search}${destination.hash}`,
        samePageFragment:
            destinationPath.replace(/\/$/u, "") === logicalHref(current.pathname).replace(/\/$/u, "") &&
            destination.search === current.search &&
            destination.hash.length > 0,
    };
}
