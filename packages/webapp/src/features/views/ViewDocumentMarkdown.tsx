import { useMemo, type ReactNode } from "react";
import { useLocation } from "react-router";

import type { DashboardEntry, DashboardViewRender } from "@/data/workspace-client";
import { isStaticWorkspaceClient } from "@/data/workspace-client-source";

import { markdownAroundProjection } from "@/features/reader/markdown-renderer";
import { MarkdownReader } from "@/features/reader/MarkdownReader";
import { useMermaidScope } from "@/features/reader/use-mermaid-scope";

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
    const { beforeProjection, afterProjection, hasProjectionMount } = document;
    const source = useMemo(
        () =>
            hasProjectionMount
                ? markdownAroundProjection(beforeProjection, afterProjection)
                : { markdown: beforeProjection, boundary: undefined },
        [beforeProjection, afterProjection, hasProjectionMount],
    );
    const headings = useMemo(
        () => [...(document.headings?.beforeProjection ?? []), ...(document.headings?.afterProjection ?? [])],
        [document.headings],
    );

    return (
        <MarkdownReader
            currentPath={document.path}
            currentRoutePath={pathname}
            entries={entries}
            headings={headings}
            linkSource={isStaticWorkspaceClient ? "published" : "workspace"}
            markdown={source.markdown}
            mermaidScope={mermaidScope}
            omitLeadingTitle
            projection={{ boundary: source.boundary, content: children }}
        />
    );
}
