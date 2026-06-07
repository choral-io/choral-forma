import {
    BadgeCheck,
    Bell,
    ChevronRight,
    ChevronsUpDown,
    CreditCard,
    FileText,
    LayoutDashboard,
    LibraryBig,
    LogOut,
    Sparkles,
    Workflow,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar";
import type { WorkspaceDashboard } from "@/data/workspace-client";
import { QuickOpenDialog } from "@/features/workspace/QuickOpenDialog";

interface WorkspaceSidebarProps {
    dashboard: WorkspaceDashboard;
}

interface WorkspaceUser {
    name: string;
    email: string;
    avatar: string;
    initials: string;
}

const workspaceUser: WorkspaceUser = {
    name: "Git user",
    email: "git@example.com",
    avatar: "",
    initials: "GU",
};

export function WorkspaceSidebar({ dashboard }: WorkspaceSidebarProps) {
    const [spacesOpen, setSpacesOpen] = useState(true);
    const [viewsOpen, setViewsOpen] = useState(true);
    const { pathname } = useLocation();
    const { isMobile, setOpenMobile } = useSidebar();

    useEffect(() => {
        if (isMobile) {
            setOpenMobile(false);
        }
    }, [isMobile, pathname, setOpenMobile]);

    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" tooltip={dashboard.workspaceName}>
                            <WorkspaceBrandLogo dashboard={dashboard} />
                            <div className="grid flex-1 text-left text-sm/tight">
                                <span className="truncate font-medium">{dashboard.workspaceName}</span>
                                <span className="truncate text-xs">Local repository workspace</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            <SidebarMenuItem className="hidden md:block">
                                <QuickOpenDialog dashboard={dashboard} trigger="sidebar" />
                            </SidebarMenuItem>
                            <SidebarItem active={pathname === "/"} icon={LayoutDashboard} label="Dashboard" to="/" />
                            <SidebarItem
                                active={pathname.startsWith("/pages")}
                                icon={FileText}
                                label="Pages"
                                to="/pages"
                            />
                            <SidebarTree
                                active={pathname.startsWith("/spaces")}
                                icon={LibraryBig}
                                label="Spaces"
                                onOpenChange={setSpacesOpen}
                                open={spacesOpen}
                                to="/spaces"
                            >
                                {dashboard.spaces.map((space) => (
                                    <SidebarChildItem
                                        active={pathname === `/spaces/${space.id}`}
                                        key={space.id}
                                        label={space.title}
                                        meta={String(space.entryCount)}
                                        to={`/spaces/${space.id}`}
                                    />
                                ))}
                            </SidebarTree>
                            <SidebarTree
                                active={pathname.startsWith("/views")}
                                icon={Workflow}
                                label="Views"
                                onOpenChange={setViewsOpen}
                                open={viewsOpen}
                                to="/views"
                            >
                                {dashboard.views.map((view) => (
                                    <SidebarChildItem
                                        active={pathname === `/views/${view.id}`}
                                        key={view.id}
                                        label={view.title}
                                        meta={view.kind}
                                        to={`/views/${view.id}`}
                                    />
                                ))}
                            </SidebarTree>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <WorkspaceUserMenu user={workspaceUser} />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}

function WorkspaceBrandLogo({ dashboard }: { dashboard: WorkspaceDashboard }) {
    const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
    const logo = dashboard.workspaceLogo;
    const canUseLogo = logo !== undefined && failedLogoUrl !== logo.url;
    const initial = dashboard.workspaceName.trim().charAt(0).toLocaleUpperCase() || "F";

    return (
        <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg text-base font-semibold">
            {canUseLogo ? (
                <img
                    alt={logo.alt}
                    className="size-full object-contain"
                    onError={() => {
                        setFailedLogoUrl(logo.url);
                    }}
                    src={logo.url}
                />
            ) : (
                initial
            )}
        </div>
    );
}

function SidebarTree({
    active = false,
    children,
    icon: Icon,
    label,
    onOpenChange,
    open,
    to,
}: {
    active?: boolean;
    children: ReactNode;
    icon: typeof LayoutDashboard;
    label: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    to: string;
}) {
    return (
        <Collapsible className="group/collapsible" onOpenChange={onOpenChange} open={open}>
            <SidebarMenuItem>
                <SidebarMenuButton isActive={active} render={<Link to={to} />} tooltip={label}>
                    <Icon />
                    <span>{label}</span>
                </SidebarMenuButton>
                <CollapsibleTrigger render={<SidebarMenuAction />}>
                    <ChevronRight className="transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                    <span className="sr-only">Toggle {label}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>{children}</SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}

function SidebarChildItem({
    active = false,
    label,
    meta,
    to,
}: {
    active?: boolean;
    label: string;
    meta?: string;
    to: string;
}) {
    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton className="pe-2" isActive={active} render={<Link to={to} />}>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {meta && <span className="text-sidebar-foreground/60 shrink-0 text-xs tabular-nums">{meta}</span>}
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}

function WorkspaceUserMenu({ user }: { user: WorkspaceUser }) {
    const { isMobile } = useSidebar();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton
                                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                                size="lg"
                            />
                        }
                    >
                        <Avatar className="size-8 rounded-lg after:rounded-lg">
                            <AvatarImage alt={user.name} className="rounded-lg" src={user.avatar} />
                            <AvatarFallback className="rounded-lg">{user.initials}</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm/tight">
                            <span className="truncate font-medium">{user.name}</span>
                            <span className="truncate text-xs">{user.email}</span>
                        </div>
                        <ChevronsUpDown className="ms-auto" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        className="w-(--anchor-width) min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        sideOffset={4}
                    >
                        <DropdownMenuGroup>
                            <DropdownMenuLabel className="p-0 font-normal">
                                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                    <Avatar className="size-8 rounded-lg after:rounded-lg">
                                        <AvatarImage alt={user.name} className="rounded-lg" src={user.avatar} />
                                        <AvatarFallback className="rounded-lg">{user.initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="grid flex-1 text-left text-sm/tight">
                                        <span className="truncate font-medium">{user.name}</span>
                                        <span className="truncate text-xs">{user.email}</span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <Sparkles />
                                Git identity placeholder
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <BadgeCheck />
                                Account placeholder
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <CreditCard />
                                Gravatar placeholder
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Bell />
                                Notifications placeholder
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <LogOut />
                            Log out placeholder
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function SidebarItem({
    active = false,
    icon: Icon,
    label,
    meta,
    to,
}: {
    active?: boolean;
    icon: typeof LayoutDashboard;
    label: string;
    meta?: string;
    to: string;
}) {
    return (
        <SidebarMenuItem>
            <SidebarMenuButton isActive={active} render={<Link to={to} />} tooltip={label}>
                <Icon />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {meta && (
                    <span className="text-sidebar-foreground/60 shrink-0 text-xs group-data-[collapsible=icon]:hidden">
                        {meta}
                    </span>
                )}
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}
