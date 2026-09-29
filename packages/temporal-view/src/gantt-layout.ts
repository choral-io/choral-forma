import type { GanttRow } from "@choral-forma/shared";

// UTC is a civil-date container here, never the event's instant or timezone.
export function dayIndex(value: string): number {
    return Math.round(new Date(`${value}T00:00:00Z`).getTime() / 86_400_000);
}
export function dayKey(value: number): string {
    return new Date(value * 86_400_000).toISOString().slice(0, 10);
}
export const FIRST_DAY = dayIndex("0001-01-01");
export const AFTER_LAST_DAY = dayIndex("9999-12-31");
export const ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 64;
export const TITLE_WIDTH = 220;
// Deliberately below measured engine clamps; actual layout is also checked.
export const SIZE_BUDGET = 1_000_000;
export const DAY_WIDTHS = [4, 10, 28, 48] as const;
/**
 * Lanes that separate the connectors leaving one predecessor.
 *
 * Without lanes, edges from one predecessor whose target rows lie on the same
 * side share an initial riser. This is expected trunk geometry, not a collision;
 * direction means vertical target-row order, not date order. Aggregate line
 * coverage cannot distinguish shared trunks from independent overlaps, so its
 * percentage does not establish a collision defect. Lanes are a visual cue
 * intended to make fan-out arity easier to distinguish at the source.
 *
 * Two measured boundaries fix the numbers rather than taste. Eight lanes
 * reached past a successor's start on the fixtures, and six reach into the
 * eight-pixel approach at the smallest gap that still takes the direct route,
 * which is why rendering clamps. And the step must not divide a day width, or
 * connectors from different predecessors realign on one offset: three divides
 * none of the configured widths, while four resonates with the four-pixel day
 * and measured worse than no lanes at all.
 *
 * Where the corridor between two bars is shorter than the fan, the clamp puts
 * the surplus edges back onto a shared riser. Spreading lanes evenly across
 * whatever room exists was measured as an alternative and recovered nothing,
 * because a finish-to-start successor starting immediately leaves no corridor.
 */
export const CONNECTOR_LANES = 6;
export const CONNECTOR_LANE_STEP = 3;

/** Route pixel endpoints using a preassigned lane; independent of mounted rows and selection. */
export function connectorPath(from: { x: number; y: number }, to: { x: number; y: number }, lane: number): string {
    const gap = 8;
    const direct = to.x >= from.x + gap * 2;
    // Preserve an 8px approach. Narrow corridors share the last available lane;
    // overlapping successors are ordinary data, not scheduling conflicts.
    const offset = direct ? Math.min(lane, Math.floor((to.x - from.x - gap * 2) / CONNECTOR_LANE_STEP)) : 0;
    const riser = from.x + gap + CONNECTOR_LANE_STEP * offset;
    const detour = to.y + (from.y < to.y ? -ROW_HEIGHT / 2 : ROW_HEIGHT / 2);
    return direct
        ? `M ${String(from.x)} ${String(from.y)} H ${String(riser)} V ${String(to.y)} H ${String(to.x)}`
        : `M ${String(from.x)} ${String(from.y)} H ${String(riser)} V ${String(detour)} H ${String(to.x - gap)} V ${String(to.y)} H ${String(to.x)}`;
}
/**
 * Day columns kept to the left of a located bar's start.
 *
 * Measured in columns rather than pixels, so the lead-in is the same amount of
 * time at every day width: a viewer always sees two days before the bar begins,
 * whether a day is four pixels or forty-eight.
 */
export const LOCATE_LEAD_COLUMNS = 2;
export interface GanttRange {
    start: number;
    end: number;
}
export function jumpDay(value: string): number | undefined {
    if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const day = dayIndex(value);
    return Number.isFinite(day) && day >= FIRST_DAY && day < AFTER_LAST_DAY && dayKey(day) === value ? day : undefined;
}
export function fitsRange(range: GanttRange, width: number, rows: number): boolean {
    return (
        Number.isInteger(range.start) &&
        Number.isInteger(range.end) &&
        Number.isFinite(width) &&
        width > 0 &&
        Number.isInteger(rows) &&
        rows >= 0 &&
        range.start >= FIRST_DAY &&
        range.end <= AFTER_LAST_DAY &&
        range.end > range.start &&
        (range.end - range.start) * width + TITLE_WIDTH <= SIZE_BUDGET &&
        rows * ROW_HEIGHT + HEADER_HEIGHT <= SIZE_BUDGET
    );
}

/** Keep a date at the viewport's leading edge, including when zooming out. */
export function rangeForAnchor(
    range: GanttRange,
    day: number,
    width: number,
    viewportWidth: number,
    rows: number,
): GanttRange | undefined {
    if (!Number.isFinite(day) || day < FIRST_DAY || day >= AFTER_LAST_DAY || !Number.isFinite(width) || width <= 0)
        return undefined;
    const next = {
        start: Math.min(range.start, Math.floor(day)),
        end: Math.min(
            AFTER_LAST_DAY,
            Math.max(range.end, Math.ceil(day) + Math.max(30, Math.ceil((viewportWidth - TITLE_WIDTH) / width) + 2)),
        ),
    };
    return fitsRange(next, width, rows) ? next : undefined;
}
export function initialRange(
    rows: GanttRow[],
    today: string,
): { range: GanttRange; width: number; available: boolean } {
    let start = rows.length ? AFTER_LAST_DAY : (jumpDay(today) ?? FIRST_DAY);
    let end = rows.length ? FIRST_DAY : start + 1;
    for (const row of rows) {
        start = Math.min(start, dayIndex(row.firstDate));
        end = Math.max(end, dayIndex(row.afterLastDate));
    }
    const range = { start: Math.max(FIRST_DAY, start - 14), end: Math.min(AFTER_LAST_DAY, end + 30) };
    const width = [28, 10, 4].find((width) => fitsRange(range, width, rows.length));
    return { range, width: width ?? 4, available: width !== undefined };
}
export function extendRange(range: GanttRange, side: "left" | "right", width: number): GanttRange {
    const capacity = Math.max(0, Math.floor((SIZE_BUDGET - TITLE_WIDTH) / width) - (range.end - range.start));
    const amount = Math.min(90, capacity, side === "left" ? range.start - FIRST_DAY : AFTER_LAST_DAY - range.end);
    return side === "left"
        ? { start: range.start - amount, end: range.end }
        : { start: range.start, end: range.end + amount };
}
export function windowIndices(offset: number, viewport: number, size: number, count: number, overscan = 4) {
    const start = Math.max(0, Math.min(count, Math.floor(offset / size) - overscan));
    return { start, end: Math.min(count, Math.ceil((offset + viewport) / size) + overscan) };
}

/** Sparse labels at small scales, without changing civil-day bar geometry. */
export function dayTicks(range: GanttRange, window: { start: number; end: number }, width: number) {
    const step = width >= 28 ? 1 : width >= 10 ? 7 : 14;
    const first = Math.ceil((range.start + window.start) / step) * step;
    const end = Math.min(range.end, range.start + window.end);
    const ticks = [];
    for (let day = first; day < end; day += step) {
        const key = dayKey(day);
        ticks.push({ day, label: width >= 28 ? key.slice(8) : key.slice(5), width: step * width });
    }
    return ticks;
}

/** Full month boundaries for only the visible columns; years 1–99 stay literal. */
export function monthBands(range: GanttRange, window: { start: number; end: number }) {
    const first = Math.max(range.start, range.start + window.start);
    const last = Math.min(range.end, range.start + window.end);
    if (first >= last) return [];
    let cursor = dayIndex(`${dayKey(first).slice(0, 7)}-01`);
    const bands = [];
    while (cursor < last) {
        const key = dayKey(cursor).slice(0, 7);
        const date = new Date(cursor * 86_400_000);
        date.setUTCMonth(date.getUTCMonth() + 1);
        const next = Math.min(AFTER_LAST_DAY, date.getTime() / 86_400_000);
        bands.push({ key, start: Math.max(range.start, cursor), end: Math.min(range.end, next) });
        cursor = next;
    }
    return bands;
}
