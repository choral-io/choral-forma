import { Lexer, type MarkedExtension } from "marked";

const escapeHtml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const tag = /^\s*<\/?(?:details|summary)(?=[\s/>])/i;
const blank = (text: string | undefined) => text !== undefined && /^[ \t]*$/.test(text);
const authoredTags = /<\/?(?:details|summary)(?=[\s/>])[^>]*>/gi;

function decodeTitle(source: string) {
    if (!source.includes("&")) return source;
    const decoder = document.createElement("span");
    const decoded = source.replace(/&(?:#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]+);/g, (entity) => {
        if (entity.length > 41) return entity;
        decoder.innerHTML = `<span data-value="${entity}"></span>`;
        const value = decoder.firstElementChild?.getAttribute("data-value") ?? entity;
        // A partial legacy match leaves a suffix and the original semicolon.
        // Complete named references cannot end in ASCII semicolon except &semi;.
        return value.endsWith(";") && value !== ";" ? entity : value;
    });
    return decoded;
}

interface HtmlRange {
    start: number;
    end: number;
    portable: boolean;
}
interface DisclosureTag {
    start: number;
    name: string;
    closing: boolean;
    portable: boolean;
}
const htmlBoundary = (char: string | undefined) => char === undefined || /[ \t\r\n\f/>]/.test(char);
// Noscript is deliberately opaque in both scripting modes; it is outside the
// portable Markdown subset. Plaintext, unlike the paired raw-text elements,
// consumes the rest of the source even if an apparent closing tag is present.
const rawTextTags = new Set([
    "script",
    "style",
    "pre",
    "textarea",
    "title",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
    "noscript",
]);
const voidTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

// This scanner only guards recognition: it never renders or enables authored HTML.
// Quote-aware tag spans may cross Markdown token/line boundaries. Code, comments
// and raw-text examples cannot supply structural disclosure delimiters.
function scanDisclosureTags(source: string, ranges: HtmlRange[]) {
    const lower = source.replace(/[A-Z]/g, (char) => char.toLowerCase());
    const tags: DisclosureTag[] = [];
    const containers: string[] = [];
    const templateScopes: number[] = [];
    const parseTagTail = (start: number) => {
        let state:
            | "beforeName"
            | "name"
            | "afterName"
            | "beforeValue"
            | "quoted"
            | "unquoted"
            | "afterQuoted"
            | "selfClosing" = "beforeName";
        let quote: string | undefined;
        for (let i = start; i < source.length; i++) {
            const char = source[i];
            const space = char !== undefined && /[ \t\r\n\f]/.test(char);
            switch (state) {
                case "beforeName":
                case "afterName":
                    if (space) continue;
                    if (char === ">") return { end: i + 1, selfClosing: false };
                    if (char === "/") state = "selfClosing";
                    else if (char === "=" && state === "afterName") state = "beforeValue";
                    else state = "name";
                    break;
                case "name":
                    if (space) state = "afterName";
                    else if (char === ">") return { end: i + 1, selfClosing: false };
                    else if (char === "/") state = "selfClosing";
                    else if (char === "=") state = "beforeValue";
                    break;
                case "beforeValue":
                    if (space) continue;
                    if (char === '"' || char === "'") {
                        quote = char;
                        state = "quoted";
                    } else if (char === ">") return { end: i + 1, selfClosing: false };
                    else state = "unquoted";
                    break;
                case "quoted":
                    if (char === quote) state = "afterQuoted";
                    break;
                case "unquoted":
                    if (space) state = "beforeName";
                    else if (char === ">") return { end: i + 1, selfClosing: false };
                    break;
                case "afterQuoted":
                case "selfClosing":
                    if (char === ">") return { end: i + 1, selfClosing: state === "selfClosing" };
                    state = space ? "beforeName" : char === "/" ? "selfClosing" : "name";
                    break;
            }
        }
        return { end: source.length, selfClosing: false };
    };
    const tagEnd = (start: number) => parseTagTail(start).end;
    // Script data has escaped and double-escaped states. In the latter, an
    // apparent end tag only returns to escaped data; it does not close script.
    const scriptEnd = (start: number) => {
        let escaped = false,
            doubleEscaped = false,
            i = start;
        while (i < source.length) {
            if (escaped && source.startsWith("-->", i)) {
                escaped = false;
                doubleEscaped = false;
                i += 3;
                continue;
            }
            if (!escaped && source.startsWith("<!--", i)) {
                escaped = true;
                i += 2;
                continue; // Keep the dashes for an abrupt <!--> exit.
            }
            if (escaped && !doubleEscaped && lower.startsWith("<script", i) && htmlBoundary(source[i + 7])) {
                doubleEscaped = true;
                i += 7;
                continue;
            }
            if (lower.startsWith("</script", i) && htmlBoundary(source[i + 8])) {
                if (doubleEscaped) {
                    doubleEscaped = false;
                    i += 8;
                    continue;
                }
                return tagEnd(i + 8);
            }
            i++;
        }
        return source.length;
    };
    let cursor = 0;
    for (const range of ranges) {
        cursor = Math.max(cursor, range.start);
        while (cursor < range.end) {
            const start = source.indexOf("<", cursor);
            if (start < 0 || start >= range.end) {
                cursor = range.end;
                break;
            }
            if (
                source.startsWith("<!--", start) ||
                source.startsWith("<![CDATA[", start) ||
                source.startsWith("<?", start)
            ) {
                const delimiter = source.startsWith("<!--", start)
                    ? "-->"
                    : source.startsWith("<?", start)
                      ? "?>"
                      : "]]>";
                const end = source.indexOf(delimiter, start + 2);
                cursor = end < 0 ? source.length : end + delimiter.length;
                continue;
            }
            if (source.startsWith("<!", start)) {
                const end = source.indexOf(">", start + 2);
                cursor = end < 0 ? source.length : end + 1;
                continue;
            }
            const closing = source[start + 1] === "/";
            const nameStart = start + (closing ? 2 : 1);
            const name = /^[a-z][^ \t\r\n\f/>]*/.exec(lower.slice(nameStart))?.[0];
            if (!name) {
                if (closing) {
                    const end = source.indexOf(">", nameStart);
                    cursor = end < 0 ? source.length : end + 1;
                } else cursor = nameStart;
                continue;
            }
            const tail = parseTagTail(nameStart + name.length);
            const end = tail.end;
            const selfClosingForeign =
                tail.selfClosing &&
                (name === "svg" || name === "math" || containers.some((name) => name === "svg" || name === "math"));
            const portable = range.portable && containers.length === 0;
            if (!closing && !selfClosingForeign && name === "plaintext") {
                cursor = source.length;
                continue;
            }
            if (!closing && !selfClosingForeign && rawTextTags.has(name)) {
                if (name === "script") {
                    cursor = scriptEnd(end);
                    continue;
                }
                let close = lower.indexOf(`</${name}`, end);
                while (close >= 0 && !htmlBoundary(source[close + name.length + 2]))
                    close = lower.indexOf(`</${name}`, close + 2);
                cursor = close < 0 ? source.length : tagEnd(close + name.length + 2);
                continue;
            }
            const templateScope = templateScopes.at(-1) ?? -1;
            if (name === "details" && templateScope < 0) tags.push({ start, name, closing, portable });
            else if (name === "summary" && !closing) {
                const lineStart = source.lastIndexOf("\n", start - 1) + 1;
                const newline = source.indexOf("\n", start);
                const lineEnd = newline < 0 ? source.length : newline;
                if (portable && /^ {0,3}<summary>[^\n]*<\/summary>[ \t]*$/i.test(source.slice(lineStart, lineEnd))) {
                    tags.push({ start, name, closing, portable });
                    cursor = lineEnd;
                    continue;
                }
            }
            if (name !== "details" && !voidTags.has(name)) {
                if (closing) {
                    const index = containers.lastIndexOf(name);
                    if (index >= 0 && index >= templateScope) {
                        containers.length = index;
                        while ((templateScopes.at(-1) ?? -1) >= index) templateScopes.pop();
                    }
                } else {
                    if (!selfClosingForeign) {
                        if (name === "template") templateScopes.push(containers.length);
                        containers.push(name);
                    }
                }
            }
            cursor = end;
        }
    }
    return tags;
}

export function prepareDisclosures(markdown: string) {
    const source = markdown.replace(/\r\n?/g, "\n");
    if (!/<\/?(?:details|summary)\b/i.test(source)) return { source, replacements: [] as [string, string][] };
    let offset = 0;
    const html: HtmlRange[] = [];
    for (const token of Lexer.lex(source, { gfm: true })) {
        if (token.type === "html")
            html.push({
                start: offset,
                end: offset + token.raw.length,
                portable: tag.test(token.raw),
            });
        offset += token.raw.length;
    }
    offset = 0;
    const lines = source.split(/(?<=\n)/).map((raw) => {
        const line = { start: offset, raw, text: raw.replace(/\n$/, "") };
        offset += raw.length;
        return line;
    });
    const events = scanDisclosureTags(source, html);
    const summaries = new Set(
        events.filter((event) => event.name === "summary" && event.portable).map((event) => event.start),
    );
    const lineAt = (point: number) => {
        let low = 0,
            high = lines.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if ((lines[middle]?.start ?? Infinity) <= point) low = middle + 1;
            else high = middle;
        }
        return low - 1;
    };
    interface Frame {
        start: number;
        headerEnd: number;
        title: string;
        open: boolean;
        valid: boolean;
        closed: boolean;
        end: number;
        parent?: number;
    }
    const frames: Frame[] = [];
    const stack: number[] = [];
    for (const event of events) {
        if (event.name !== "details") continue;
        const i = lineAt(event.start);
        const line = lines[i];
        if (!line) continue;
        const text = line.text;
        const ownLine = event.start === line.start + text.search(/[^ \t]/);
        if (!event.closing) {
            let summary = i + 1;
            while (blank(lines[summary]?.text)) summary++;
            const label = /^ {0,3}<summary>([^\n]*)<\/summary>[ \t]*$/i.exec(lines[summary]?.text ?? "");
            const opening = /^ {0,3}<details(?:[ \t]+(open))?[ \t]*>[ \t]*$/i.exec(text);
            const title = decodeTitle(label?.[1] ?? "").replace(/^[\s\u0085]+|[\s\u0085]+$/g, "");
            const valid =
                event.portable &&
                ownLine &&
                !!opening &&
                !!title &&
                summaries.has((lines[summary]?.start ?? -1) + (lines[summary]?.text.search(/[^ \t]/) ?? -1)) &&
                blank(lines[summary + 1]?.text) &&
                stack.length < 16;
            frames.push({
                start: i,
                headerEnd: summary,
                title,
                open: !!opening?.[1],
                valid,
                closed: false,
                end: i,
                parent: stack.at(-1),
            });
            stack.push(frames.length - 1);
        } else {
            const index = stack.pop();
            if (index === undefined) continue;
            const frame = frames[index];
            if (!frame) continue;
            frame.valid &&= event.portable && ownLine && /^ {0,3}<\/details>[ \t]*$/i.test(text);
            frame.closed = true;
            frame.end = i;
            if (!frame.valid) {
                const parent = frames[stack.at(-1) ?? -1];
                if (parent) parent.valid = false;
            }
        }
    }
    let prefix = "FORMAREADERDISCLOSURE";
    const decoded = source.replace(
        /&#(?:[xX]([0-9a-fA-F]+)|([0-9]+));/g,
        (raw, hex: string | undefined, decimal: string | undefined) => {
            const value = Number.parseInt(hex ?? decimal ?? "", hex ? 16 : 10);
            return value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : raw;
        },
    );
    while (source.includes(prefix) || decoded.includes(prefix)) prefix += "X";
    const replacements: [string, string][] = [];
    const edits: [number, number, string][] = [];
    for (const [index, frame] of frames.entries()) {
        let valid = frame.valid && frame.closed;
        let ancestor = frame.parent;
        while (ancestor !== undefined) {
            const parent = frames[ancestor];
            if (!parent || !parent.valid || !parent.closed) {
                valid = false;
                break;
            }
            ancestor = parent.parent;
        }
        if (!valid) continue;
        const start = lines[frame.start],
            header = lines[frame.headerEnd],
            end = lines[frame.end];
        if (!start || !header || !end) continue;
        const openMarker = `:${prefix}${String(index)}OPEN:`,
            closeMarker = `:${prefix}${String(index)}CLOSE:`;
        replacements.push([
            `<p>${openMarker}</p>`,
            `<details class="collapse collapse-arrow my-4 border border-base-300 bg-base-100" data-markdown-disclosure=""${frame.open ? " open" : ""}><summary class="collapse-title min-h-0 py-3 ps-4 pe-12 leading-relaxed break-words">${escapeHtml(frame.title)}</summary><div class="collapse-content min-w-0">`,
        ]);
        replacements.push([`<p>${closeMarker}</p>`, "</div></details>"]);
        edits.push(
            [start.start, header.start + header.raw.length, `\n\n${openMarker}\n\n`],
            [end.start, end.start + end.raw.length, `\n\n${closeMarker}\n\n`],
        );
    }
    let prepared = source;
    for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0]))
        prepared = prepared.slice(0, start) + value + prepared.slice(end);
    return { source: prepared, replacements };
}

export function restoreDisclosures(html: string, replacements: [string, string][]) {
    for (const [marker, replacement] of replacements) html = html.replaceAll(marker, replacement);
    return html;
}

export const markedDisclosureSafety: MarkedExtension = {
    renderer: {
        html(token) {
            const safe = token.text.replace(authoredTags, escapeHtml);
            return safe === token.text ? false : safe;
        },
    },
};
