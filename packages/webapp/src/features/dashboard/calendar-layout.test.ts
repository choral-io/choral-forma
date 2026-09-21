import type { CalendarEvent } from "@choral-forma/shared";
import { describe, expect, it } from "vitest";
import {
    calendarJumpMonth,
    calendarJumpPosition,
    calendarPreviewWindow,
    dateInZone,
    monthDays,
    overlaps,
    shiftMonth,
} from "./calendar-layout";

describe("Calendar month jump", () => {
    it("accepts exact native month values, including supported year boundaries", () => {
        for (const month of ["0001-01", "0099-12", "2040-03", "9999-12"]) {
            expect(calendarJumpMonth(month, "month")).toBe(month);
        }
        for (const value of ["", "0000-01", "10000-01", "2026-00", "2026-13", "2026-1", "2026-01-01", "2026-01extra"]) {
            expect(calendarJumpMonth(value, "month")).toBeUndefined();
        }
    });
    it("validates complete fallback dates without accepting rollover or partial input", () => {
        expect(calendarJumpMonth("2028-02-29", "date")).toBe("2028-02");
        expect(calendarJumpMonth("0001-01-01", "date")).toBe("0001-01");
        expect(calendarJumpMonth("9999-12-31", "date")).toBe("9999-12");
        for (const value of [
            "2027-02-29",
            "2028-02-30",
            "2026-04-31",
            "2026-01-00",
            "2026-01",
            "0000-01-01",
            "2026-01-01extra",
        ]) {
            expect(calendarJumpMonth(value, "date")).toBeUndefined();
        }
    });
    it("uses measured panel dimensions and clamps to a resized viewport", () => {
        const anchor = { left: 276, bottom: 284 };
        const panel = { width: 288, height: 166 };
        expect(calendarJumpPosition(anchor, panel, { width: 1440, height: 900 })).toEqual({ left: 276, top: 292 });
        expect(calendarJumpPosition(anchor, panel, { width: 390, height: 300 })).toEqual({ left: 86, top: 118 });
        expect(calendarJumpPosition({ left: -20, bottom: -10 }, panel, { width: 390, height: 900 })).toEqual({
            left: 16,
            top: 16,
        });
    });
});

describe("Calendar civil layout", () => {
    it("fills the preview by measured height, retaining the next item beneath a fade", () => {
        expect(calendarPreviewWindow(148, [44, 92, 140, 188], 40, 20)).toEqual({ visible: 3, fade: 140 });
        expect(calendarPreviewWindow(148, [24, 52, 80, 108, 136, 164], 40, 20)).toEqual({ visible: 5, fade: 136 });
        expect(calendarPreviewWindow(148, [24, 72, 100, 148, 176], 40, 20)).toEqual({ visible: 4, fade: 148 });
        expect(calendarPreviewWindow(148, [44, 92, 140], 3, 20)).toEqual({ visible: 3, fade: undefined });
        expect(calendarPreviewWindow(148, [], 0, 20)).toEqual({ visible: 0, fade: undefined });
    });
    it("places instants using the workspace timezone rather than the browser timezone", () => {
        const instant = new Date("2026-09-20T16:30:00Z");
        expect(dateInZone(instant, "Asia/Shanghai")).toBe("2026-09-21");
        expect(dateInZone(instant, "America/Los_Angeles")).toBe("2026-09-20");
    });
    it.each([
        ["2027-02", "monday", 28, "2027-02-01", "2027-02-28"],
        ["2026-09", "monday", 35, "2026-08-31", "2026-10-04"],
        ["2026-03", "monday", 42, "2026-02-23", "2026-04-05"],
        ["2026-02", "sunday", 28, "2026-02-01", "2026-02-28"],
        ["2026-03", "sunday", 35, "2026-03-01", "2026-04-04"],
        ["2026-05", "sunday", 42, "2026-04-26", "2026-06-06"],
        ["2026-12", "monday", 35, "2026-11-30", "2027-01-03"],
        ["2027-01", "monday", 35, "2026-12-28", "2027-01-31"],
    ] as const)("covers %s with minimal complete %s weeks", (month, firstDay, length, first, last) => {
        const days = monthDays(month, firstDay);
        expect(days).toHaveLength(length);
        expect(new Set(days).size).toBe(length);
        expect(days[0]).toBe(first);
        expect(days.at(-1)).toBe(last);
        for (let index = 1; index < days.length; index++) {
            const next = new Date(`${String(days[index - 1])}T00:00:00Z`);
            next.setUTCDate(next.getUTCDate() + 1);
            expect(next.toISOString().slice(0, 10)).toBe(days[index]);
        }
    });
    it("preserves leap days, DST civil dates, and supported year boundaries", () => {
        const leap = monthDays("2028-02", "monday");
        expect(leap[0]).toBe("2028-01-31");
        expect(leap).toContain("2028-02-29");
        const spring = monthDays("2026-03", "sunday");
        expect(new Set(spring).size).toBe(35);
        expect(spring.slice(7, 10)).toEqual(["2026-03-08", "2026-03-09", "2026-03-10"]);
        expect(shiftMonth("2026-12", 1)).toBe("2027-01");
        expect(shiftMonth("2026-01", -1)).toBe("2025-12");
        expect(monthDays("0099-02", "monday").some((day) => day.startsWith("0099-02"))).toBe(true);
        expect(monthDays("0001-01", "sunday")).toContain("0001-01-01");
        expect(monthDays("9999-12", "monday")).toContain("9999-12-31");
        expect(new Set(monthDays("9999-12", "monday")).size).toBe(monthDays("9999-12", "monday").length);
    });
    it("includes a spanning event once in each overlapping month, excluding its exclusive end", () => {
        const event: CalendarEvent = {
            path: "x.md",
            title: "X",
            firstDate: "2028-02-28",
            afterLastDate: "2028-03-02",
            temporal: { kind: "date", start: "2028-02-28", endExclusive: "2028-03-02" },
        };
        expect(overlaps(event, "2028-02-01", "2028-03-01")).toBe(true);
        expect(overlaps(event, "2028-03-01", "2028-04-01")).toBe(true);
        expect(overlaps(event, "2028-03-02", "2028-03-03")).toBe(false);
    });
});
