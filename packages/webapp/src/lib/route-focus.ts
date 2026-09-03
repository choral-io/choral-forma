import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

/**
 * Moves keyboard focus to the heading that owns the current route's content.
 *
 * Route components load lazily, so the shell cannot locate the heading itself:
 * when a route changes, the new content is suspended for at least one frame. The
 * heading therefore claims focus as it mounts, comparing the route and element it
 * renders for against what was focused last. Effects run child-first, so the shell
 * cannot arm this either — the decision has to belong to the heading.
 */
let activeTarget: HTMLElement | null = null;
let focusedTarget: HTMLElement | null = null;
let focusedPathname: string | undefined;
let hasRenderedRoute = false;

/**
 * Claims focus unless this heading already holds it for this route. The path alone
 * cannot decide that: a route in between may render no heading at all, such as an
 * error boundary, which tears the previous heading down. Comparing the element too
 * makes returning to that path focus the heading that replaced it. The first route
 * of a session is recorded without focusing, so an initial load leaves focus where
 * the browser put it.
 */
export function claimRouteContentFocus(element: HTMLElement | null, pathname: string) {
    if (!element) return;
    activeTarget = element;

    if (!hasRenderedRoute) {
        hasRenderedRoute = true;
        focusedPathname = pathname;
        focusedTarget = element;
        return;
    }

    if (focusedPathname === pathname && focusedTarget === element && element.isConnected) return;
    focusedPathname = pathname;
    focusedTarget = element;
    element.focus();
}

/** Focus the current route heading without a route change, such as after a drawer closes. */
export function requestRouteContentFocus() {
    if (activeTarget?.isConnected) {
        activeTarget.focus();
    }
}

export function resetRouteContentFocus() {
    activeTarget = null;
    focusedTarget = null;
    focusedPathname = undefined;
    hasRenderedRoute = false;
}

/**
 * Marks an element as the current route's focus target. This runs after every
 * render so a route that keeps the same heading element mounted, such as moving
 * between two pages, still claims focus for the new route.
 */
export function useRouteContentFocusTarget<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const { pathname } = useLocation();

    useEffect(() => {
        claimRouteContentFocus(ref.current, pathname);
    });

    return ref;
}
