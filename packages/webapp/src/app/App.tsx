import { Suspense, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { Outlet, useLocation, type Location } from "react-router";

import { syncStaticDocumentMetadata } from "@/data/static-document-metadata";
import {
    hasStaticRoute,
    prepareStaticRoute,
    readPreparedStaticEnhancement,
    readPreparedStaticRoute,
    subscribePreparedStaticRoutes,
} from "@/data/static-enhancement";
import { createStaticNavigation } from "@/data/static-navigation";
import { canonicalRoutePath } from "@/data/static-route-target";
import { rootAwareHref } from "@/data/static-runtime";
import type { DashboardHealth, WorkspaceDashboard } from "@/data/workspace-client";
import { isStaticWorkspaceClient, workspaceClient } from "@/data/workspace-client-source";
import { isSupersededRouteRead, readWorkspacePageGroup, type WorkspacePageRead } from "@/data/workspace-page-read";
import { WorkspaceHealthPanel } from "@/features/diagnostics/DiagnosticsPanel";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";
import { WorkspacePageContext } from "@/features/workspace/use-workspace-page";
import { WorkspaceSidebar } from "@/features/workspace/WorkspaceSidebar";
import { requestRouteContentFocus } from "@/lib/route-focus";
import { readSidebarOpenPreference, writeSidebarOpenPreference } from "@/lib/sidebar-preference";
import { healthRoutePath } from "@/lib/workspace-routes";

import { NavigationFailure } from "./workspace-navigation";
import { targetFromPublicUrl, WorkspaceNavigationContext } from "./workspace-navigation-state";

// Shell controls use IDs outside the Markdown heading slug alphabet.
export const workspaceDrawerId = "forma:workspace-navigation";
/** The page content region, the target of the shell skip link. */
export const mainContentId = "forma:main-content";
export const workspaceDesktopDrawerId = "forma:workspace-sidebar";

interface RpcPageState {
    pathname: string;
    revision: number;
    dashboard?: WorkspaceDashboard;
    detail?: WorkspacePageRead;
    error?: string;
}

export function App() {
    const [rpcPage, setRpcPage] = useState<RpcPageState>();
    const [health, setHealth] = useState<DashboardHealth>();
    const [healthError, setHealthError] = useState<string>();
    const [revision, setRevision] = useState(0);
    const activeReadRef = useRef(false);
    const [navigation] = useState(() => createStaticNavigation(prepareStaticRoute));
    const navigationState = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot);
    const [observedPop, setObservedPop] = useState<{ origin: Location; targetPath: string }>();
    const [desktopDrawerInitiallyOpen] = useState(readSidebarOpenPreference);
    const navigationDialogRef = useRef<HTMLDialogElement>(null);
    const location = useLocation();
    const committedLocationRef = useRef(location);
    const pathname = canonicalRoutePath(location.pathname);
    const currentRpcPage = rpcPage?.pathname === pathname && rpcPage.revision === revision ? rpcPage : undefined;
    const dashboard = readPreparedStaticEnhancement()?.dashboard ?? currentRpcPage?.dashboard;
    const staticDetail = useSyncExternalStore(subscribePreparedStaticRoutes, () => readPreparedStaticRoute(pathname));
    const detail = isStaticWorkspaceClient ? staticDetail : currentRpcPage?.detail;

    useEffect(() => {
        if (isStaticWorkspaceClient) return;
        let cancelled = false;
        activeReadRef.current = true;
        async function readRoute() {
            if (pathname === healthRoutePath && workspaceClient.getHealth) {
                try {
                    const result = await workspaceClient.getHealth();
                    if (cancelled) return undefined;
                    setHealth(result);
                    setHealthError(undefined);
                    if (result.diagnostics.some(({ code }) => code === "route.unavailable")) return undefined;
                } catch (reason) {
                    if (cancelled || isSupersededRouteRead(reason)) return undefined;
                    setHealth(undefined);
                    setHealthError(reason instanceof Error ? reason.message : String(reason));
                }
            }
            return readWorkspacePageGroup(workspaceClient, pathname, () => !cancelled);
        }
        readRoute()
            .then((result) => {
                if (result && !cancelled) setRpcPage({ pathname, revision, ...result });
            })
            .catch((reason: unknown) => {
                if (!cancelled && !isSupersededRouteRead(reason)) {
                    setRpcPage({
                        pathname,
                        revision,
                        error: reason instanceof Error ? reason.message : String(reason),
                    });
                }
            })
            .finally(() => {
                if (!cancelled) activeReadRef.current = false;
            });
        return () => {
            cancelled = true;
            activeReadRef.current = false;
        };
    }, [pathname, revision]);

    useEffect(
        () =>
            workspaceClient.subscribeInvalidation?.(() => {
                setRpcPage(undefined);
                // The current transaction already owns its bounded full retry.
                if (!activeReadRef.current) setRevision((value) => value + 1);
            }),
        [],
    );

    useLayoutEffect(() => {
        committedLocationRef.current = location;
    }, [location]);

    useLayoutEffect(() => {
        if (!isStaticWorkspaceClient) return;
        function onPopState() {
            const target = targetFromPublicUrl(new URL(window.location.href));
            const origin = committedLocationRef.current;
            // POP has already changed the address. Replace the old body in the same
            // event even while React Router still exposes its previous location.
            // eslint-disable-next-line @eslint-react/dom-no-flush-sync -- Hide the prior body before the native POP can paint.
            flushSync(() => {
                setObservedPop({ origin, targetPath: target.pathname });
                navigation.cancel();
                if (hasStaticRoute(target.pathname) && !readPreparedStaticRoute(target.pathname)) {
                    void navigation.start({ kind: "pop", target });
                }
            });
        }
        function onNativeClick(event: MouseEvent) {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }
            const link = event.target instanceof Element ? event.target.closest("a[href]") : undefined;
            if (
                link instanceof HTMLAnchorElement &&
                (!link.target || link.target === "_self") &&
                !link.hasAttribute("download")
            ) {
                navigation.cancel();
            }
        }
        function onHashChange() {
            if (navigation.getSnapshot()?.intent.kind === "push") navigation.cancel();
        }
        window.addEventListener("popstate", onPopState, true);
        window.addEventListener("hashchange", onHashChange);
        document.addEventListener("click", onNativeClick);
        return () => {
            window.removeEventListener("popstate", onPopState, true);
            window.removeEventListener("hashchange", onHashChange);
            document.removeEventListener("click", onNativeClick);
        };
    }, [navigation]);

    useEffect(() => {
        if (navigationDialogRef.current?.open) {
            navigationDialogRef.current.close("navigate");
        }
    }, [pathname]);

    const popState = navigationState?.intent.kind === "pop" ? navigationState : undefined;
    const failedPushTarget =
        navigationState?.status === "failed" && navigationState.intent.kind === "push"
            ? navigationState.intent.target
            : undefined;
    const staticBodyPending =
        (observedPop?.origin === location && observedPop.targetPath !== pathname) ||
        (isStaticWorkspaceClient && !staticDetail && hasStaticRoute(pathname));

    useEffect(() => {
        if (dashboard && isStaticWorkspaceClient && !staticBodyPending && !popState) {
            syncStaticDocumentMetadata(dashboard, pathname);
        }
    }, [dashboard, pathname, popState, staticBodyPending]);

    function closeNavigation() {
        if (navigationDialogRef.current?.open) {
            navigationDialogRef.current.close("navigate");
        }
        requestRouteContentFocus();
    }

    if (!dashboard && pathname === healthRoutePath && (health || healthError)) {
        return (
            <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-base-100 p-8 text-base-content">
                <h1 className="text-3xl font-semibold">Health</h1>
                {health ? <WorkspaceHealthPanel health={health} /> : <p role="alert">{healthError}</p>}
                <button
                    className="btn"
                    onClick={() => {
                        setRevision((value) => value + 1);
                    }}
                    type="button"
                >
                    Retry checks
                </button>
            </main>
        );
    }

    if (currentRpcPage?.error) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-base-100 p-6 text-base-content">
                <div className="card max-w-md border border-base-300 bg-base-100">
                    <div className="card-body">
                        <h1 className="card-title">Dashboard failed to load</h1>
                        <p className="text-sm text-base-content/60">{currentRpcPage.error}</p>
                        <a className="link" href={rootAwareHref(healthRoutePath)}>
                            Open Health
                        </a>
                        <button
                            className="btn mt-2 self-start"
                            type="button"
                            onClick={() => {
                                setRevision((value) => value + 1);
                            }}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    if (!dashboard) {
        return (
            <main className="min-h-screen bg-base-100 p-8 text-base-content">
                <div
                    aria-busy="true"
                    aria-label="Loading workspace"
                    className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-28"
                    role="status"
                >
                    <div className="h-8 w-2/5 skeleton" />
                    <div className="h-4 w-3/5 skeleton" />
                    <div className="mt-6 h-4 w-full skeleton" />
                    <div className="h-4 w-11/12 skeleton" />
                    <div className="h-4 w-4/5 skeleton" />
                </div>
            </main>
        );
    }

    // Let the route and sidebar own scrolling, including browser-driven fragment jumps.
    return (
        <WorkspaceNavigationContext value={isStaticWorkspaceClient ? navigation : undefined}>
            <div
                className="group/shell drawer h-svh min-w-0 overflow-clip lg:drawer-open"
                data-enhancement-ready
                data-workspace-route={!popState && !staticBodyPending ? pathname : undefined}
                data-workspace-shell
            >
                {/* The first focus stop, so keyboard users reach the page without tabbing through the sidebar. */}
                <a
                    className="sr-only rounded-field bg-base-100 text-sm font-medium shadow-lg ring-2 ring-primary focus:not-sr-only focus:fixed focus:inset-s-2 focus:top-2 focus:z-50 focus:px-3 focus:py-2"
                    href={`#${mainContentId}`}
                    onClick={(event) => {
                        event.preventDefault();
                        const main = document.getElementById(mainContentId);
                        // The page heading is also where route navigation puts focus.
                        (main?.querySelector<HTMLElement>('h1[tabindex="-1"]') ?? main)?.focus();
                    }}
                >
                    Skip to content
                </a>
                <input
                    className="drawer-toggle"
                    data-workspace-sidebar-toggle
                    defaultChecked={desktopDrawerInitiallyOpen}
                    id={workspaceDesktopDrawerId}
                    onChange={(event) => {
                        const open = event.currentTarget.checked;
                        writeSidebarOpenPreference(open);
                        // The control that was just used is hidden by the change, so hand focus to its counterpart.
                        requestAnimationFrame(() => {
                            document
                                .querySelector<HTMLElement>(open ? "[data-sidebar-toggle]" : "[data-sidebar-expand]")
                                ?.focus();
                        });
                    }}
                    type="checkbox"
                />
                <div className="drawer-side max-lg:hidden">
                    {/* Clipped rather than hidden: a hidden overflow is still a scroll container that focus or
                    scrollIntoView can shift, while the sidebar's own trees own all of its scrolling. */}
                    <aside
                        aria-label="Workspace navigation"
                        className="flex h-full flex-col overflow-clip bg-base-200 text-base-content is-drawer-close:invisible is-drawer-close:w-0 is-drawer-open:w-sidebar"
                    >
                        <WorkspaceSidebar
                            dashboard={dashboard}
                            onNavigate={closeNavigation}
                            toggleId={workspaceDesktopDrawerId}
                        />
                    </aside>
                </div>
                <div className="drawer-content min-h-0 min-w-0 overflow-hidden bg-base-100 text-base-content">
                    {popState?.status === "failed" ? (
                        <main className="p-8">
                            <NavigationFailure href={popState.intent.target.href} onRetry={navigation.retry} pop />
                        </main>
                    ) : popState || staticBodyPending ? (
                        <RouteLoadingState />
                    ) : (
                        <WorkspacePageContext value={detail ?? {}}>
                            <Suspense fallback={<RouteLoadingState />}>
                                <Outlet context={dashboard} />
                            </Suspense>
                        </WorkspacePageContext>
                    )}
                </div>
                <dialog
                    aria-label="Workspace navigation"
                    className="peer/workspace-navigation modal modal-start bg-neutral/40 p-0 backdrop-blur-xs outline-none motion-reduce:transition-none lg:hidden"
                    id={workspaceDrawerId}
                    ref={navigationDialogRef}
                    onClose={(event) => {
                        if (event.currentTarget.returnValue !== "navigate") {
                            document
                                .querySelector<HTMLButtonElement>(`button[aria-controls="${workspaceDrawerId}"]`)
                                ?.focus();
                        }
                    }}
                >
                    <div className="relative modal-box h-svh max-h-none w-sidebar max-w-[calc(100vw-3rem)] rounded-none bg-base-200 p-0 text-base-content">
                        <WorkspaceSidebar
                            collapsible={false}
                            dashboard={dashboard}
                            onNavigate={closeNavigation}
                            showQuickOpen={false}
                        />
                        {failedPushTarget ? (
                            <div className="absolute inset-x-3 bottom-3 z-10">
                                <NavigationFailure href={failedPushTarget.href} onRetry={navigation.retry} />
                            </div>
                        ) : null}
                    </div>
                    <form className="modal-backdrop" method="dialog">
                        <button aria-label="Close workspace navigation">Close</button>
                    </form>
                </dialog>
                <QuickOpenDialog dashboard={dashboard} />
                {failedPushTarget ? (
                    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl peer-open/quick-open:hidden peer-open/workspace-navigation:hidden">
                        <NavigationFailure href={failedPushTarget.href} onRetry={navigation.retry} />
                    </div>
                ) : null}
            </div>
        </WorkspaceNavigationContext>
    );
}

function RouteLoadingState() {
    return (
        <main
            aria-busy="true"
            aria-label="Loading workspace route"
            className="min-h-full bg-base-100 p-8 text-base-content"
            role="status"
        >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-12">
                <div className="h-8 w-2/5 skeleton" />
                <div className="h-4 w-3/5 skeleton" />
                <div className="mt-6 h-4 w-full skeleton" />
                <div className="h-4 w-11/12 skeleton" />
            </div>
        </main>
    );
}
