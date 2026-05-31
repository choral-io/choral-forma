import { useSyncExternalStore } from "react";

export type ContextPanelTabValue = "context" | "outline";

let currentTab: ContextPanelTabValue = "context";
const listeners = new Set<() => void>();

export function setContextPanelTab(value: ContextPanelTabValue) {
    if (currentTab === value) {
        return;
    }

    currentTab = value;
    for (const listener of listeners) {
        listener();
    }
}

export function useContextPanelTab() {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },
        () => currentTab,
        () => "context",
    );
}
