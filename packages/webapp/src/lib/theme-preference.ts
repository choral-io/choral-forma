export const themePreferences = ["system", "choral-light", "choral-dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];

const storageKey = "forma.theme";
export const themePreferenceChangeEvent = "forma:theme-preference-change";

export function getNextThemePreference(preference: ThemePreference): ThemePreference {
    const currentIndex = themePreferences.indexOf(preference);
    return themePreferences[(currentIndex + 1) % themePreferences.length] ?? "system";
}

export function readThemePreference(): ThemePreference {
    try {
        const stored = window.localStorage.getItem(storageKey);
        if (themePreferences.some((preference) => preference === stored)) {
            return stored as ThemePreference;
        }
    } catch {
        // Theme selection remains usable when storage is unavailable.
    }
    return "system";
}

export function applyThemePreference(preference: ThemePreference, persist = true) {
    if (preference === "system") {
        delete document.documentElement.dataset.theme;
    } else {
        document.documentElement.dataset.theme = preference;
    }

    window.dispatchEvent(new Event(themePreferenceChangeEvent));

    if (!persist) return;
    try {
        window.localStorage.setItem(storageKey, preference);
    } catch {
        // Theme selection remains usable when storage is unavailable.
    }
}
