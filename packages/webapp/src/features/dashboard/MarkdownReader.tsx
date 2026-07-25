import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";

import type { DashboardEntry, DashboardEntryHeading } from "@/data/workspace-client";
import type { MermaidRenderScope } from "@/lib/mermaid";
import { isExternalHref, normalizeWorkspaceHref } from "@/lib/workspace-links";

import { resolveReaderLink } from "./markdown-links";
import { renderMarkdown } from "./markdown-renderer";
import {
    createProjectionStickyBoundaryController,
    projectionStickyHeaderClassName,
} from "./projection-sticky-boundary";

export interface MarkdownReaderProps {
    currentPath: string;
    entries: DashboardEntry[];
    headings: DashboardEntryHeading[];
    markdown: string;
    mermaidScope?: MermaidRenderScope;
    omitLeadingTitle?: boolean;
}

interface MarkdownRenderState {
    currentPath: string;
    entries: DashboardEntry[];
    error?: string;
    headings: DashboardEntryHeading[];
    html?: string;
    markdown: string;
    omitLeadingTitle: boolean;
    status: "error" | "ready";
}

export function MarkdownReader({
    currentPath,
    entries,
    headings,
    markdown,
    mermaidScope,
    omitLeadingTitle = false,
}: MarkdownReaderProps) {
    const readerRef = useRef<HTMLDivElement>(null);
    const [renderState, setRenderState] = useState<MarkdownRenderState>();
    const [retryKey, setRetryKey] = useState(0);
    const isCurrentRender =
        renderState?.currentPath === currentPath &&
        renderState.entries === entries &&
        renderState.headings === headings &&
        renderState.markdown === markdown &&
        renderState.omitLeadingTitle === omitLeadingTitle;

    useEffect(() => {
        let cancelled = false;
        const abortController = new AbortController();

        void renderMarkdown(markdown, { mermaidScope, signal: abortController.signal })
            .then((rendered) => {
                if (cancelled) {
                    return;
                }

                setRenderState({
                    currentPath,
                    entries,
                    headings,
                    html: postProcessMarkdownHtml(rendered, headings, currentPath, entries, omitLeadingTitle),
                    markdown,
                    omitLeadingTitle,
                    status: "ready",
                });
            })
            .catch((error: unknown) => {
                console.warn("Markdown render failed.", error);
                if (!cancelled) {
                    setRenderState({
                        currentPath,
                        entries,
                        error: error instanceof Error ? error.message : "Unknown rendering error",
                        headings,
                        markdown,
                        omitLeadingTitle,
                        status: "error",
                    });
                }
            });

        return () => {
            cancelled = true;
            abortController.abort();
        };
    }, [currentPath, entries, headings, markdown, mermaidScope, omitLeadingTitle, retryKey]);

    useEffect(() => {
        if (!isCurrentRender || renderState.status !== "ready" || !readerRef.current) return;

        return createMarkdownTableStickyHeaders(readerRef.current);
    }, [isCurrentRender, renderState]);

    if (!isCurrentRender) {
        return (
            <div
                aria-busy="true"
                aria-label="Rendering page content"
                className="flex flex-col gap-5"
                data-reader="markdown"
                data-reader-loading
                role="status"
            >
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-11/12" />
                <div className="skeleton mt-4 h-7 w-2/5" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-4/5" />
            </div>
        );
    }

    if (renderState.status === "error") {
        return (
            <div className="alert alert-error alert-soft sm:alert-horizontal" data-reader="markdown" role="alert">
                <div className="min-w-0">
                    <p className="font-medium">This page could not be rendered.</p>
                    <p className="text-sm opacity-80">{renderState.error}</p>
                </div>
                <button
                    className="btn btn-sm"
                    onClick={() => {
                        setRenderState(undefined);
                        setRetryKey((value) => value + 1);
                    }}
                    type="button"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div
            data-reader="markdown"
            // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
            dangerouslySetInnerHTML={{ __html: renderState.html ?? "" }}
            ref={readerRef}
        />
    );
}

function createMarkdownTableStickyHeaders(reader: HTMLElement): () => void {
    const cleanups: (() => void)[] = [];

    for (const wrapper of reader.querySelectorAll<HTMLElement>(".table-wrapper")) {
        const table = wrapper.querySelector<HTMLTableElement>(":scope > table");
        const header = table?.tHead;
        const headerRow = header?.rows.item(0);
        if (!table || !header || !headerRow || headerRow.cells.length === 0) continue;

        const boundary = document.createElement("div");
        boundary.className = "relative my-5 grid";
        boundary.dataset.markdownTableStickyBoundary = "";

        const stickyHeader = document.createElement("div");
        stickyHeader.ariaHidden = "true";
        stickyHeader.className = projectionStickyHeaderClassName;
        stickyHeader.dataset.markdownStickyHeader = "";

        const stickyTable = document.createElement("table");
        stickyTable.className = "table table-sm min-w-0 table-fixed whitespace-nowrap";
        const stickyColumns = document.createElement("colgroup");
        stickyColumns.append(...Array.from(headerRow.cells, () => document.createElement("col")));

        const stickyTableHeader = header.cloneNode(true) as HTMLTableSectionElement;
        stickyTableHeader.removeAttribute("id");
        for (const element of stickyTableHeader.querySelectorAll<HTMLElement>("[id]")) {
            element.removeAttribute("id");
        }
        for (const element of stickyTableHeader.querySelectorAll<HTMLElement>(
            "a, button, input, select, textarea, [tabindex]",
        )) {
            element.replaceWith(document.createTextNode(element.textContent));
        }

        stickyTable.append(stickyColumns, stickyTableHeader);
        stickyHeader.append(stickyTable);
        wrapper.replaceWith(boundary);
        wrapper.classList.add("col-start-1", "row-start-1");
        boundary.append(stickyHeader, wrapper);

        const syncHorizontalScroll = () => {
            stickyHeader.scrollLeft = wrapper.scrollLeft;
        };
        wrapper.addEventListener("scroll", syncHorizontalScroll, { passive: true });

        const cleanupController = createProjectionStickyBoundaryController({
            boundary,
            observe: [table, ...headerRow.cells],
            source: header,
            sticky: stickyHeader,
            syncPresentation: () => {
                const stickyColumnElements = stickyColumns.querySelectorAll("col");
                Array.from(headerRow.cells).forEach((cell, index) => {
                    stickyColumnElements.item(index).style.width = `${cell.getBoundingClientRect().width.toString()}px`;
                });
                stickyTable.style.width = `${table.getBoundingClientRect().width.toString()}px`;
                syncHorizontalScroll();
            },
        });

        cleanups.push(() => {
            cleanupController();
            wrapper.removeEventListener("scroll", syncHorizontalScroll);
            if (boundary.isConnected) boundary.replaceWith(wrapper);
            wrapper.classList.remove("col-start-1", "row-start-1");
        });
    }

    return () => {
        cleanups.forEach((cleanup) => {
            cleanup();
        });
    };
}

// eslint-disable-next-line react-refresh/only-export-components
export function postProcessMarkdownHtml(
    html: string,
    headings: DashboardEntryHeading[],
    currentPath: string,
    entries: DashboardEntry[],
    omitLeadingTitle: boolean,
) {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    if (omitLeadingTitle && document.body.firstElementChild?.tagName === "H1") {
        document.body.firstElementChild.remove();
    }

    const elements = Array.from(document.body.querySelectorAll("h2, h3"));
    for (const [index, element] of elements.entries()) {
        const heading = headings[index];
        if (heading) {
            element.id = heading.id;
        }
    }

    for (const anchor of document.body.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        const href = anchor.getAttribute("href");
        if (!href) {
            continue;
        }

        const resolvedLink = resolveReaderLink(href, currentPath, entries);
        anchor.classList.add("link");
        anchor.dataset.linkKind = resolvedLink.kind;
        anchor.setAttribute("href", resolvedLink.href);

        if (resolvedLink.opensInNewTab) {
            anchor.setAttribute("target", "_blank");
            anchor.setAttribute("rel", "noopener noreferrer");
            const label = anchor.textContent.trim();
            if (label) {
                anchor.setAttribute("aria-label", `${label} (opens in a new tab)`);
            }
        }
    }

    for (const image of document.body.querySelectorAll("img[src]")) {
        const source = image.getAttribute("src");
        if (!source || isExternalHref(source) || source.startsWith("#") || source.startsWith("/raw/")) {
            continue;
        }

        const targetPath = normalizeWorkspaceHref(source, currentPath, entries);
        image.setAttribute("src", `/raw/${encodeURI(targetPath.path)}`);
    }

    for (const table of document.body.querySelectorAll("table")) {
        const wrapper = document.createElement("div");
        wrapper.ariaLabel = "Markdown table";
        wrapper.className = "table-wrapper focus-visible:ring-primary/40 outline-none focus-visible:ring-3";
        wrapper.role = "region";
        wrapper.tabIndex = 0;
        table.classList.add("table", "table-sm", "w-max", "min-w-full", "whitespace-nowrap");
        table.replaceWith(wrapper);
        wrapper.append(table);
    }

    for (const checkbox of document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
        checkbox.classList.add(
            "checkbox",
            "checkbox-sm",
            "me-2",
            "align-middle",
            "disabled:bg-base-200",
            "disabled:border-base-content/25",
            "disabled:opacity-100",
        );
    }

    for (const radio of document.body.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
        radio.classList.add(
            "radio",
            "radio-sm",
            "me-2",
            "align-middle",
            "disabled:bg-base-200",
            "disabled:border-base-content/25",
            "disabled:opacity-100",
        );
    }

    for (const pre of document.body.querySelectorAll("pre.shiki[data-language]")) {
        const language = pre.getAttribute("data-language");
        if (!language) {
            continue;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "relative my-5";
        const label = document.createElement("span");
        label.className =
            "bg-base-100 text-base-content/60 border-base-300 pointer-events-none absolute inset-e-3 top-0 -translate-y-1/2 rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm";
        label.textContent = language;
        pre.replaceWith(wrapper);
        wrapper.append(pre);
        wrapper.append(label);
    }

    return DOMPurify.sanitize(document.body.innerHTML, {
        ADD_ATTR: ["encoding", "target"],
        ADD_TAGS: ["annotation", "semantics"],
    });
}
