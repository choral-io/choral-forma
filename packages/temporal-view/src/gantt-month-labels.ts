import { TITLE_WIDTH } from "./gantt-layout";

/** Positions only mounted labels; React owns their content, not these styles. */
export function positionMonthLabels(scroller: HTMLElement) {
    const left = scroller.scrollLeft;
    const right = left + Math.max(0, scroller.clientWidth - TITLE_WIDTH);
    const labels = scroller.querySelectorAll<HTMLElement>("[data-gantt-month-start]");
    // Read scroll geometry once, then write without forcing per-label layout.
    for (const label of labels) {
        const start = Number(label.dataset.ganttMonthStart);
        const end = Number(label.dataset.ganttMonthEnd);
        const visibleStart = Math.max(start, left);
        const visibleEnd = Math.min(end, right);
        const visibleWidth = Math.max(0, visibleEnd - visibleStart);
        const transform = `translateX(${String(visibleStart - start)}px)`;
        const width = `${String(visibleWidth)}px`;
        const visibility = visibleWidth > 0 ? "visible" : "hidden";
        // Layout reconciliation and the native scroll frame can see the same geometry.
        if (label.style.transform !== transform) label.style.transform = transform;
        if (label.style.width !== width) label.style.width = width;
        if (label.style.visibility !== visibility) label.style.visibility = visibility;
    }
}
