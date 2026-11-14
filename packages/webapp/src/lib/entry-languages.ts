import type { DashboardEntry } from "@/data/workspace-client";

/** Used when the read model does not report the workspace's canonical language. */
export const fallbackCanonicalLanguage = "en";

type LanguageEntry = Pick<DashboardEntry, "path" | "routePath" | "variants">;

/** Paths of entries that are another entry's language variant rather than documents of their own. */
export function languageVariantPaths(entries: readonly Pick<DashboardEntry, "variants">[]) {
    return new Set(entries.flatMap((entry) => entry.variants.map((variant) => variant.path)));
}

/** Entries in the canonical language: one per document, whatever variants it has. */
export function canonicalEntries<T extends Pick<DashboardEntry, "path" | "variants">>(entries: readonly T[]): T[] {
    const variantPaths = languageVariantPaths(entries);
    return entries.filter((entry) => !variantPaths.has(entry.path));
}

/** The canonical route for a variant's route; any other route is returned unchanged. */
export function canonicalEntryRoutePath(entries: readonly LanguageEntry[], routePath: string) {
    return (
        entries.find((entry) => entry.variants.some((variant) => variant.routePath === routePath))?.routePath ??
        routePath
    );
}

/** The canonical entry that owns `path`, which is the entry itself unless `path` is a variant. */
export function canonicalEntryFor<T extends LanguageEntry>(entries: readonly T[], path: string): T | undefined {
    return (
        entries.find((entry) => entry.variants.some((variant) => variant.path === path)) ??
        entries.find((entry) => entry.path === path)
    );
}

export interface EntryLanguageVersion {
    current: boolean;
    language: string;
    routePath: string;
}

/**
 * Every language version of the document that `entry` belongs to, canonical first.
 * A variant reports the same versions as its canonical entry, so both pages offer the same switch.
 */
export function entryLanguageVersions(
    entries: readonly LanguageEntry[],
    entry: LanguageEntry,
    canonicalLanguage = fallbackCanonicalLanguage,
): EntryLanguageVersion[] {
    const canonical = canonicalEntryFor(entries, entry.path) ?? entry;
    return [
        { current: canonical.path === entry.path, language: canonicalLanguage, routePath: canonical.routePath },
        ...canonical.variants.map((variant) => ({
            current: variant.path === entry.path,
            language: variant.language,
            routePath: variant.routePath,
        })),
    ];
}
