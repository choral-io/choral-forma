export type ReferenceToken = {
    start: number;
    end: number;
    target: string;
    fragment?: string;
    intent: "reference" | "link" | "embed";
    syntax: "markdown" | "wikilink" | "frontmatter";
    raw?: string;
    label?: string;
    explicitLabel?: boolean;
    labelStart?: number;
    labelEnd?: number;
};

export type FrontmatterReferenceValue = {
    field: string;
    value: string;
};

export function referenceTokenAt(
    text: string,
    offset: number,
    frontmatterReferences: readonly FrontmatterReferenceValue[] = [],
): ReferenceToken | undefined {
    for (const token of [
        ...scanReferenceTokens(text),
        ...scanFrontmatterReferenceTokens(text, frontmatterReferences),
    ]) {
        if (offset >= token.start && offset < token.end) return token;
        if (
            token.labelStart !== undefined &&
            token.labelEnd !== undefined &&
            offset >= token.labelStart &&
            offset < token.labelEnd
        ) {
            return { ...token, start: token.labelStart, end: token.labelEnd };
        }
    }
    return undefined;
}

export function scanReferenceTokens(text: string): ReferenceToken[] {
    const tokens: ReferenceToken[] = [];
    const occupied: Array<[number, number]> = [];
    const ignored = markdownCodeRanges(text);

    for (const match of text.matchAll(/(!?)\[\[([^\]]+)\]\]/gu)) {
        const matchIndex = match.index;
        if (rangeContains(ignored, matchIndex)) continue;
        const content = capture(match, 2);
        const contentStart = match.index + (match[1] ? 3 : 2);
        const rawTarget = content.split("|", 1)[0]?.trim() ?? "";
        const explicitLabel = content.includes("|");
        const rawLabel = explicitLabel ? (content.split("|", 2)[1] ?? "") : undefined;
        const label = explicitLabel ? (rawLabel?.trim() ?? rawTarget) : rawTarget;
        const rawOffset = content.indexOf(rawTarget);
        const labelLeading = rawLabel === undefined ? 0 : rawLabel.length - rawLabel.trimStart().length;
        const labelStart = explicitLabel ? contentStart + content.indexOf("|") + 1 + labelLeading : undefined;
        const labelEnd = labelStart === undefined ? undefined : labelStart + label.length;
        const { target, fragment } = splitFragment(rawTarget);
        const token = withOptionalFragment(
            {
                start: contentStart + Math.max(0, rawOffset),
                end: contentStart + Math.max(0, rawOffset) + rawTarget.length,
                target,
                intent: match[1] ? "embed" : "link",
                syntax: "wikilink",
                raw: match[0],
                label,
                ...(explicitLabel ? { explicitLabel: true } : {}),
                ...(labelStart !== undefined && labelEnd !== undefined && labelStart < labelEnd
                    ? { labelStart, labelEnd }
                    : {}),
            },
            fragment,
        );
        tokens.push(token);
        occupied.push([matchIndex, matchIndex + match[0].length]);
    }

    for (const match of text.matchAll(/(!?)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/gu)) {
        const matchIndex = match.index;
        const matchedTarget = capture(match, 2);
        if (rangeContains(ignored, matchIndex) || rangeContains(occupied, matchIndex)) {
            continue;
        }
        const targetStart = matchIndex + match[0].indexOf(matchedTarget);
        const rawTarget = stripAngleBrackets(matchedTarget);
        if (/^[a-z][a-z0-9+.-]*:/iu.test(rawTarget)) continue;
        const { target, fragment } = splitFragment(rawTarget);
        tokens.push(
            withOptionalFragment(
                {
                    start: targetStart,
                    end: targetStart + matchedTarget.length,
                    target,
                    intent: match[1] ? "embed" : "link",
                    syntax: "markdown",
                },
                fragment,
            ),
        );
    }

    return tokens.sort((left, right) => left.start - right.start);
}

export function wikilinkDisplayLabel(token: ReferenceToken, targetTitle: string | undefined): string {
    if (token.explicitLabel && token.label) return token.label;
    if (targetTitle) return token.fragment ? `${targetTitle} › ${token.fragment}` : targetTitle;
    return token.label ?? token.target;
}

function markdownCodeRanges(text: string): Array<[number, number]> {
    const ranges = fencedCodeRanges(text);
    let cursor = 0;
    while (cursor < text.length) {
        if (rangeContains(ranges, cursor)) {
            cursor = rangeEndContaining(ranges, cursor);
            continue;
        }
        if (text[cursor] !== "`") {
            cursor += 1;
            continue;
        }
        const openingStart = cursor;
        while (text[cursor] === "`") cursor += 1;
        const marker = "`".repeat(cursor - openingStart);
        let closingStart = text.indexOf(marker, cursor);
        while (closingStart >= 0 && (text[closingStart - 1] === "`" || text[closingStart + marker.length] === "`")) {
            closingStart = text.indexOf(marker, closingStart + marker.length);
        }
        if (closingStart < 0) continue;
        const closingEnd = closingStart + marker.length;
        ranges.push([openingStart, closingEnd]);
        cursor = closingEnd;
    }
    return ranges.sort((left, right) => left[0] - right[0]);
}

function fencedCodeRanges(text: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    const linePattern = /(^|\n)( {0,3})(`{3,}|~{3,})[^\n]*(?:\n|$)/gu;
    let opening: { start: number; marker: string } | undefined;
    for (const match of text.matchAll(linePattern)) {
        const marker = capture(match, 3);
        const lineStart = match.index + capture(match, 1).length;
        if (!opening) {
            opening = { start: lineStart, marker };
            continue;
        }
        if (!marker.startsWith(opening.marker.slice(0, 1)) || marker.length < opening.marker.length) continue;
        ranges.push([opening.start, match.index + match[0].length]);
        opening = undefined;
    }
    if (opening) ranges.push([opening.start, text.length]);
    return ranges;
}

function rangeContains(ranges: Array<[number, number]>, offset: number): boolean {
    return ranges.some(([start, end]) => offset >= start && offset < end);
}

function rangeEndContaining(ranges: Array<[number, number]>, offset: number): number {
    return ranges.find(([start, end]) => offset >= start && offset < end)?.[1] ?? offset + 1;
}

function scanFrontmatterReferenceTokens(
    text: string,
    references: readonly FrontmatterReferenceValue[],
): ReferenceToken[] {
    if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return [];
    const closing = text.indexOf("\n---", 4);
    if (closing < 0) return [];
    const tokens: ReferenceToken[] = [];
    const seen = new Set<string>();
    for (const reference of references) {
        for (const [start, end] of frontmatterFieldRanges(text, closing, reference.field)) {
            let valueStart = text.indexOf(reference.value, start);
            while (valueStart >= 0 && valueStart < end) {
                const valueEnd = valueStart + reference.value.length;
                const key = `${String(valueStart)}:${String(valueEnd)}`;
                if (!seen.has(key) && hasYamlValueBoundaries(text, valueStart, valueEnd)) {
                    seen.add(key);
                    const { target, fragment } = splitFragment(reference.value);
                    tokens.push(
                        withOptionalFragment(
                            {
                                start: valueStart,
                                end: valueEnd,
                                target,
                                intent: "reference",
                                syntax: "frontmatter",
                            },
                            fragment,
                        ),
                    );
                }
                valueStart = text.indexOf(reference.value, valueEnd);
            }
        }
    }
    return tokens.sort((left, right) => left.start - right.start);
}

function frontmatterFieldRanges(text: string, closing: number, fieldPath: string): Array<[number, number]> {
    const field = fieldPath.split(".").at(-1);
    if (!field) return [];
    const lines = text.slice(0, closing).split(/(?<=\n)/u);
    const ranges: Array<[number, number]> = [];
    let offset = 0;
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const match = /^(\s*)([\w.-]+):/u.exec(line);
        const lineStart = offset;
        offset += line.length;
        if (match?.[2] !== field) continue;
        const indentation = match[1]?.length ?? 0;
        let rangeEnd = closing;
        let nextOffset = offset;
        for (let next = index + 1; next < lines.length; next += 1) {
            const nextLine = lines[next] ?? "";
            const nextField = /^(\s*)([\w.-]+):/u.exec(nextLine);
            if (nextField && (nextField[1]?.length ?? 0) <= indentation) {
                rangeEnd = nextOffset;
                break;
            }
            nextOffset += nextLine.length;
        }
        ranges.push([lineStart, rangeEnd]);
    }
    return ranges;
}

function hasYamlValueBoundaries(text: string, start: number, end: number): boolean {
    const before = text[start - 1];
    const after = text[end];
    return (!before || /[\s[,'":-]/u.test(before)) && (!after || /[\s\],,'"#}]/u.test(after));
}

function capture(match: RegExpMatchArray, index: number): string {
    const value = match[index];
    if (value === undefined) throw new Error(`Missing regular expression capture ${String(index)}.`);
    return value;
}

function splitFragment(value: string): { target: string; fragment?: string } {
    const separator = value.indexOf("#");
    if (separator < 0) return { target: decodeTarget(value) };
    const fragment = decodeTarget(value.slice(separator + 1));
    return fragment
        ? { target: decodeTarget(value.slice(0, separator)), fragment }
        : { target: decodeTarget(value.slice(0, separator)) };
}

function stripAngleBrackets(value: string): string {
    return value.startsWith("<") && value.endsWith(">") ? value.slice(1, -1) : value;
}

function decodeTarget(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function withOptionalFragment(token: Omit<ReferenceToken, "fragment">, fragment: string | undefined): ReferenceToken {
    return fragment ? { ...token, fragment } : token;
}
