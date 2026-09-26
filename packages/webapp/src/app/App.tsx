import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";

import { syncStaticDocumentMetadata } from "@/data/static-document-metadata";
import { readPreparedStaticEnhancement } from "@/data/static-enhancement";
import { readStaticRuntimeConfig } from "@/data/static-runtime";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";
import { WorkspaceSidebar } from "@/features/workspace/WorkspaceSidebar";
import { requestRouteContentFocus } from "@/lib/route-focus";

import { resolveDesktopSidebarOpen } from "./workspace-sidebar-state";

export const workspaceDrawerId = "workspace-navigation";
const workspaceDesktopDrawerId = "workspace-sidebar";

export function App() {
    const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(
        () => readPreparedStaticEnhancement()?.dashboard ?? null,
    );
    const [error, setError] = useState<string | null>(null);
    const [desktopDrawerInitiallyOpen] = useState(() => window.matchMedia("(min-width: 80rem)").matches);
    const navigationDialogRef = useRef<HTMLDialogElement>(null);
    const desktopDrawerRef = useRef<HTMLInputElement>(null);
    const desktopDrawerManuallyChangedRef = useRef(false);
    const { pathname } = useLocation();

    useEffect(() => {
        if (dashboard) return;
        let cancelled = false;
        workspaceClient
            .getDashboard()
            .then((result) => {
                if (!cancelled) {
                    setDashboard(result);
                }
            })
            .catch((reason: unknown) => {
                if (!cancelled) {
                    setError(reason instanceof Error ? reason.message : String(reason));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [dashboard]);

    useEffect(() => {
        if (navigationDialogRef.current?.open) {
            navigationDialogRef.current.close("navigate");
        }
    }, [pathname]);

    useEffect(() => {
        if (!dashboard || !readStaticRuntimeConfig()) return;
        syncStaticDocumentMetadata(dashboard, pathname);
    }, [dashboard, pathname]);

    useEffect(() => {
        const wideDesktopMedia = window.matchMedia("(min-width: 80rem)");
        const syncDesktopDrawer = () => {
            if (!desktopDrawerRef.current) return;
            desktopDrawerRef.current.checked = resolveDesktopSidebarOpen({
                currentOpen: desktopDrawerRef.current.checked,
                hasManualOverride: desktopDrawerManuallyChangedRef.current,
                isWideViewport: wideDesktopMedia.matches,
            });
        };

        syncDesktopDrawer();
        wideDesktopMedia.addEventListener("change", syncDesktopDrawer);
        return () => {
            wideDesktopMedia.removeEventListener("change", syncDesktopDrawer);
        };
    }, []);

    function closeNavigation() {
        if (navigationDialogRef.current?.open) {
            navigationDialogRef.current.close("navigate");
        }
        requestRouteContentFocus();
    }

    if (error) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-base-100 p-6 text-base-content">
                <div className="card max-w-md border border-base-300 bg-base-100">
                    <div className="card-body">
                        <h1 className="card-title">Dashboard failed to load</h1>
                        <p className="text-sm text-base-content/60">{error}</p>
                        <button
                            className="btn mt-2 self-start"
                            type="button"
                            onClick={() => {
                                window.location.reload();
                            }}
                        >
                            Reload
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

    return (
        <div
            className="drawer h-svh min-w-0 overflow-hidden lg:drawer-open"
            data-enhancement-ready
            data-workspace-shell
        >
            <input
                className="drawer-toggle"
                defaultChecked={desktopDrawerInitiallyOpen}
                id={workspaceDesktopDrawerId}
                onChange={() => {
                    desktopDrawerManuallyChangedRef.current = true;
                }}
                ref={desktopDrawerRef}
                type="checkbox"
            />
            <div className="drawer-side max-lg:hidden is-drawer-close:overflow-visible">
                <aside className="flex min-h-full flex-col overflow-visible bg-base-200 text-base-content is-drawer-close:w-14 is-drawer-open:w-64">
                    <WorkspaceSidebar
                        dashboard={dashboard}
                        onNavigate={closeNavigation}
                        toggleId={workspaceDesktopDrawerId}
                    />
                </aside>
            </div>
            <div className="drawer-content min-h-0 min-w-0 overflow-hidden bg-base-100 text-base-content">
                <Suspense fallback={<RouteLoadingState />}>
                    <Outlet context={dashboard} />
                </Suspense>
            </div>
            <dialog
                className="modal modal-start bg-neutral/40 p-0 backdrop-blur-xs outline-none motion-reduce:transition-none lg:hidden"
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
                <div className="modal-box h-svh max-h-none w-72 max-w-[calc(100vw-3rem)] rounded-none bg-base-200 p-0 text-base-content">
                    <WorkspaceSidebar
                        collapsible={false}
                        dashboard={dashboard}
                        onNavigate={closeNavigation}
                        showQuickOpen={false}
                    />
                </div>
                <form className="modal-backdrop" method="dialog">
                    <button aria-label="Close workspace navigation">Close</button>
                </form>
            </dialog>
            <QuickOpenDialog dashboard={dashboard} />
        </div>
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
