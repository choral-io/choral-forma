import type { ReactNode } from "react";

import type { DashboardEntry, DashboardViewRender } from "@/data/workspace-client";

import { MarkdownReader } from "./MarkdownReader";
import { useMermaidScope } from "./use-mermaid-scope";

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

    return (
        <>
            {document.beforeProjection.trim() ? (
                <div className="[&_[data-reader=markdown]>h1:first-child]:hidden">
                    <MarkdownReader
                        currentPath={document.path}
                        entries={entries}
                        headings={[]}
                        markdown={document.beforeProjection}
                        mermaidScope={mermaidScope}
                    />
                </div>
            ) : null}
            {children}
            {document.afterProjection.trim() ? (
                <MarkdownReader
                    currentPath={document.path}
                    entries={entries}
                    headings={[]}
                    markdown={document.afterProjection}
                    mermaidScope={mermaidScope}
                />
            ) : null}
        </>
    );
}
