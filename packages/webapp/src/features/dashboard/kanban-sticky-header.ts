export function syncKanbanStickyRailScroll(stickyRail: { scrollLeft: number } | null, scrollLeft: number) {
    if (stickyRail) stickyRail.scrollLeft = scrollLeft;
}

export function syncKanbanStickyRailGeometry({
    scrollLeft,
    source,
    stickyRail,
}: {
    scrollLeft: number;
    source: { getBoundingClientRect: () => { height: number } } | null;
    stickyRail: { scrollLeft: number; style: { setProperty: (name: string, value: string) => void } } | null;
}) {
    if (!source || !stickyRail) return;

    stickyRail.style.setProperty("--view-kanban-heading-height", `${source.getBoundingClientRect().height}px`);
    stickyRail.scrollLeft = scrollLeft;
}
