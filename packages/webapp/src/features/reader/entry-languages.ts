import type { DashboardEntry } from "@/data/workspace-client";

const CANONICAL_ENTRY_LANGUAGE = "en";

export function entrySupportedLanguages(entry: Pick<DashboardEntry, "variants">) {
    const languages = [CANONICAL_ENTRY_LANGUAGE];

    for (const variant of entry.variants) {
        if (!languages.includes(variant.language)) {
            languages.push(variant.language);
        }
    }

    return languages;
}

export function formatEntrySupportedLanguages(entry: Pick<DashboardEntry, "variants">) {
    return entrySupportedLanguages(entry).join(", ");
}
