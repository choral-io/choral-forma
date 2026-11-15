export const sidebarSections = ["pages", "workspace"] as const;

export type SidebarSection = (typeof sidebarSections)[number];

const storageKey = "forma.sidebarSections";

/** Every section starts expanded; only the ones the reader collapsed are remembered. */
export function readCollapsedSidebarSections(): Set<SidebarSection> {
    try {
        const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(stored)) {
            return new Set(sidebarSections.filter((section) => stored.includes(section)));
        }
    } catch {
        // The sections stay usable when storage is unavailable or holds something else.
    }
    return new Set();
}

export function writeCollapsedSidebarSections(collapsed: ReadonlySet<SidebarSection>) {
    try {
        window.localStorage.setItem(
            storageKey,
            JSON.stringify(sidebarSections.filter((section) => collapsed.has(section))),
        );
    } catch {
        // The sections stay usable when storage is unavailable.
    }
}
