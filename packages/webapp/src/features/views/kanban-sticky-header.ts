export function syncKanbanStickyRailScroll(stickyRail: { scrollLeft: number } | null, scrollLeft: number) {
    if (stickyRail) stickyRail.scrollLeft = scrollLeft;
}

export function syncKanbanStickyRailGeometry({
    scrollLeft,
    sources,
    stickyColumns,
    stickyRail,
}: {
    scrollLeft: number;
    sources: readonly { getBoundingClientRect: () => { height: number } }[];
    stickyColumns: readonly { style: { setProperty: (name: string, value: string) => void } }[];
    stickyRail: { scrollLeft: number } | null;
}) {
    if (!stickyRail) return;

    stickyColumns.forEach((stickyColumn, index) => {
        const source = sources[index];
        if (source) stickyColumn.style.setProperty("height", `${String(source.getBoundingClientRect().height)}px`);
    });
    stickyRail.scrollLeft = scrollLeft;
}
