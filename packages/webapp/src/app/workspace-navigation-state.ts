import { hasStaticRoute } from "@/data/static-enhancement";
import type { createStaticNavigation, StaticNavigationTarget } from "@/data/static-navigation";
import { canonicalRoutePath } from "@/data/static-route-target";
import { logicalHref, logicalPathname, rootAwareHref } from "@/data/static-runtime";
import { createContext, use, useCallback, useSyncExternalStore, type MouseEvent } from "react";
import { useNavigate } from "react-router";

type WorkspaceNavigation = ReturnType<typeof createStaticNavigation>;

export const WorkspaceNavigationContext = createContext<WorkspaceNavigation | undefined>(undefined);

export function useWorkspaceNavigation() {
    return use(WorkspaceNavigationContext);
}

function noNavigationSnapshot() {
    return undefined;
}

function noNavigationSubscribe() {
    return () => undefined;
}

export function useWorkspaceNavigationState() {
    const navigation = useWorkspaceNavigation();
    return useSyncExternalStore(
        navigation?.subscribe ?? noNavigationSubscribe,
        navigation?.getSnapshot ?? noNavigationSnapshot,
    );
}

export function targetFromPublicUrl(url: URL): StaticNavigationTarget {
    const pathname = canonicalRoutePath(logicalPathname(url.pathname));
    return { pathname, href: `${pathname}${url.search}${url.hash}` };
}

export function samePageDestination(current: URL, target: URL): string | undefined {
    if (current.search === target.search && current.hash === target.hash) return undefined;
    return `${logicalHref(current.pathname)}${target.search}${target.hash}`;
}

export function isPlainLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    const link = event.currentTarget;
    return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !event.metaKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        (!link.target || link.target === "_self") &&
        !link.hasAttribute("download") &&
        !link.rel.split(/\s+/u).includes("external")
    );
}

export function useWorkspaceNavigate() {
    const navigation = useWorkspaceNavigation();
    const navigate = useNavigate();

    return useCallback(
        async (href: string, onCommit?: () => void) => {
            if (!navigation) {
                onCommit?.();
                await navigate(href);
                return true;
            }

            const destination = new URL(rootAwareHref(href), window.location.href);
            const target = targetFromPublicUrl(destination);
            if (!hasStaticRoute(target.pathname)) {
                navigation.cancel();
                window.location.assign(rootAwareHref(href));
                return false;
            }
            const current = new URL(window.location.href);
            if (targetFromPublicUrl(current).pathname === target.pathname) {
                navigation.cancel();
                onCommit?.();
                const samePage = samePageDestination(current, destination);
                if (samePage) await navigate(samePage);
                return true;
            }
            return navigation.start({
                kind: "push",
                target,
                commit: () => {
                    onCommit?.();
                    return navigate(target.href, { flushSync: true });
                },
            });
        },
        [navigate, navigation],
    );
}
