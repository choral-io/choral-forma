import { hasStaticRoute } from "@/data/static-enhancement";
import { rootAwareHref } from "@/data/static-runtime";
import { Link as RouterLink, useNavigate, type LinkProps } from "react-router";

import {
    isPlainLinkClick,
    samePageDestination,
    targetFromPublicUrl,
    useWorkspaceNavigation,
} from "./workspace-navigation-state";

export function WorkspaceLink({ onClick, reloadDocument, ...props }: LinkProps) {
    const navigation = useWorkspaceNavigation();
    const navigate = useNavigate();
    return (
        <RouterLink
            {...props}
            reloadDocument={navigation ? true : reloadDocument}
            onClick={(event) => {
                if (!navigation) {
                    onClick?.(event);
                    return;
                }
                if (!isPlainLinkClick(event)) return;
                if (reloadDocument) {
                    navigation.cancel();
                    return;
                }
                const destination = new URL(event.currentTarget.href);
                if (destination.origin !== window.location.origin) {
                    navigation.cancel();
                    return;
                }
                const target = targetFromPublicUrl(destination);
                if (!hasStaticRoute(target.pathname)) {
                    navigation.cancel();
                    return;
                }
                event.preventDefault();
                const current = new URL(window.location.href);
                const commit = (href: string) => {
                    onClick?.(event);
                    return navigate(href, {
                        flushSync: true,
                        replace: props.replace,
                        preventScrollReset: props.preventScrollReset,
                        state: props.state as unknown,
                    });
                };
                if (targetFromPublicUrl(current).pathname === target.pathname) {
                    navigation.cancel();
                    const samePage = samePageDestination(current, destination);
                    if (samePage) void commit(samePage);
                    else onClick?.(event);
                    return;
                }
                void navigation.start({ kind: "push", target, commit: () => commit(target.href) });
            }}
        />
    );
}

export function NavigationFailure({
    href,
    onRetry,
    pop,
}: {
    href: string;
    onRetry: () => Promise<boolean>;
    pop?: boolean;
}) {
    return (
        <div
            className="alert alert-vertical alert-soft alert-error sm:alert-horizontal"
            data-workspace-route-failure
            role="alert"
        >
            <p>Could not load the static page.</p>
            <div className="flex gap-2">
                <button className="btn btn-sm" onClick={() => void onRetry()} type="button">
                    Retry
                </button>
                <a
                    className="btn btn-sm"
                    href={rootAwareHref(href)}
                    onClick={(event) => {
                        if (!pop || !isPlainLinkClick(event)) return;
                        event.preventDefault();
                        window.location.reload();
                    }}
                >
                    Open static page
                </a>
            </div>
        </div>
    );
}
