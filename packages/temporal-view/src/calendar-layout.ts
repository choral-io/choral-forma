import type { CalendarEvent } from "@choral-forma/shared";
import { civilDate, dateKey } from "./temporal-date";

/** Native controls serialize ISO values regardless of the displayed locale. */
export function calendarJumpMonth(value: string, type: "month" | "date"): string | undefined {
    const pattern = type === "month" ? /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/ : /^(?!0000)\d{4}-(0[1-9]|1[0-2])-\d{2}$/;
    if (!pattern.test(value)) return undefined;
    if (type === "date") {
        const date = civilDate(value);
        if (!Number.isFinite(date.getTime()) || dateKey(date) !== value) return undefined;
    }
    return value.slice(0, 7);
}

/** Keep the native popover inside the viewport without relying on CSS anchors. */
export function calendarJumpPosition(
    anchor: { left: number; bottom: number },
    panel: { width: number; height: number },
    viewport: { width: number; height: number },
) {
    const margin = 16;
    return {
        left: Math.max(margin, Math.min(anchor.left, viewport.width - panel.width - margin)),
        top: Math.max(margin, Math.min(anchor.bottom + 8, viewport.height - panel.height - margin)),
    };
}

export function shiftMonth(month: string, delta: number): string {
    const date = civilDate(`${month}-01`);
    date.setUTCMonth(date.getUTCMonth() + delta);
    return dateKey(date).slice(0, 7);
}
export function monthDays(month: string, firstDay: "monday" | "sunday"): string[] {
    const date = civilDate(`${month}-01`);
    const offset = (date.getUTCDay() + (firstDay === "monday" ? 6 : 0)) % 7;
    const last = new Date(date);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const length = Math.ceil((offset + last.getUTCDate()) / 7) * 7;
    date.setUTCDate(1 - offset);
    return Array.from({ length }, () => {
        const key = dateKey(date);
        date.setUTCDate(date.getUTCDate() + 1);
        return key;
    });
}
export function overlaps(event: CalendarEvent, start: string, end: string): boolean {
    return event.firstDate < end && event.afterLastDate > start;
}

/** Layout measurements only; temporal semantics remain in Core. */
export function calendarPreviewWindow(height: number, bottoms: number[], total: number, lineHeight: number) {
    const visible = bottoms.filter((bottom) => bottom <= height + 0.5).length;
    return {
        visible,
        fade: visible < total ? Math.max(bottoms[visible - 1] ?? 0, height - lineHeight) : undefined,
    };
}
