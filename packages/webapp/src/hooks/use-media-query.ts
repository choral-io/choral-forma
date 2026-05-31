import * as React from "react";

interface UseMediaQueryOptions {
    onChange?: (matches: boolean) => void;
    serverSnapshot?: boolean;
}

export function useMediaQuery(query: string, options: UseMediaQueryOptions = {}) {
    const { onChange, serverSnapshot = false } = options;
    const onChangeRef = React.useRef(onChange);

    React.useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const subscribe = React.useCallback(
        (onStoreChange: () => void) => {
            const mediaQuery = window.matchMedia(query);
            const handleChange = (event: MediaQueryListEvent) => {
                onStoreChange();
                onChangeRef.current?.(event.matches);
            };

            mediaQuery.addEventListener("change", handleChange);

            return () => {
                mediaQuery.removeEventListener("change", handleChange);
            };
        },
        [query],
    );

    const getSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);
    const getServerSnapshot = React.useCallback(() => serverSnapshot, [serverSnapshot]);

    return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
