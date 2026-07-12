import { VIEW_MOUNT_MARKER } from "./view-document.ts";

type MarkdownEnvironment = { currentDocument?: { path?: string; toString(): string } };
type MarkdownRenderer = {
    render(tokens: unknown[], options: unknown, environment: MarkdownEnvironment): string;
};
export type MarkdownIt = { renderer: MarkdownRenderer };

export type FrontmatterLink = { field: string; value: string; targetPath: string };
export type PreviewBodyLink = { raw: string; label: string; targetPath: string; fragment?: string };
export type MarkdownEnhancement = {
    projection?: string;
    frontmatterLinks?: FrontmatterLink[];
    bodyLinks?: PreviewBodyLink[];
};

const enhancements = new Map<string, MarkdownEnhancement>();

export function extendMarkdownIt(markdownIt: MarkdownIt): MarkdownIt {
    const originalRender = markdownIt.renderer.render.bind(markdownIt.renderer);
    markdownIt.renderer.render = (tokens, options, environment) => {
        const html = originalRender(tokens, options, environment);
        const key = environment.currentDocument?.toString();
        const enhancement = enhancementForDocument(key, environment.currentDocument?.path);
        return enhanceMarkdownPreview(html, enhancement);
    };
    return markdownIt;
}

function enhancementForDocument(uri: string | undefined, path: string | undefined): MarkdownEnhancement | undefined {
    const exact = uri ? enhancements.get(uri) : undefined;
    if (exact || !path) return exact;
    const encodedPath = encodeURI(path);
    return [...enhancements.entries()].find(([key]) => key.endsWith(path) || key.endsWith(encodedPath))?.[1];
}

export function setMarkdownEnhancement(documentUri: string, enhancement: MarkdownEnhancement | undefined): void {
    if (
        enhancement &&
        (enhancement.projection ||
            (enhancement.frontmatterLinks?.length ?? 0) > 0 ||
            (enhancement.bodyLinks?.length ?? 0) > 0)
    ) {
        enhancements.set(documentUri, enhancement);
    } else {
        enhancements.delete(documentUri);
    }
}

export function clearMarkdownProjections(): void {
    enhancements.clear();
}

export function enhanceMarkdownPreview(html: string, enhancement: MarkdownEnhancement | undefined): string {
    const frontmatterHtml = enhanceFrontmatterLinks(html, enhancement?.frontmatterLinks ?? []);
    const linkedHtml = enhanceBodyLinks(frontmatterHtml, enhancement?.bodyLinks ?? []);
    const projection = enhancement?.projection;
    if (!projection) return linkedHtml;
    const markerIndex = linkedHtml.indexOf(VIEW_MOUNT_MARKER);
    return markerIndex < 0
        ? `${linkedHtml}${projection}`
        : `${linkedHtml.slice(0, markerIndex)}${projection}${linkedHtml.slice(markerIndex + VIEW_MOUNT_MARKER.length)}`;
}

export function enhanceBodyLinks(html: string, links: PreviewBodyLink[]): string {
    return replaceUnprotectedText(html, (text) => {
        return links.reduce((current, link) => {
            const raw = escapeHtml(link.raw);
            const fragment = link.fragment ? `#${encodeURIComponent(link.fragment)}` : "";
            const href = `/${escapeAttribute(link.targetPath)}${fragment}`;
            const anchor = `<a class="forma-wikilink" href="${href}">${escapeHtml(link.label)}</a>`;
            return current.replaceAll(raw, anchor);
        }, text);
    });
}

function replaceUnprotectedText(html: string, replace: (text: string) => string): string {
    const protectedBlock =
        /<(pre|code|a)\b[^>]*>[\s\S]*?<\/\1>|<table\b[^>]*class="[^"]*frontmatter[^"]*"[^>]*>[\s\S]*?<\/table>/giu;
    let result = "";
    let cursor = 0;
    for (const match of html.matchAll(protectedBlock)) {
        result += replaceTextNodes(html.slice(cursor, match.index), replace);
        result += match[0];
        cursor = match.index + match[0].length;
    }
    return result + replaceTextNodes(html.slice(cursor), replace);
}

function replaceTextNodes(html: string, replace: (text: string) => string): string {
    return html
        .split(/(<[^>]+>)/gu)
        .map((part) => (part.startsWith("<") ? part : replace(part)))
        .join("");
}

export function enhanceFrontmatterLinks(html: string, links: FrontmatterLink[]): string {
    return links.reduce((current, link) => {
        const field = escapeHtml(link.field);
        const rowPattern = new RegExp(`(<tr><th>${escapeRegExp(field)}</th><td>)([\\s\\S]*?)(</td></tr>)`, "u");
        return current.replace(rowPattern, (_row, start: string, cell: string, end: string) => {
            const value = escapeHtml(link.value);
            const valuePattern = new RegExp(`(^|>)${escapeRegExp(value)}(?=<|$)`, "gu");
            const href = `/${escapeAttribute(link.targetPath)}`;
            return `${start}${cell.replace(valuePattern, `$1<a class="forma-frontmatter-link" href="${href}">${value}</a>`)}${end}`;
        });
    }, html);
}

function escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
    return escapeHtml(value).replaceAll("'", "&#39;");
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
