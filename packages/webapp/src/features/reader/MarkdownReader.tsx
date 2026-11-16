import { createMarkdownHeadingAnchor, markdownFootnoteLabelId } from "@choral-forma/shared";
import DOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { isStaticRawHref, logicalHref, rootAwareHref } from "@/data/static-runtime";
import type { DashboardEntry } from "@/data/workspace-client";
import type { MermaidRenderScope } from "@/lib/mermaid";
import { restoreReaderFragment, scrollReaderAnchor } from "@/lib/reader-anchor-navigation";
import { isExternalHref, normalizeWorkspacePath, splitWorkspaceUri } from "@/lib/workspace-links";
import { encodeRouteSegment, rawRoutePrefix } from "@/lib/workspace-routes";

import {
    createProjectionStickyBoundaryController,
    projectionStickyHeaderClassName,
} from "@/lib/projection-sticky-boundary";
import { resolveReaderLink, type MarkdownLinkSource } from "./markdown-links";
import { enhanceMermaidDiagrams } from "./markdown-mermaid-viewer";
import { renderMarkdown, type MarkdownRenderOptions } from "./markdown-renderer";
import { enhanceReader } from "./reader-enhancements";
import { resolveReaderLinkNavigation } from "./reader-link-navigation";

interface MarkdownHeading {
    id: string;
    level: number;
    text: string;
    aliasId?: string | null;
}

export interface MarkdownReaderProps {
    currentPath: string;
    currentRoutePath?: string;
    entries: DashboardEntry[];
    headings: MarkdownHeading[];
    markdown: string;
    linkSource?: MarkdownLinkSource;
    linkDefinitions?: MarkdownRenderOptions["linkDefinitions"];
    mermaidScope?: MermaidRenderScope;
    omitLeadingTitle?: boolean;
}

interface MarkdownRenderState {
    currentPath: string;
    currentRoutePath?: string;
    entries: DashboardEntry[];
    error?: string;
    headings: MarkdownHeading[];
    html?: string;
    markdown: string;
    linkSource: MarkdownLinkSource;
    linkDefinitions?: MarkdownRenderOptions["linkDefinitions"];
    omitLeadingTitle: boolean;
    status: "error" | "ready";
}

export function MarkdownReader({
    currentPath,
    currentRoutePath,
    entries,
    headings,
    markdown,
    mermaidScope,
    linkSource = "workspace",
    linkDefinitions,
    omitLeadingTitle = false,
}: MarkdownReaderProps) {
    const navigate = useNavigate();
    const readerRef = useRef<HTMLDivElement>(null);
    const [renderState, setRenderState] = useState<MarkdownRenderState>();
    const [retryKey, setRetryKey] = useState(0);
    const isCurrentRender =
        renderState?.currentPath === currentPath &&
        renderState.currentRoutePath === currentRoutePath &&
        renderState.entries === entries &&
        renderState.headings === headings &&
        renderState.markdown === markdown &&
        renderState.linkSource === linkSource &&
        renderState.linkDefinitions === linkDefinitions &&
        renderState.omitLeadingTitle === omitLeadingTitle;

    useEffect(() => {
        let cancelled = false;
        const abortController = new AbortController();

        void renderMarkdown(markdown, { mermaidScope, linkDefinitions, signal: abortController.signal })
            .then((rendered) => {
                if (cancelled) {
                    return;
                }

                setRenderState({
                    currentPath,
                    currentRoutePath,
                    entries,
                    headings,
                    html: postProcessMarkdownHtml(
                        rendered,
                        headings,
                        currentPath,
                        entries,
                        omitLeadingTitle,
                        currentRoutePath,
                        linkSource,
                    ),
                    markdown,
                    linkSource,
                    linkDefinitions,
                    omitLeadingTitle,
                    status: "ready",
                });
            })
            .catch((error: unknown) => {
                console.warn("Markdown render failed.", error);
                if (!cancelled) {
                    setRenderState({
                        currentPath,
                        currentRoutePath,
                        entries,
                        error: error instanceof Error ? error.message : "Unknown rendering error",
                        headings,
                        markdown,
                        linkSource,
                        linkDefinitions,
                        omitLeadingTitle,
                        status: "error",
                    });
                }
            });

        return () => {
            cancelled = true;
            abortController.abort();
        };
    }, [
        currentPath,
        currentRoutePath,
        entries,
        headings,
        markdown,
        mermaidScope,
        linkSource,
        linkDefinitions,
        omitLeadingTitle,
        retryKey,
    ]);

    useEffect(() => {
        if (!isCurrentRender || renderState.status !== "ready" || !readerRef.current) return;

        return createMarkdownTableStickyHeaders(readerRef.current);
    }, [isCurrentRender, renderState]);

    useEffect(() => {
        if (!isCurrentRender || renderState.status !== "ready" || !readerRef.current) {
            return;
        }
        return enhanceMermaidDiagrams(readerRef.current);
    }, [isCurrentRender, renderState?.html, renderState?.status]);

    useEffect(() => {
        if (!isCurrentRender || renderState.status !== "ready" || !readerRef.current) return;
        return enhanceReader(readerRef.current);
    }, [isCurrentRender, renderState?.html, renderState?.status]);

    useEffect(() => {
        if (!isCurrentRender || renderState.status !== "ready" || !readerRef.current) return;
        const restore = () => {
            if (readerRef.current) restoreReaderFragment(readerRef.current);
        };
        restore();
        window.addEventListener("hashchange", restore);
        window.addEventListener("popstate", restore);
        return () => {
            window.removeEventListener("hashchange", restore);
            window.removeEventListener("popstate", restore);
        };
    }, [isCurrentRender, renderState]);

    function navigateReaderLink(event: React.MouseEvent<HTMLDivElement>) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const anchor = target.closest<HTMLAnchorElement>("a[href]");
        if (!anchor || !readerRef.current?.contains(anchor)) {
            return;
        }
        const navigation = resolveReaderLinkNavigation(anchor);
        if (!navigation) {
            return;
        }
        if (navigation.samePageFragment) {
            if (scrollReaderAnchor(anchor)) {
                event.preventDefault();
            }
            return;
        }

        event.preventDefault();
        void navigate(navigation.href);
    }

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
                <div className="h-4 w-full skeleton" />
                <div className="h-4 w-11/12 skeleton" />
                <div className="mt-4 h-7 w-2/5 skeleton" />
                <div className="h-4 w-full skeleton" />
                <div className="h-4 w-4/5 skeleton" />
            </div>
        );
    }

    if (renderState.status === "error") {
        return (
            <div className="alert alert-soft alert-error sm:alert-horizontal" data-reader="markdown" role="alert">
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
            onClick={navigateReaderLink}
            ref={readerRef}
            // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
            dangerouslySetInnerHTML={{ __html: renderState.html ?? "" }}
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
    headings: MarkdownHeading[],
    currentPath: string,
    entries: DashboardEntry[],
    omitLeadingTitle: boolean,
    currentRoutePath?: string,
    linkSource: MarkdownLinkSource = "workspace",
) {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    const headingSelector = headings.some(
        (heading) => heading.aliasId !== undefined || (heading.level !== 2 && heading.level !== 3),
    )
        ? "h1, h2, h3, h4, h5, h6"
        : "h2, h3";
    const elements = Array.from(document.body.querySelectorAll(headingSelector)).filter(
        (heading) => !heading.matches("[data-footnotes] > h2"),
    );
    const projectedHeadings = new Map<Element, MarkdownHeading>();
    for (const [index, element] of elements.entries()) {
        const heading = headings[index];
        if (heading) {
            element.id = heading.id;
            projectedHeadings.set(element, heading);
        }
    }

    const noteTargets = new Map<string, string>();
    const footnoteLabel = document.body.querySelector<HTMLElement>("[data-footnotes] > h2");
    let labelId = "footnote-label";
    let labelSuffix = 2;
    while (
        Array.from(document.body.querySelectorAll("[id]")).some(
            (element) => element !== footnoteLabel && element.id === labelId,
        )
    ) {
        labelId = `footnote-label-${String(labelSuffix++)}`;
    }
    if (footnoteLabel) footnoteLabel.id = labelId;
    for (const note of document.body.querySelectorAll<HTMLElement>("[data-footnotes] > ol > li[id]")) {
        const original = note.id;
        let sourceLabel: string;
        try {
            sourceLabel = decodeURIComponent(original.slice("user-content-fn-".length));
        } catch {
            continue;
        }
        note.id = `user-content-fn-${markdownFootnoteLabelId(sourceLabel)}`;
        noteTargets.set(original, note.id);
    }
    const footnoteReferences = new Map<string, string[]>();
    const legacyReferences: { id: string; reference: HTMLAnchorElement }[] = [];
    const originalIds = Array.from(document.body.querySelectorAll("[id]"), (element) => element.id);
    for (const reference of document.body.querySelectorAll<HTMLAnchorElement>("[data-user-content-fn-ref]")) {
        const originalTarget = reference.getAttribute("href")?.slice(1);
        if (!originalTarget) continue;
        const target = noteTargets.get(originalTarget) ?? originalTarget;
        reference.setAttribute("href", `#${encodeURIComponent(target)}`);
        reference.setAttribute("aria-describedby", labelId);
        const references = footnoteReferences.get(target) ?? [];
        const label = target.slice("user-content-fn-".length).replaceAll(":", "%3A");
        const id = `user-content-fnref-${label}${references.length ? `:${String(references.length)}` : ""}`;
        if (reference.id !== id) legacyReferences.push({ id: reference.id, reference });
        reference.id = id;
        references.push(id);
        footnoteReferences.set(target, references);
    }
    const referenceIds = new Set(Array.from(document.body.querySelectorAll("[id]"), (element) => element.id));
    for (const { id, reference } of legacyReferences) {
        if (referenceIds.has(id) || originalIds.filter((candidate) => candidate === id).length !== 1) continue;
        const alias = document.createElement("span");
        alias.id = id;
        alias.tabIndex = -1;
        alias.setAttribute("aria-label", "Footnote reference");
        reference.before(alias);
        referenceIds.add(id);
    }
    let backrefIndex = 0;
    for (const note of document.body.querySelectorAll<HTMLElement>("li[id^='user-content-fn-']")) {
        const references = footnoteReferences.get(note.id) ?? [];
        for (const [index, backref] of Array.from(note.querySelectorAll("[data-user-content-fn-backref]")).entries()) {
            backref.setAttribute("data-footnote-backref", "");
            backref.setAttribute("aria-label", `Back to reference ${String(++backrefIndex)}`);
            if (references[index]) backref.setAttribute("href", `#${encodeURIComponent(references[index] ?? "")}`);
        }
    }

    const leadingTitle = document.body.firstElementChild;
    const omitTitle =
        omitLeadingTitle && leadingTitle?.tagName === "H1" && !leadingTitle.querySelector("[data-user-content-fn-ref]");
    const headingAnchor = createMarkdownHeadingAnchor();
    const occupiedIds = new Set(
        Array.from(document.body.querySelectorAll("[id]"))
            .filter((element) => !omitTitle || element !== leadingTitle)
            .map((element) => element.id),
    );
    for (const heading of document.body.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")) {
        if (heading === footnoteLabel) continue;
        const semanticHeading = heading.cloneNode(true) as HTMLElement;
        for (const reference of semanticHeading.querySelectorAll("[data-user-content-fn-ref]")) {
            if (reference.parentElement?.tagName === "SUP") reference.parentElement.remove();
        }
        for (const formula of semanticHeading.querySelectorAll(".katex")) {
            const source = formula.querySelector('annotation[encoding="application/x-tex"]');
            if (source) formula.replaceWith(document.createTextNode(source.textContent));
        }
        for (const image of semanticHeading.querySelectorAll("img, script, style")) image.remove();
        const projectedHeading = projectedHeadings.get(heading);
        heading.dataset.readerHeadingText = projectedHeading?.text ?? semanticHeading.textContent;
        const aliasId = projectedHeading?.aliasId;
        let id = aliasId === undefined ? headingAnchor(semanticHeading.textContent) : aliasId;
        if (omitTitle && heading === leadingTitle && (id === null || occupiedIds.has(id))) {
            id = heading.id;
            if (!id || occupiedIds.has(id)) {
                id = "forma-omitted-title";
                while (occupiedIds.has(id)) id += "-";
            }
        }
        if (!id || occupiedIds.has(id)) continue;
        const alias = document.createElement("span");
        alias.id = id;
        alias.dataset.formaHeadingAnchor = "";
        alias.tabIndex = -1;
        heading.prepend(alias);
        occupiedIds.add(id);
    }

    if (omitTitle && document.body.firstElementChild?.tagName === "H1") {
        const title = document.body.firstElementChild;
        const alias = title.querySelector<HTMLElement>("[data-forma-heading-anchor]");
        if (alias) {
            alias.setAttribute("aria-label", title.textContent);
            alias.dataset.readerHeadingText = title.getAttribute("data-reader-heading-text") ?? title.textContent;
            title.replaceWith(alias);
        } else title.remove();
    }

    for (const anchor of document.body.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        const href = anchor.getAttribute("href");
        if (!href) {
            continue;
        }

        const resolvedLink = resolveReaderLink(
            linkSource === "published" ? logicalHref(href) : href,
            currentPath,
            entries,
            currentRoutePath,
            linkSource,
        );
        anchor.classList.add("link");
        anchor.dataset.linkKind = resolvedLink.kind;
        anchor.setAttribute("href", rootAwareHref(resolvedLink.href));

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
        if (
            !source ||
            isExternalHref(source) ||
            source.startsWith("//") ||
            source.startsWith("#") ||
            isStaticRawHref(source)
        ) {
            continue;
        }

        const { path, query, hash } = splitWorkspaceUri(source);
        const target = normalizeWorkspacePath(path, currentPath, entries).split("/").map(encodeRouteSegment).join("/");
        image.setAttribute("src", rootAwareHref(`${rawRoutePrefix}/${target}${query}${hash}`));
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
        // Reader enhancements find this positioned wrapper by its role, not by a style class.
        wrapper.dataset.codeBlock = "";
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
