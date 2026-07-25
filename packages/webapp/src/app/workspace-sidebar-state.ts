interface ResolveDesktopSidebarOpenOptions {
    currentOpen: boolean;
    hasManualOverride: boolean;
    isWideViewport: boolean;
}

export function resolveDesktopSidebarOpen({
    currentOpen,
    hasManualOverride,
    isWideViewport,
}: ResolveDesktopSidebarOpenOptions): boolean {
    return hasManualOverride ? currentOpen : isWideViewport;
}
