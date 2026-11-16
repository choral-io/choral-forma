import {
    browseRoutePath,
    directoryForRoutePath,
    healthRoutePath,
    taxonomyRoutePath,
    taxonomyTermRoutePath,
    viewRoutePath,
    viewsRoutePath,
} from "@/lib/workspace-routes";

import { canonicalRoutePath, resolveDashboardEntryTarget } from "./static-route-target";
import { readStaticRuntimeConfig, rootAwareHref, trimRoutePathname } from "./static-runtime";
import type { WorkspaceDashboard } from "./workspace-client";

export interface StaticDocumentMetadata {
    canonicalPath: string;
    description: string;
    title: string;
}

export function resolveStaticDocumentMetadata(dashboard: WorkspaceDashboard, pathname: string): StaticDocumentMetadata {
    const canonicalPath = trimRoutePathname(pathname);
    const normalizedPath = canonicalRoutePath(pathname);
    const entry = resolveDashboardEntryTarget(dashboard, normalizedPath)?.summary;
    if (entry) {
        return {
            canonicalPath,
            description: entry.summary || "Published workspace entry.",
            title: entry.title || entry.path,
        };
    }

    const directory = directoryForRoutePath(dashboard.entries, canonicalPath);
    if (directory) {
        return {
            canonicalPath,
            description: `Pages the workspace includes under ${directory}/.`,
            title: directory.split("/").at(-1) ?? directory,
        };
    }
    if (canonicalPath === healthRoutePath) {
        return { canonicalPath, description: "Workspace health findings.", title: "Health" };
    }
    if (canonicalPath === viewsRoutePath) {
        return { canonicalPath, description: "Configured workspace projections.", title: "Views" };
    }
    if (canonicalPath === browseRoutePath) {
        return {
            canonicalPath,
            description: "Configured workspace taxonomies and terms.",
            title: "Collections",
        };
    }

    const view = dashboard.views.find((candidate) => viewRoutePath(candidate.id) === normalizedPath);
    if (view) {
        return {
            canonicalPath: normalizedPath,
            description: `${view.kind} workspace View.`,
            title: view.title || view.id,
        };
    }

    for (const taxonomy of dashboard.taxonomies) {
        if (taxonomyRoutePath(taxonomy.id) === normalizedPath) {
            return {
                canonicalPath: normalizedPath,
                description: taxonomy.description || "Configured workspace taxonomy.",
                title: taxonomy.title,
            };
        }
        const term = taxonomy.terms.find(
            (candidate) => taxonomyTermRoutePath(taxonomy.id, candidate.id) === normalizedPath,
        );
        if (term) {
            return {
                canonicalPath: normalizedPath,
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
