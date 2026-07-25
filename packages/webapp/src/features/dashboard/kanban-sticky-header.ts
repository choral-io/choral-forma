export function syncKanbanStickyRailScroll(stickyRail: { scrollLeft: number } | null, scrollLeft: number) {
    if (stickyRail) stickyRail.scrollLeft = scrollLeft;
}
