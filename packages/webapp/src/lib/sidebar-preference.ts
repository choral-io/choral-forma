const storageKey = "forma.sidebar";

/** The desktop sidebar starts open; only an explicit collapse is remembered as closed. */
export function readSidebarOpenPreference(): boolean {
    try {
        return window.localStorage.getItem(storageKey) !== "closed";
    } catch {
        // The sidebar remains usable when storage is unavailable.
        return true;
    }
}

export function writeSidebarOpenPreference(open: boolean) {
    try {
        window.localStorage.setItem(storageKey, open ? "open" : "closed");
    } catch {
        // The sidebar remains usable when storage is unavailable.
    }
}
