import { Ellipsis, Menu, PanelRightIcon, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { workspaceDrawerId } from "@/app/App";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { WorkspaceHealthPanel } from "@/features/diagnostics/DiagnosticsPanel";
import { QuickOpenTrigger } from "@/features/workspace/QuickOpenDialog";
import { ThemeCycleButton, ThemeDropdown } from "@/features/workspace/ThemeDropdown";
import { applyThemePreference, readThemePreference, type ThemePreference } from "@/lib/theme-preference";
import { cn } from "@/lib/utils";
import { subscribeWorkspaceInteractionLayer } from "@/lib/workspace-interaction-layer";

interface WorkspaceRouteFrameProps {
    actions?: ReactNode;
    children: ReactNode;
    contextPanel?: ReactNode;
    contentWidth?: "default" | "fluid" | "readable";
    description?: string;
    eyebrow: string;
    fabActions?: (closeFab: () => void) => ReactNode;
    title: string;
    titleAs?: "div" | "h1";
}

export function WorkspaceRouteFrame({
    actions,
    children,
    contextPanel,
    contentWidth = "default",
    description,
    eyebrow,
    fabActions,
    title,
    titleAs = "h1",
}: WorkspaceRouteFrameProps) {
    const [themePreference, setThemePreference] = useState(readThemePreference);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [isMobileFabSuppressed, setIsMobileFabSuppressed] = useState(false);
    const hasContextPanel = Boolean(contextPanel);
    const contentWidthClass = {
        default: "max-w-6xl",
        fluid: "max-w-none",
        readable: "max-w-4xl",
    }[contentWidth];
    const Title = titleAs;
    const changeThemePreference = (preference: ThemePreference) => {
        setThemePreference(preference);
        applyThemePreference(preference);
    };
    const closeFab = () => {
        setIsFabOpen(false);
    };
    useEffect(() => {
        return subscribeWorkspaceInteractionLayer((occupied) => {
            setIsMobileFabSuppressed(occupied);
            if (occupied) {
                setIsFabOpen(false);
            }
        });
    }, []);

    return (
        <div
            className={cn(
                "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-auto xl:grid xl:grid-cols-1 xl:overflow-hidden",
                hasContextPanel && "xl:grid-cols-[minmax(0,1fr)_22rem]",
            )}
        >
            <div className="flex min-w-0 flex-col xl:min-h-0">
                <header className="border-base-300 bg-base-100/90 flex shrink-0 items-center border-b p-4 backdrop-blur-sm md:px-6 lg:sticky lg:top-0 lg:z-10 lg:h-28">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                            aria-controls={workspaceDrawerId}
                            aria-label="Open workspace navigation"
                            className="btn btn-square btn-ghost lg:hidden"
                            type="button"
                            onClick={() => {
                                closeFab();
                                const dialog = document.getElementById(workspaceDrawerId);
                                if (dialog instanceof HTMLDialogElement) {
                                    dialog.returnValue = "";
                                    dialog.showModal();
                                    requestAnimationFrame(() => {
                                        (
                                            dialog.querySelector<HTMLElement>(
                                                '[data-sidebar-link][aria-current="page"]',
                                            ) ?? dialog.querySelector<HTMLElement>("[data-sidebar-link]")
                                        )?.focus();
                                    });
                                }
                            }}
                        >
                            <Menu aria-hidden="true" />
                        </button>
                        <div className="min-w-0">
                            <p className="text-base-content/60 text-sm">{eyebrow}</p>
                            <Title
                                className="line-clamp-2 text-2xl font-semibold tracking-normal lg:line-clamp-1"
                                tabIndex={-1}
                                title={title}
                            >
                                {title}
                            </Title>
                            {description && (
                                <p
                                    className="text-base-content/60 mt-1 line-clamp-2 max-w-3xl text-sm/6 lg:line-clamp-1"
                                    title={description}
                                >
                                    {description}
                                </p>
                            )}
                        </div>
                        <div className="ml-auto hidden shrink-0 items-center gap-1 lg:flex">
                            {actions}
                            <ThemeDropdown onPreferenceChange={changeThemePreference} preference={themePreference} />
                        </div>
                    </div>
                </header>

                {hasContextPanel && contextPanel ? (
                    <details className="collapse-arrow border-base-300 bg-base-200/40 collapse rounded-none border-b xl:hidden">
                        <summary className="collapse-title flex items-center gap-2 text-sm font-medium">
                            <PanelRightIcon aria-hidden="true" className="size-4" />
                            Context and outline
                        </summary>
                        <div className="collapse-content">{contextPanel}</div>
                    </details>
                ) : null}

                <main className="min-w-0 xl:min-h-0 xl:flex-1 xl:overflow-auto">
                    {/* pb-20 keeps FAB scroll-clearance below lg; lg:p-8 then restores
                        the symmetric padding once the FAB (lg:hidden) is gone. */}
                    <div
                        className={cn(
                            "mx-auto flex w-full flex-col gap-6 p-4 pb-20 md:p-6 md:pb-20 lg:p-8",
                            contentWidthClass,
                        )}
                    >
                        {children}
                    </div>
                </main>
            </div>
            {hasContextPanel && (
                <aside className="border-base-300 bg-base-200/20 hidden min-w-0 border-s xl:block xl:min-h-0 xl:overflow-y-auto">
                    {contextPanel}
                </aside>
            )}
            {/* FAB dial: mobile-only (below lg), where there is no persistent
                chrome, so it carries Theme + Quick Open (+ Outline when present).
                At lg+ the chrome takes over — header Theme, header Outline toggle
                in the lg..xl band, sidebar Quick Open, xl Outline aside — so the
                FAB stays hidden and never becomes a lone-button dial. */}
            {!isMobileFabSuppressed ? (
                <div className="fab lg:hidden!">
                    <button
                        aria-expanded={isFabOpen}
                        aria-label="Open page actions"
                        className="btn btn-circle btn-lg btn-neutral"
                        tabIndex={0}
                        type="button"
                        onClick={() => {
                            setIsFabOpen(true);
                        }}
                    >
                        <Ellipsis aria-hidden="true" />
                    </button>
                    {isFabOpen ? (
                        <>
                            <button
                                aria-label="Close page actions"
                                className="fab-close"
                                onClick={closeFab}
                                type="button"
                            >
                                <span className="btn btn-circle btn-lg btn-neutral">
                                    <X aria-hidden="true" />
                                </span>
                            </button>
                            {fabActions?.(closeFab)}
                            <QuickOpenTrigger
                                onBeforeOpen={(trigger) => {
                                    closeFab();
                                    trigger.blur();
                                }}
                                trigger="fab"
                            />
                            <ThemeCycleButton onPreferenceChange={changeThemePreference} preference={themePreference} />
                        </>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function WorkspaceDefaultContextPanel({ dashboard }: { dashboard: WorkspaceDashboard }) {
    return <WorkspaceHealthPanel health={dashboard.health} />;
}
