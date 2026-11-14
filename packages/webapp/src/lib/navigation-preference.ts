export const navigationStrategies = ["files", "collections"] as const;

export type NavigationStrategy = (typeof navigationStrategies)[number];

const storageKey = "forma.navigation";
const changeEvent = "forma:navigation-strategy-change";

export function readNavigationStrategy(): NavigationStrategy {
    try {
        const stored = window.localStorage.getItem(storageKey);
        if (navigationStrategies.some((strategy) => strategy === stored)) {
            return stored as NavigationStrategy;
        }
    } catch {
        // Navigation remains usable when storage is unavailable.
    }
    return "files";
}

export function writeNavigationStrategy(strategy: NavigationStrategy) {
    try {
        window.localStorage.setItem(storageKey, strategy);
    } catch {
        // Navigation remains usable when storage is unavailable.
    }
    window.dispatchEvent(new Event(changeEvent));
}

/** Notifies when this tab changes the strategy; the stored value stays the single source. */
export function subscribeNavigationStrategy(listener: () => void) {
    window.addEventListener(changeEvent, listener);
    return () => {
        window.removeEventListener(changeEvent, listener);
    };
}
