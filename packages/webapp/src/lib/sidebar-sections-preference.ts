export const sidebarSections = ["files", "workspace"] as const;

export type SidebarSection = (typeof sidebarSections)[number];

const storageKey = "forma.sidebarSections";
const changeEvent = "forma:sidebar-sections-change";

let snapshot: string | undefined;

/**
 * The collapsed sections as a stable snapshot string, such as `"workspace"`, shared by the
 * desktop sidebar and the mobile drawer. Every section starts expanded; only the ones the reader
 * collapsed are remembered. The value lives in memory, so it works without storage.
 */
export function readCollapsedSidebarSections(): string {
    snapshot ??= readStoredSnapshot();
    return snapshot;
}

export function collapsedSidebarSections(value: string): ReadonlySet<SidebarSection> {
    const names = value.split(",");
    return new Set(sidebarSections.filter((section) => names.includes(section)));
}

export function toggleSidebarSection(section: SidebarSection) {
    const collapsed = new Set(collapsedSidebarSections(readCollapsedSidebarSections()));
    if (!collapsed.delete(section)) collapsed.add(section);
    const next = sidebarSections.filter((candidate) => collapsed.has(candidate));
    snapshot = next.join(",");
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
        // The choice still lasts for this page when storage is unavailable.
    }
    window.dispatchEvent(new Event(changeEvent));
}

/** Notifies when this tab changes the sections, so every sidebar instance agrees. */
export function subscribeSidebarSections(listener: () => void) {
    window.addEventListener(changeEvent, listener);
    return () => {
        window.removeEventListener(changeEvent, listener);
    };
}

/** For tests: forget the in-memory value so the next read consults storage again. */
export function resetSidebarSectionsForTest() {
    snapshot = undefined;
}

function readStoredSnapshot() {
    try {
        const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(stored)) return sidebarSections.filter((section) => stored.includes(section)).join(",");
    } catch {
        // Unavailable or malformed storage leaves every section expanded.
    }
    return "";
}
