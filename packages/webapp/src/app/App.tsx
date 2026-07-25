import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";

import type { WorkspaceDashboard } from "@/data/workspace-client";
import { workspaceClient } from "@/data/workspace-client-source";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";
import { WorkspaceSidebar } from "@/features/workspace/WorkspaceSidebar";

import { resolveDesktopSidebarOpen } from "./workspace-sidebar-state";

export const workspaceDrawerId = "workspace-navigation";
const workspaceDesktopDrawerId = "workspace-sidebar";

export function App() {
    const [dashboard, setDashboard] = useState<WorkspaceDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [desktopDrawerInitiallyOpen] = useState(() => window.matchMedia("(min-width: 80rem)").matches);
    const navigationDialogRef = useRef<HTMLDialogElement>(null);
    const desktopDrawerRef = useRef<HTMLInputElement>(null);
    const desktopDrawerManuallyChangedRef = useRef(false);
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
            <main className="bg-base-100 text-base-content min-h-screen p-8">
                <div
                    aria-busy="true"
                    aria-label="Loading workspace"
                    className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-28"
                    role="status"
                >
                    <div className="skeleton h-8 w-2/5" />
                    <div className="skeleton h-4 w-3/5" />
                    <div className="skeleton mt-6 h-4 w-full" />
                    <div className="skeleton h-4 w-11/12" />
                    <div className="skeleton h-4 w-4/5" />
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
                onChange={() => {
                    desktopDrawerManuallyChangedRef.current = true;
                }}
                ref={desktopDrawerRef}
                type="checkbox"
            />
            <div className="drawer-side is-drawer-close:overflow-visible max-lg:hidden">
                <aside className="bg-base-200 text-base-content is-drawer-close:w-14 is-drawer-open:w-64 flex min-h-full flex-col overflow-visible">
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
                <div className="modal-box bg-base-200 text-base-content h-svh max-h-none w-72 max-w-[calc(100vw-3rem)] rounded-none p-0">
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
