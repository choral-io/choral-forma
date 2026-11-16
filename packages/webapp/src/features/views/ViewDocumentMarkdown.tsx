import { useMemo, type ReactNode } from "react";
import { useLocation } from "react-router";

import type { DashboardEntry, DashboardViewRender } from "@/data/workspace-client";

import { collectMarkdownLinkDefinitions } from "@/features/reader/markdown-renderer";
import { MarkdownReader } from "@/features/reader/MarkdownReader";
import { useMermaidScope } from "@/features/reader/use-mermaid-scope";

const emptyHeadings: [] = [];

/**
 * Renders a View's own Markdown around its projection. Both sections share one
 * Mermaid scope so the per-scope diagram budget covers the document as a whole,
 * which is why the projection is passed through as children rather than rendered
 * beside two separate readers.
 */
export function ViewDocumentMarkdown({
    children,
    document,
    entries,
}: {
    children: ReactNode;
    document: DashboardViewRender["document"];
    entries: DashboardEntry[];
}) {
    const mermaidScope = useMermaidScope(document.path);
    const { pathname } = useLocation();
    const { beforeProjection, afterProjection } = document;
    const linkDefinitions = useMemo(() => {
        if (!beforeProjection.trim() || !afterProjection.trim()) return undefined;
        const links = collectMarkdownLinkDefinitions(`${beforeProjection}<!-- forma:content -->${afterProjection}`);
        return Object.keys(links).length ? links : undefined;
    }, [beforeProjection, afterProjection]);

    return (
        <>
            {document.beforeProjection.trim() ? (
                <MarkdownReader
                    currentPath={document.path}
                    currentRoutePath={pathname}
                    entries={entries}
                    headings={document.headings?.beforeProjection ?? emptyHeadings}
                    markdown={document.beforeProjection}
                    linkDefinitions={linkDefinitions}
                    mermaidScope={mermaidScope}
                    omitLeadingTitle
                />
            ) : null}
            {children}
            {document.afterProjection.trim() ? (
                <MarkdownReader
                    currentPath={document.path}
                    currentRoutePath={pathname}
                    entries={entries}
                    headings={document.headings?.afterProjection ?? emptyHeadings}
                    markdown={document.afterProjection}
                    linkDefinitions={linkDefinitions}
                    mermaidScope={mermaidScope}
                />
            ) : null}
        </>
    );
}
