import DOMPurify from "dompurify";
import { Marked } from "marked";
import { useEffect, useState } from "react";

import type { DashboardEntry, DashboardEntryHeading } from "@/data/workspace-client";
import { isExternalHref, normalizeWorkspaceHref } from "@/lib/workspace-links";

import { markedShiki } from "./markdown-shiki";

const marked = new Marked({ gfm: true });
marked.use(markedShiki);

export interface MarkdownReaderProps {
    currentPath: string;
    entries: DashboardEntry[];
    headings: DashboardEntryHeading[];
    markdown: string;
}

export function MarkdownReader({ currentPath, entries, headings, markdown }: MarkdownReaderProps) {
    const [html, setHtml] = useState("");

    useEffect(() => {
        let cancelled = false;

        void Promise.resolve(marked.parse(markdown, { async: true }))
            .then((rendered) => {
                if (cancelled) {
                    return;
                }

                setHtml(postProcessMarkdownHtml(rendered, headings, currentPath, entries));
            })
            .catch((error: unknown) => {
                console.warn("Markdown render failed.", error);
                if (!cancelled) {
                    setHtml(DOMPurify.sanitize(`<pre><code>${escapeHtml(markdown)}</code></pre>`));
                }
            });

        return () => {
            cancelled = true;
        };
    }, [currentPath, entries, headings, markdown]);

    return (
        <div
            data-reader="markdown"
            // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function postProcessMarkdownHtml(
    html: string,
    headings: DashboardEntryHeading[],
    currentPath: string,
    entries: DashboardEntry[],
) {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, "text/html");

    const elements = Array.from(document.body.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    for (const [index, element] of elements.entries()) {
        const heading = headings[index];
        if (heading) {
            element.id = heading.id;
        }
    }

    for (const anchor of document.body.querySelectorAll("a[href]")) {
        const href = anchor.getAttribute("href");
        if (!href || isExternalHref(href) || href.startsWith("#")) {
            continue;
        }

        const targetPath = normalizeWorkspaceHref(href, currentPath, entries);
        const targetEntry = entries.find((entry) => entry.path === targetPath.path);
        if (targetEntry) {
            anchor.setAttribute("href", `${targetEntry.routePath}${targetPath.hash}`);
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
        wrapper.className = "table-wrapper";
        table.replaceWith(wrapper);
        wrapper.append(table);
    }

    for (const pre of document.body.querySelectorAll("pre.shiki[data-language]")) {
        const language = pre.getAttribute("data-language");
        if (!language) {
            continue;
        }

        const wrapper = document.createElement("div");
        wrapper.setAttribute("data-code-block", "");
        wrapper.setAttribute("data-language", language);
        pre.replaceWith(wrapper);
        wrapper.append(pre);
    }

    return DOMPurify.sanitize(document.body.innerHTML);
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
        switch (character) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            default:
                return "&#39;";
        }
    });
}
