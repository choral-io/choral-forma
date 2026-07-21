import type { InspectResult } from "@choral-forma/shared";

import type { PreviewBodyLink } from "./markdown-enhancer.ts";
import { scanReferenceTokens, wikilinkDisplayLabel, type ReferenceToken } from "./reference-token.ts";

export type DocumentReferenceDiagnostic = {
    start: number;
    end: number;
    code: string;
    message: string;
};

export function previewBodyLinks(text: string, inspected: InspectResult | undefined): PreviewBodyLink[] {
    if (!inspected) return [];
    const references = new Map<string, NonNullable<InspectResult["entry"]["refs"]>[number][]>();
    for (const reference of inspected.entry.refs ?? []) {
        if (reference.source !== "body" || !reference.rawTarget) continue;
        const key = referenceKey(reference.intent, reference.rawTarget);
        const values = references.get(key) ?? [];
        values.push(reference);
        references.set(key, values);
    }

    return scanReferenceTokens(text)
        .filter((token) => token.syntax === "wikilink" && token.raw)
        .slice(0, 25)
        .flatMap((token): PreviewBodyLink[] => {
            const reference = references.get(referenceKey(token.intent, rawTarget(token)))?.shift();
            if (!reference || !token.raw) return [];
            return [
                {
                    raw: token.raw,
                    label: wikilinkDisplayLabel(token, reference.resolvedTitle),
                    targetPath: reference.targetPath,
                    ...(token.fragment ? { fragment: token.fragment } : {}),
                },
            ];
        });
}

export function documentReferenceDiagnostics(
    text: string,
    inspected: InspectResult | undefined,
): DocumentReferenceDiagnostic[] {
    if (!inspected) return [];
    const tokens = new Map<string, ReferenceToken[]>();
    for (const token of scanReferenceTokens(text).slice(0, 25)) {
        const key = rawTarget(token);
        const values = tokens.get(key) ?? [];
        values.push(token);
        tokens.set(key, values);
    }

    return (inspected.diagnostics ?? []).flatMap((diagnostic): DocumentReferenceDiagnostic[] => {
        if (!diagnostic.code.startsWith("entryRef.") || diagnostic.location?.kind !== "body") return [];
        if (typeof diagnostic.actual !== "string") return [];
        const token = tokens.get(diagnostic.actual)?.shift();
        return token
            ? [{ start: token.start, end: token.end, code: diagnostic.code, message: diagnostic.message }]
            : [];
    });
}

function referenceKey(intent: ReferenceToken["intent"], target: string): string {
    return `${intent}\0${target}`;
}

function rawTarget(token: ReferenceToken): string {
    return token.fragment ? `${token.target}#${token.fragment}` : token.target;
}
