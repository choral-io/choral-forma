import { WorkspaceLink as Link } from "@/app/workspace-navigation";
import { Menu, PanelLeftOpen } from "lucide-react";
import { useState, type ReactNode } from "react";

import { mainContentId, workspaceDesktopDrawerId, workspaceDrawerId } from "@/app/App";
import { headerIconButtonClassName, headerIconClassName } from "@/features/workspace/header-controls";
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
    /** Shows reading progress; set by routes whose content is a document. */
    reading?: boolean;
    /** Omitted by routes that render their own page heading, such as a document. */
    title?: string;
}

// The sidebar carries these controls while it is shown, so the header only offers them when it is not.
const sidebarHiddenOnly = "lg:group-has-[[data-workspace-sidebar-toggle]:checked]/shell:hidden";

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

    return (
        <div className="grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
            <header className="navbar min-h-16 gap-1 border-b border-base-300 bg-base-100 px-2 sm:px-4">
                <button
                    aria-controls={workspaceDrawerId}
                    aria-label="Open workspace navigation"
                    className={cn(headerIconButtonClassName, "lg:hidden")}
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
                    <Menu aria-hidden="true" className={headerIconClassName} />
                </button>
                <button
                    aria-label="Show workspace sidebar"
                    className={cn(headerIconButtonClassName, "max-lg:hidden", sidebarHiddenOnly)}
                    data-sidebar-expand
                    onClick={() => {
                        const toggle = document.getElementById(workspaceDesktopDrawerId);
                        if (toggle instanceof HTMLInputElement) toggle.click();
                    }}
                    title="Show workspace sidebar"
                    type="button"
                >
                    <PanelLeftOpen aria-hidden="true" className={headerIconClassName} />
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
                    <ThemeDropdown onPreferenceChange={changeThemePreference} preference={themePreference} />
                </div>
            </header>

            <main className="min-h-0 min-w-0 overflow-auto outline-none" id={mainContentId} tabIndex={-1}>
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
