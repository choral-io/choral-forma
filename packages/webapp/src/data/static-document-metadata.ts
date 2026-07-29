import { taxonomyRoutePath, taxonomyTermRoutePath, viewRoutePath } from "@/lib/workspace-routes";
import { canonicalRoutePathFromLocation, resolveDashboardEntryTarget } from "./static-route-target";
import { logicalPathname, readStaticRuntimeConfig, rootAwareHref } from "./static-runtime";
import type { WorkspaceDashboard } from "./workspace-client";

export interface StaticDocumentMetadata {
    canonicalPath: string;
    description: string;
    title: string;
}

export function resolveStaticDocumentMetadata(dashboard: WorkspaceDashboard, pathname: string): StaticDocumentMetadata {
    const canonicalPath = logicalPathname(pathname);
    const entry = resolveDashboardEntryTarget(dashboard, canonicalRoutePathFromLocation(pathname))?.summary;
    if (entry) {
        return {
            canonicalPath,
            description: entry.summary || "Published workspace entry.",
            title: entry.title || entry.path,
        };
    }

    if (canonicalPath === "/pages") {
        return { canonicalPath, description: "Published workspace entries.", title: "Pages" };
    }
    if (canonicalPath === "/views") {
        return { canonicalPath, description: "Configured workspace projections.", title: "Views" };
    }
    if (canonicalPath === "/browse") {
        return {
            canonicalPath,
            description: "Browse configured workspace taxonomies.",
            title: "Browse",
        };
    }

    const view = dashboard.views.find((candidate) => viewRoutePath(candidate.id) === canonicalPath);
    if (view) {
        return {
            canonicalPath,
            description: `${view.kind} workspace View.`,
            title: view.title || view.id,
        };
    }

    for (const taxonomy of dashboard.taxonomies) {
        if (taxonomyRoutePath(taxonomy.id) === canonicalPath) {
            return {
                canonicalPath,
                description: taxonomy.description || "Configured workspace taxonomy.",
                title: taxonomy.title,
            };
        }
        const term = taxonomy.terms.find(
            (candidate) => taxonomyTermRoutePath(taxonomy.id, candidate.id) === canonicalPath,
        );
        if (term) {
            return {
                canonicalPath,
                description: term.description || `Entries classified as ${term.title}.`,
                title: term.title,
            };
        }
    }

    return {
        canonicalPath,
        description: "The requested static workspace route was not found.",
        title: "Not found",
    };
}

export function syncStaticDocumentMetadata(dashboard: WorkspaceDashboard, pathname: string) {
    const config = readStaticRuntimeConfig();
    if (!config) return;
    const metadata = resolveStaticDocumentMetadata(dashboard, pathname);
    const documentTitle =
        metadata.title === dashboard.workspaceName ? metadata.title : `${metadata.title} · ${dashboard.workspaceName}`;
    document.title = documentTitle;
    setMetaContent('meta[name="description"]', metadata.description);
    setMetaContent('meta[property="og:title"]', documentTitle);
    setMetaContent('meta[property="og:description"]', metadata.description);
    setMetaContent('meta[name="twitter:title"]', documentTitle);
    setMetaContent('meta[name="twitter:description"]', metadata.description);

    const canonical = `${config.baseUrl}${rootAwareHref(metadata.canonicalPath)}`;
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonical);
    setMetaContent('meta[property="og:url"]', canonical);
}

function setMetaContent(selector: string, value: string) {
    document.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
}
