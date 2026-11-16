import { createMarkdownHeadingAnchor, markdownFootnoteLabelId } from "@choral-forma/shared";
import DOMPurify from "dompurify";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { renderMarkdown } from "./markdown-renderer";
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
    mermaidScope?: MermaidRenderScope;
    omitLeadingTitle?: boolean;
    projection?: { boundary?: string; content: ReactNode };
}

interface MarkdownRenderState {
    currentPath: string;
    currentRoutePath?: string;
    entries: DashboardEntry[];
    error?: string;
    headings: MarkdownHeading[];
    sections?: [string, string?];
    markdown: string;
    linkSource: MarkdownLinkSource;
    omitLeadingTitle: boolean;
    hasProjection: boolean;
    projectionBoundary?: string;
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
    omitLeadingTitle = false,
    projection,
}: MarkdownReaderProps) {
    const hasProjection = Boolean(projection);
    const projectionBoundary = projection?.boundary;
    const [renderState, setRenderState] = useState<MarkdownRenderState>();
    const [retryKey, setRetryKey] = useState(0);
    const isCurrentRender =
        renderState?.currentPath === currentPath &&
        renderState.currentRoutePath === currentRoutePath &&
        renderState.entries === entries &&
        renderState.headings === headings &&
        renderState.markdown === markdown &&
        renderState.linkSource === linkSource &&
        renderState.hasProjection === hasProjection &&
        renderState.projectionBoundary === projectionBoundary &&
        renderState.omitLeadingTitle === omitLeadingTitle;

    useEffect(() => {
        let cancelled = false;
        const abortController = new AbortController();

        void renderMarkdown(markdown, { mermaidScope, projectionBoundary, signal: abortController.signal })
            .then((rendered) => {
                if (cancelled) {
                    return;
                }

                setRenderState({
                    currentPath,
                    currentRoutePath,
                    entries,
                    headings,
                    sections: postProcessMarkdownSections(
                        splitMarkdownSections(rendered, projectionBoundary),
                        headings,
                        currentPath,
                        entries,
                        omitLeadingTitle,
                        currentRoutePath,
                        linkSource,
                        hasProjection,
                    ),
                    markdown,
                    linkSource,
                    omitLeadingTitle,
                    hasProjection,
                    projectionBoundary,
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
                        omitLeadingTitle,
                        hasProjection,
                        projectionBoundary,
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
        omitLeadingTitle,
        hasProjection,
        projectionBoundary,
        retryKey,
    ]);

    if (!isCurrentRender) {
        const loading = (
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
        const [before, after] = splitMarkdownSections(markdown, projectionBoundary);
        return (
            <>
                {(!projection || before.trim()) && loading}
                {projection?.content}
                {after?.trim() && loading}
            </>
        );
    }

    if (renderState.status === "error") {
        return (
            <>
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
                {projection?.content}
            </>
        );
    }

    const [before, after] = renderState.sections ?? [""];
    return (
        <>
            {(!projection || before.trim()) && <MarkdownReaderBody html={before} />}
            {projection?.content}
            {after?.trim() && <MarkdownReaderBody html={after} />}
        </>
    );
}

function MarkdownReaderBody({ html }: { html: string }) {
    const navigate = useNavigate();
    const readerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (readerRef.current) return createMarkdownTableStickyHeaders(readerRef.current);
    }, [html]);

    useEffect(() => {
        if (readerRef.current) return enhanceMermaidDiagrams(readerRef.current);
    }, [html]);

    useEffect(() => {
        if (readerRef.current) return enhanceReader(readerRef.current);
    }, [html]);

    useEffect(() => {
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
    }, [html]);

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

    return (
        <div
            data-reader="markdown"
            onClick={navigateReaderLink}
            ref={readerRef}
            // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
            dangerouslySetInnerHTML={{ __html: html }}
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
    return postProcessMarkdownSections(
        [html],
        headings,
        currentPath,
        entries,
        omitLeadingTitle,
        currentRoutePath,
        linkSource,
    )[0];
}

function splitMarkdownSections(value: string, boundary?: string): [string, string?] {
    const offset = boundary ? value.indexOf(boundary) : -1;
    if (boundary && offset >= 0) return [value.slice(0, offset), value.slice(offset + boundary.length)];
    return [value];
}

// eslint-disable-next-line react-refresh/only-export-components
export function postProcessMarkdownSections(
    [before, after]: [string, string?],
    headings: MarkdownHeading[],
    currentPath: string,
    entries: DashboardEntry[],
    omitLeadingTitle: boolean,
    currentRoutePath?: string,
    linkSource: MarkdownLinkSource = "workspace",
    viewDocument = false,
): [string, string?] {
    const parser = new DOMParser();
    const document = parser.parseFromString(before, "text/html");
    const leadingTitle = document.body.firstElementChild;
    // Static publication keeps an H1 after a leading comment and after a View mount.
    const omitTitle =
        omitLeadingTitle &&
        (!viewDocument || before.trimStart().startsWith("<h1>")) &&
        leadingTitle?.tagName === "H1" &&
        !leadingTitle.querySelector("[data-user-content-fn-ref]");

    const separator = after === undefined ? undefined : document.createComment("");
    if (separator && after !== undefined) {
        const tail = parser.parseFromString(after, "text/html").body;
        document.body.append(separator);
        while (tail.firstChild) document.body.append(tail.firstChild);
    }

    const footnoteLabel = document.body.querySelector<HTMLElement>("[data-footnotes] > h2");
    const notes = footnoteLabel ? orderFootnotes(document.body, footnoteLabel) : [];

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

    if (footnoteLabel && notes.length)
        normalizeFootnotes(document, footnoteLabel, notes, omitTitle ? leadingTitle : null);

    const headingAnchor = createMarkdownHeadingAnchor();
    const occupiedIds = new Set(
        Array.from(document.body.querySelectorAll("[id]"))
            .filter((element) => !omitTitle || element !== leadingTitle)
            .map((element) => element.id),
    );
    const authoredHeadings = Array.from(document.body.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")).filter(
        (heading) => heading !== footnoteLabel,
    );
    const anchors = authoredHeadings.map((heading) => {
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
        return { heading, candidate: aliasId === undefined ? headingAnchor(semanticHeading.textContent) : aliasId };
    });
    const bodyAliases = new Set(
        anchors.filter(({ heading }) => heading !== leadingTitle).map(({ candidate }) => candidate),
    );
    for (const { heading, candidate } of anchors) {
        let id = candidate;
        if (omitTitle && heading === leadingTitle) {
            // The hidden title cannot take a readable alias that belongs to the body.
            if (!id || occupiedIds.has(id) || bodyAliases.has(id)) id = heading.id;
            if (!id || occupiedIds.has(id) || bodyAliases.has(id)) {
                id = "forma-omitted-title";
                while (occupiedIds.has(id) || bodyAliases.has(id)) id += "-";
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

    if (omitTitle) {
        const title = leadingTitle;
        const alias = title.querySelector<HTMLElement>("[data-forma-heading-anchor]");
        if (alias) {
            alias.setAttribute("aria-label", title.textContent);
            alias.dataset.readerHeadingText = title.getAttribute("data-reader-heading-text") ?? title.textContent;
            alias.dataset.readerOmittedTitle = "";
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

    const sanitize = (body: HTMLElement) => {
        DOMPurify.sanitize(body, {
            ADD_ATTR: ["encoding", "target"],
            ADD_TAGS: ["annotation", "semantics"],
            IN_PLACE: true,
        });
        // Core's generated heading slugs are published fragments. DOMPurify
        // removes names such as "title" and "after" from arbitrary author HTML.
        // Restore only surviving headings that received a slug from Core.
        for (const [heading, { id }] of projectedHeadings) {
            if (!heading.id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id) && body.contains(heading)) heading.id = id;
        }
        return body.innerHTML;
    };
    if (!separator) return [sanitize(document.body)];

    const tail = document.createElement("div");
    while (separator.nextSibling) tail.append(separator.nextSibling);
    separator.remove();
    return [sanitize(document.body), sanitize(tail)];
}

interface FootnoteReference {
    element: HTMLAnchorElement;
    id: string;
    originalId: string;
}

interface ReaderFootnote {
    element: HTMLElement;
    id: string;
    references: FootnoteReference[];
}

function orderFootnotes(body: HTMLElement, label: HTMLElement): ReaderFootnote[] {
    const definitions = new Map<string, ReaderFootnote>();
    const list = label.parentElement?.querySelector<HTMLOListElement>(":scope > ol");
    if (!list) return [];
    for (const note of list.querySelectorAll<HTMLElement>(":scope > li[id]")) {
        const original = note.id;
        try {
            const normalized = markdownFootnoteLabelId(decodeURIComponent(original.slice("user-content-fn-".length)));
            definitions.set(original, { element: note, id: `user-content-fn-${normalized}`, references: [] });
        } catch {
            continue;
        }
    }
    const ordered = new Set<ReaderFootnote>();
    function collect(scope: HTMLElement) {
        for (const reference of scope.querySelectorAll<HTMLAnchorElement>("[data-user-content-fn-ref]")) {
            if (scope === body && list?.contains(reference)) continue;
            const note = definitions.get(reference.getAttribute("href")?.slice(1) ?? "");
            if (!note) continue;
            ordered.add(note);
            const labelSlug = note.id.slice("user-content-fn-".length).replaceAll(":", "%3A");
            const suffix = note.references.length ? `:${String(note.references.length)}` : "";
            note.references.push({
                element: reference,
                id: `user-content-fnref-${labelSlug}${suffix}`,
                originalId: reference.id,
            });
        }
    }
    // Match Core's heading order: body calls first, then calls in reached notes.
    collect(body);
    for (const note of ordered) collect(note.element);
    for (const note of definitions.values()) if (!ordered.has(note)) note.element.remove();
    for (const note of ordered) list.append(note.element);
    if (!ordered.size) label.parentElement?.remove();
    return [...ordered];
}

function normalizeFootnotes(
    document: Document,
    label: HTMLElement,
    notes: ReaderFootnote[],
    omittedTitle: Element | null,
) {
    const generated = new Set<Element>([label]);
    for (const note of notes) {
        generated.add(note.element);
        for (const reference of note.references) generated.add(reference.element);
    }
    const counts = new Map<string, number>();
    const occupied = new Set<string>();
    for (const element of document.body.querySelectorAll<HTMLElement>("[id]")) {
        if (element === omittedTitle) continue;
        counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
        if (!generated.has(element)) occupied.add(element.id);
    }
    // A colliding generated anchor must not consume another footnote's ordinary ID.
    const reserved = new Set<string>();
    for (const note of notes) {
        reserved.add(note.id);
        for (const reference of note.references) {
            reserved.add(reference.id);
            if (counts.get(reference.originalId) === 1) reserved.add(reference.originalId);
        }
    }
    function assign(element: HTMLElement, id: string, fallback = id) {
        if (occupied.has(id)) {
            id = fallback;
            while (occupied.has(id) || reserved.has(id)) id += "-";
        }
        occupied.add(id);
        element.id = id;
        return id;
    }
    const labelId = assign(label, "footnote-label", "footnote-label-2");
    const aliases: FootnoteReference[] = [];
    let backrefIndex = 0;
    for (const [noteIndex, note] of notes.entries()) {
        const target = assign(note.element, note.id);
        const referenceIds = note.references.map((reference) => {
            reference.element.setAttribute("href", `#${encodeURIComponent(target)}`);
            reference.element.setAttribute("aria-describedby", labelId);
            reference.element.textContent = String(noteIndex + 1);
            const id = assign(reference.element, reference.id);
            if (reference.originalId !== id) aliases.push(reference);
            return id;
        });
        for (const [index, backref] of Array.from(
            note.element.querySelectorAll("[data-user-content-fn-backref]"),
        ).entries()) {
            const id = referenceIds[index];
            if (!id) {
                backref.remove();
                continue;
            }
            backref.setAttribute("data-footnote-backref", "");
            backref.setAttribute("aria-label", `Back to reference ${String(++backrefIndex)}`);
            backref.setAttribute("href", `#${encodeURIComponent(id)}`);
        }
    }
    for (const { element, originalId } of aliases) {
        if (!originalId || occupied.has(originalId) || counts.get(originalId) !== 1) continue;
        const alias = document.createElement("span");
        alias.id = originalId;
        alias.tabIndex = -1;
        alias.setAttribute("aria-label", "Footnote reference");
        element.before(alias);
        occupied.add(originalId);
    }
}
