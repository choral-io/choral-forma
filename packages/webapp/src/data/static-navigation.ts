export interface StaticNavigationTarget {
    href: string;
    pathname: string;
}

export interface StaticNavigationIntent {
    kind: "push" | "pop";
    target: StaticNavigationTarget;
    commit?: () => void | Promise<void>;
}

export type StaticNavigationState =
    { status: "pending"; intent: StaticNavigationIntent } | { status: "failed"; intent: StaticNavigationIntent };

export function createStaticNavigation(prepare: (pathname: string) => Promise<unknown>) {
    let state: StaticNavigationState | undefined;
    let token = 0;
    const listeners = new Set<() => void>();

    function publish(next: StaticNavigationState | undefined) {
        state = next;
        for (const listener of listeners) listener();
    }

    function cancel() {
        token++;
        publish(undefined);
    }

    async function begin(intent: StaticNavigationIntent) {
        if (
            state?.status === "pending" &&
            state.intent.kind === intent.kind &&
            state.intent.target.href === intent.target.href
        ) {
            return false;
        }
        const attempt = ++token;
        publish({ status: "pending", intent });
        try {
            await prepare(intent.target.pathname);
            if (token !== attempt) return false;
            await intent.commit?.();
            if (token !== attempt) return false;
            publish(undefined);
            return true;
        } catch {
            if (token === attempt) publish({ status: "failed", intent });
            return false;
        }
    }

    function subscribe(listener: () => void) {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }

    return {
        start: begin,
        cancel,
        getSnapshot: () => state,
        retry: () => (state?.status === "failed" ? begin(state.intent) : Promise.resolve(false)),
        subscribe,
    };
}
