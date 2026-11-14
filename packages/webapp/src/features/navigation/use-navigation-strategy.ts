import { useSyncExternalStore } from "react";

import {
    readNavigationStrategy,
    subscribeNavigationStrategy,
    writeNavigationStrategy,
    type NavigationStrategy,
} from "@/lib/navigation-preference";

/** The reader's navigation strategy, shared by every part of the shell that follows it. */
export function useNavigationStrategy(): [NavigationStrategy, (strategy: NavigationStrategy) => void] {
    const strategy = useSyncExternalStore(subscribeNavigationStrategy, readNavigationStrategy);
    return [strategy, writeNavigationStrategy];
}
