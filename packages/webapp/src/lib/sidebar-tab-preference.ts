export const sidebarTabs = ["files", "workspace"] as const;

export type SidebarTab = (typeof sidebarTabs)[number];

const storageKey = "forma.sidebarTab";
const changeEvent = "forma:sidebar-tab-change";

/** The sidebar opens on Files; only an explicit choice of another tab is remembered. */
export function readSidebarTab(): SidebarTab {
    try {
        const stored = window.localStorage.getItem(storageKey);
        const tab = sidebarTabs.find((candidate) => candidate === stored);
        if (tab) return tab;
    } catch {
        // The sidebar stays usable when storage is unavailable.
    }
    return "files";
}

export function writeSidebarTab(tab: SidebarTab) {
    try {
        window.localStorage.setItem(storageKey, tab);
    } catch {
        // The sidebar stays usable when storage is unavailable.
    }
    window.dispatchEvent(new Event(changeEvent));
}

/** Notifies when this tab changes the choice, so the desktop sidebar and the mobile drawer agree. */
export function subscribeSidebarTab(listener: () => void) {
    window.addEventListener(changeEvent, listener);
    return () => {
        window.removeEventListener(changeEvent, listener);
    };
}
