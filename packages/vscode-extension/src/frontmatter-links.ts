import type { IndexReference, InspectEntry, InspectResult } from "@choral-forma/shared";

import type { FrontmatterLink } from "./markdown-enhancer.ts";
import type { FrontmatterReferenceValue } from "./reference-token.ts";

export function frontmatterLinks(entry: InspectEntry | undefined): FrontmatterLink[] {
    if (!entry?.metadata) return [];
    return (entry.refs ?? []).flatMap((reference) => frontmatterLink(entry.metadata ?? {}, reference));
}

export function frontmatterReferenceValues(result: InspectResult | undefined): FrontmatterReferenceValue[] {
    if (!result) return [];
    const values = frontmatterLinks(result.entry).map(({ field, value }) => ({ field, value }));
    for (const diagnostic of result.diagnostics ?? []) {
        if (!diagnostic.code.startsWith("entryRef.") || diagnostic.location?.kind !== "frontmatter") continue;
        const metadataValue = valueAtPath(result.entry.metadata ?? {}, diagnostic.location.field);
        const value =
            diagnostic.location.index === undefined
                ? metadataValue
                : Array.isArray(metadataValue)
                  ? (metadataValue as unknown[])[diagnostic.location.index]
                  : undefined;
        if (typeof value === "string") values.push({ field: diagnostic.location.field, value });
    }
    return [...new Map(values.map((value) => [`${value.field}\0${value.value}`, value])).values()];
}

function frontmatterLink(metadata: Record<string, unknown>, reference: IndexReference): FrontmatterLink[] {
    if (reference.source !== "frontmatter" || !reference.field) return [];
    const values = flattenStrings(valueAtPath(metadata, reference.field));
    const normalizedTarget = withoutMarkdownExtension(reference.targetPath);
    const value = values.find((candidate) => withoutMarkdownExtension(candidate) === normalizedTarget);
    return value ? [{ field: reference.field, value, targetPath: reference.targetPath }] : [];
}

function valueAtPath(value: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((current, segment) => {
        return typeof current === "object" && current !== null && !Array.isArray(current)
            ? (current as Record<string, unknown>)[segment]
            : undefined;
    }, value);
}

function flattenStrings(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(flattenStrings);
    return [];
}

function withoutMarkdownExtension(value: string): string {
    return value.replace(/\.md$/u, "");
}
