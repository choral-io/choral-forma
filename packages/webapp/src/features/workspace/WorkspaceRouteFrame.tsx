import { Maximize2, Menu, Minimize2, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { workspaceDesktopDrawerId, workspaceDrawerId, workspaceFocusModeId } from "@/app/App";
import { QuickOpenTrigger } from "@/features/workspace/QuickOpenDialog";
import { ThemeDropdown } from "@/features/workspace/ThemeDropdown";
import { useWorkspaceDashboard } from "@/features/workspace/use-workspace-dashboard";
import { useRouteContentFocusTarget } from "@/lib/route-focus";
import { applyThemePreference, readThemePreference, type ThemePreference } from "@/lib/theme-preference";
import { cn } from "@/lib/utils";

/** An ancestor of the current page. A crumb without a route is a grouping, not a destination. */
export interface WorkspaceBreadcrumb {
    label: string;
    to?: string;
}

interface WorkspaceRouteFrameProps {
    actions?: ReactNode;
    breadcrumb?: WorkspaceBreadcrumb[];
    children: ReactNode;
    contentWidth?: "default" | "fluid" | "narrow" | "readable";
    description?: string;
    /** Offers focus mode and shows reading progress; set by routes whose content is a document. */
    reading?: boolean;
    /** Omitted by routes that render their own page heading, such as a document. */
    title?: string;
}

// The sidebar carries these controls while it is shown, so the header only offers them when it is not.
const sidebarHiddenOnly = "lg:group-has-[#workspace-sidebar:checked]/shell:hidden";

export function WorkspaceRouteFrame({
    actions,
    breadcrumb = [],
    children,
    contentWidth = "default",
    description,
    reading = false,
    title,
}: WorkspaceRouteFrameProps) {
    const dashboard = useWorkspaceDashboard();
    const titleRef = useRouteContentFocusTarget<HTMLHeadingElement>();
    const [themePreference, setThemePreference] = useState(readThemePreference);
    const contentWidthClass = {
        default: "max-w-6xl",
        fluid: "max-w-none",
        narrow: "max-w-3xl",
        readable: "max-w-4xl",
    }[contentWidth];
    const changeThemePreference = (preference: ThemePreference) => {
        setThemePreference(preference);
        applyThemePreference(preference);
    };

    const toggleFocusMode = () => {
        const toggle = document.getElementById(workspaceFocusModeId);
        if (toggle instanceof HTMLInputElement) toggle.click();
    };

    return (
        <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
            <header className="navbar min-h-16 gap-1 border-b border-base-300 bg-base-100 px-2 sm:px-4">
                <button
                    aria-controls={workspaceDrawerId}
                    aria-label="Open workspace navigation"
                    className="btn btn-square btn-ghost lg:hidden"
                    type="button"
                    onClick={() => {
                        const dialog = document.getElementById(workspaceDrawerId);
                        if (dialog instanceof HTMLDialogElement) {
                            dialog.returnValue = "";
                            dialog.showModal();
                            requestAnimationFrame(() => {
                                (
                                    dialog.querySelector<HTMLElement>('[aria-current="page"]') ??
                                    dialog.querySelector<HTMLElement>("[data-sidebar-link]")
                                )?.focus();
                            });
                        }
                    }}
                >
                    <Menu aria-hidden="true" />
                </button>
                <button
                    aria-label="Show workspace sidebar"
                    className={cn("btn btn-square btn-ghost max-lg:hidden", sidebarHiddenOnly)}
                    data-sidebar-expand
                    onClick={() => {
                        const toggle = document.getElementById(workspaceDesktopDrawerId);
                        if (toggle instanceof HTMLInputElement) toggle.click();
                    }}
                    title="Show workspace sidebar"
                    type="button"
                >
                    <PanelLeftOpen aria-hidden="true" />
                </button>
                <nav aria-label="Breadcrumb" className="breadcrumbs min-w-0 flex-1 scrollbar-none px-2 text-sm">
                    <ul>
                        <li>
                            <Link className="min-w-0" to="/">
                                <span className="max-w-32 truncate sm:max-w-64">{dashboard.workspaceName}</span>
                            </Link>
                        </li>
                        {breadcrumb.map((crumb, index) => (
                            <li key={`${String(index)}-${crumb.label}`}>
                                {crumb.to ? (
                                    <Link to={crumb.to}>{crumb.label}</Link>
                                ) : (
                                    <span className="text-base-content/60">{crumb.label}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="flex shrink-0 items-center gap-1">
                    <QuickOpenTrigger className={sidebarHiddenOnly} trigger="header" />
                    {actions}
                    {reading ? (
                        <button
                            aria-label="Enter focus mode"
                            className="btn btn-square btn-ghost max-lg:hidden lg:group-has-[#workspace-focus-mode:checked]/shell:hidden"
                            data-focus-mode-enter
                            onClick={toggleFocusMode}
                            title="Enter focus mode"
                            type="button"
                        >
                            <Maximize2 aria-hidden="true" />
                        </button>
                    ) : null}
                    {/* Leaving focus mode is offered on every route, because the mode outlives the page it began on. */}
                    <button
                        aria-label="Exit focus mode"
                        className="btn hidden btn-square btn-ghost lg:group-has-[#workspace-focus-mode:checked]/shell:inline-flex"
                        data-focus-mode-exit
                        onClick={toggleFocusMode}
                        title="Exit focus mode"
                        type="button"
                    >
                        <Minimize2 aria-hidden="true" />
                    </button>
                    <ThemeDropdown onPreferenceChange={changeThemePreference} preference={themePreference} />
                </div>
            </header>

            <main className="min-h-0 min-w-0 overflow-auto">
                {reading ? (
                    <div aria-hidden="true" className="sticky top-0 z-10 h-0">
                        <div className="h-0.5 bg-primary" data-reading-progress />
                    </div>
                ) : null}
                <div className={cn("mx-auto flex w-full flex-col gap-6 p-4 md:p-6 lg:p-8", contentWidthClass)}>
                    {title ? (
                        <header className="flex flex-col gap-2">
                            <h1 className="text-3xl font-semibold tracking-normal" ref={titleRef} tabIndex={-1}>
                                {title}
                            </h1>
                            {description ? (
                                <p className="max-w-3xl text-base/7 text-base-content/60">{description}</p>
                            ) : null}
                        </header>
                    ) : null}
                    {children}
                </div>
            </main>
        </div>
    );
}
