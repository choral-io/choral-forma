export type ReferenceToken = {
    start: number;
    end: number;
    target: string;
    fragment?: string;
    intent: "reference" | "link" | "embed";
    syntax: "markdown" | "wikilink" | "frontmatter";
};

export function referenceTokenAt(text: string, offset: number): ReferenceToken | undefined {
    return scanReferenceTokens(text, true).find((token) => offset >= token.start && offset <= token.end);
}

export function scanReferenceTokens(text: string, includeFrontmatter = false): ReferenceToken[] {
    const tokens: ReferenceToken[] = [];
    const occupied: Array<[number, number]> = [];

    for (const match of text.matchAll(/(!?)\[\[([^\]]+)\]\]/gu)) {
        const matchIndex = match.index;
        const content = capture(match, 2);
        const contentStart = match.index + (match[1] ? 3 : 2);
        const rawTarget = content.split("|", 1)[0]?.trim() ?? "";
        const rawOffset = content.indexOf(rawTarget);
        const { target, fragment } = splitFragment(rawTarget);
        const token = withOptionalFragment(
            {
                start: contentStart + Math.max(0, rawOffset),
                end: contentStart + Math.max(0, rawOffset) + rawTarget.length,
                target,
                intent: match[1] ? "embed" : "link",
                syntax: "wikilink",
            },
            fragment,
        );
        tokens.push(token);
        occupied.push([matchIndex, matchIndex + match[0].length]);
    }

    for (const match of text.matchAll(/(!?)\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/gu)) {
        const matchIndex = match.index;
        const matchedTarget = capture(match, 2);
        if (occupied.some(([start, end]) => matchIndex >= start && matchIndex < end)) {
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

    if (includeFrontmatter) tokens.push(...scanFrontmatterTokens(text));
    return tokens.sort((left, right) => left.start - right.start);
}

function scanFrontmatterTokens(text: string): ReferenceToken[] {
    if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return [];
    const closing = text.indexOf("\n---", 4);
    if (closing < 0) return [];
    const tokens: ReferenceToken[] = [];
    const frontmatter = text.slice(0, closing);
    for (const match of frontmatter.matchAll(
        /(?:^|\n)\s*(?:[\w.-]+:\s*|-\s+)["']?([\w./-]+(?:#[^\s"']+)?)['"]?\s*$/gmu,
    )) {
        const matchIndex = match.index;
        const matchedTarget = capture(match, 1);
        const start = matchIndex + match[0].indexOf(matchedTarget);
        const { target, fragment } = splitFragment(matchedTarget);
        tokens.push(
            withOptionalFragment(
                { start, end: start + matchedTarget.length, target, intent: "reference", syntax: "frontmatter" },
                fragment,
            ),
        );
    }
    return tokens;
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
