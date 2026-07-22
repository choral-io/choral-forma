import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { WorkspaceSidebar } from "@/features/workspace/WorkspaceSidebar";

export const workspaceDrawerId = "workspace-navigation";
const workspaceDesktopDrawerId = "workspace-sidebar";

export function App() {
    const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [desktopDrawerInitiallyOpen] = useState(
        () =>
            window.matchMedia("(min-width: 64rem)").matches &&
            document.documentElement.dataset.workspaceSidebar !== "collapsed",
    );
    const navigationDialogRef = useRef<HTMLDialogElement>(null);
    const desktopDrawerRef = useRef<HTMLInputElement>(null);
    const { pathname } = useLocation();
    const previousPathnameRef = useRef(pathname);

    useEffect(() => {
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
    }, []);

    useEffect(() => {
        if (navigationDialogRef.current?.open) {
            navigationDialogRef.current.close("navigate");
        }
        if (previousPathnameRef.current !== pathname) {
            previousPathnameRef.current = pathname;
            requestAnimationFrame(() => {
                document.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus();
            });
        }
    }, [pathname]);

    useEffect(() => {
        const desktopMedia = window.matchMedia("(min-width: 64rem)");
        const syncDesktopDrawer = () => {
            if (!desktopDrawerRef.current) return;
            desktopDrawerRef.current.checked =
                desktopMedia.matches && document.documentElement.dataset.workspaceSidebar !== "collapsed";
        };

        syncDesktopDrawer();
        desktopMedia.addEventListener("change", syncDesktopDrawer);
        return () => {
            desktopMedia.removeEventListener("change", syncDesktopDrawer);
        };
    }, []);

    function closeNavigation() {
        if (navigationDialogRef.current?.open) {
            navigationDialogRef.current.close("navigate");
        }
        requestAnimationFrame(() => {
            document.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus();
        });
    }

    if (error) {
        return (
            <main className="bg-base-100 text-base-content flex min-h-screen items-center justify-center p-6">
                <div className="card border-base-300 bg-base-100 max-w-md border">
                    <div className="card-body">
                        <h1 className="card-title">Dashboard failed to load</h1>
                        <p className="text-base-content/60 text-sm">{error}</p>
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
            <main className="bg-base-100 text-base-content flex min-h-screen items-center justify-center">
                <div className="text-base-content/60 flex items-center gap-3 text-sm">
                    <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                    <span>Loading workspace dashboard...</span>
                </div>
            </main>
        );
    }

    return (
        <div className="drawer lg:drawer-open h-svh min-w-0 overflow-hidden" data-workspace-shell>
            <input
                className="drawer-toggle"
                defaultChecked={desktopDrawerInitiallyOpen}
                id={workspaceDesktopDrawerId}
                onChange={(event) => {
                    const value = event.currentTarget.checked ? "expanded" : "collapsed";
                    document.documentElement.dataset.workspaceSidebar = value;
                    try {
                        window.localStorage.setItem("forma.workspaceSidebar", value);
                    } catch {
                        // The browser-owned drawer state remains usable without persistence.
                    }
                }}
                ref={desktopDrawerRef}
                type="checkbox"
            />
            <div className="drawer-side is-drawer-close:overflow-visible max-lg:hidden">
                <aside className="bg-base-200 text-base-content is-drawer-close:w-14 is-drawer-open:w-64 flex min-h-full flex-col overflow-visible transition-[width] duration-200">
                    <WorkspaceSidebar
                        dashboard={dashboard}
                        onNavigate={closeNavigation}
                        toggleId={workspaceDesktopDrawerId}
                    />
                </aside>
            </div>
            <div className="drawer-content bg-base-100 text-base-content min-h-0 min-w-0 overflow-hidden">
                <Outlet context={dashboard} />
            </div>
            <dialog
                className="modal modal-start p-0 outline-none lg:hidden"
                id={workspaceDrawerId}
                ref={navigationDialogRef}
                onClose={(event) => {
                    if (event.currentTarget.returnValue !== "navigate") {
                        document
                            .querySelector<HTMLButtonElement>(`button[aria-controls="${workspaceDrawerId}"]`)
                            ?.focus();
                    }
                }}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        event.currentTarget.close();
                    }
                }}
            >
                <div className="modal-box bg-base-200 text-base-content h-svh max-h-none w-72 max-w-[calc(100vw-3rem)] rounded-none p-0">
                    <WorkspaceSidebar
                        collapsible={false}
                        dashboard={dashboard}
                        onNavigate={closeNavigation}
                        showQuickOpen={false}
                    />
                </div>
                <form className="modal-backdrop" method="dialog">
                    <button
                        aria-label="Close workspace navigation"
                        onClick={() => navigationDialogRef.current?.close()}
                        type="button"
                    >
                        Close
                    </button>
                </form>
            </dialog>
        </div>
    );
}
