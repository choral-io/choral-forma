import { expect, it } from "vitest";
import {
    AFTER_LAST_DAY,
    FIRST_DAY,
    SIZE_BUDGET,
    TITLE_WIDTH,
    dayIndex,
    dayKey,
    dayTicks,
    extendRange,
    fitsRange,
    initialRange,
    jumpDay,
    monthBands,
    rangeForAnchor,
    windowIndices,
} from "./gantt-layout";

it("maps Gregorian civil dates without DST or short-year inference", () => {
    expect(dayIndex("2026-03-09") - dayIndex("2026-03-08")).toBe(1);
    expect(dayIndex("2026-11-02") - dayIndex("2026-11-01")).toBe(1);
    expect(dayKey(dayIndex("0001-01-01"))).toBe("0001-01-01");
    expect(jumpDay("2028-02-29")).toBe(dayIndex("2028-02-29"));
    for (const value of ["2027-02-29", "0000-01-01", "9999-12-31", "10000-01-01", "garbage"])
        expect(jumpDay(value)).toBeUndefined();
});

it("keeps low-zoom ticks readable, bounded and stable across range extensions", () => {
    const start = dayIndex("2026-12-20");
    const range = { start, end: start + 100 };
    for (const width of [4, 10, 28, 48]) {
        const ticks = dayTicks(range, { start: 0, end: 40 }, width);
        expect(ticks.length).toBeGreaterThan(0);
        expect(ticks.every((tick) => tick.day >= start && tick.day < start + 40)).toBe(true);
        expect(ticks.every((tick) => tick.width >= 28)).toBe(true);
        expect(ticks).toEqual(dayTicks({ start: start - 90, end: range.end }, { start: 90, end: 130 }, width));
        expect(ticks.some((tick) => tick.label.startsWith(width >= 28 ? "0" : "01-"))).toBe(true);
    }
});

it("rejects invalid geometry and anchors before scheduling viewport changes", () => {
    const range = { start: 0, end: 100 };
    for (const width of [0, -1, NaN, Infinity]) {
        expect(fitsRange(range, width, 1)).toBe(false);
        expect(rangeForAnchor(range, 50, width, 800, 1)).toBeUndefined();
    }
    for (const day of [NaN, Infinity, FIRST_DAY - 1, AFTER_LAST_DAY])
        expect(rangeForAnchor(range, day, 28, 800, 1)).toBeUndefined();
    expect(fitsRange(range, 28, -1)).toBe(false);
    expect(fitsRange(range, 28, 30000)).toBe(false);
    expect(fitsRange({ start: 0.5, end: 100 }, 28, 1)).toBe(false);
});

it("groups visible dates into true month spans across leap years and both domain bounds", () => {
    const range = { start: dayIndex("2027-12-20"), end: dayIndex("2028-03-10") };
    const bands = monthBands(range, { start: 0, end: range.end - range.start });
    expect(bands.map((b) => [b.key, b.end - b.start])).toEqual([
        ["2027-12", 12],
        ["2028-01", 31],
        ["2028-02", 29],
        ["2028-03", 9],
    ]);
    expect(monthBands({ start: FIRST_DAY, end: FIRST_DAY + 5 }, { start: 0, end: 5 })[0]?.key).toBe("0001-01");
    expect(monthBands({ start: AFTER_LAST_DAY - 5, end: AFTER_LAST_DAY }, { start: 0, end: 5 })[0]?.end).toBe(
        AFTER_LAST_DAY,
    );
    expect(monthBands(range, { start: 13, end: 15 }).map((b) => b.key)).toEqual(["2028-01"]);
    expect(monthBands(range, { start: 0, end: 0 })).toEqual([]);
});
it("extends only whole columns inside temporal and renderer limits", () => {
    expect(extendRange({ start: FIRST_DAY, end: FIRST_DAY + 100 }, "left", 28).start).toBe(FIRST_DAY);
    expect(extendRange({ start: AFTER_LAST_DAY - 100, end: AFTER_LAST_DAY }, "right", 28).end).toBe(AFTER_LAST_DAY);
    const range = { start: 0, end: Math.floor((SIZE_BUDGET - TITLE_WIDTH) / 28) };
    expect(extendRange(range, "right", 28)).toEqual(range);
    expect(fitsRange(range, 28, 5000)).toBe(true);
    expect(fitsRange(range, 48, 5000)).toBe(false);
    const before = { start: 100, end: 200 };
    const next = extendRange(before, "left", 28);
    expect(500 + (before.start - next.start) * 28).toBe(3020);
});
it("windows both axes with bounded overscan and explicit empty states", () => {
    expect(windowIndices(36000, 500, 36, 5000)).toEqual({ start: 996, end: 1018 });
    expect(windowIndices(0, 500, 36, 0)).toEqual({ start: 0, end: 0 });
    expect(initialRange([], "2026-09-22").available).toBe(true);
    const row = {
        path: "a",
        temporal: { kind: "date" as const, start: "0001-01-01", endExclusive: "9999-12-31" },
        firstDate: "0001-01-01",
        afterLastDate: "9999-12-31",
        milestone: false,
    };
    expect(initialRange([row], "2026-09-22").available).toBe(false);
});

it("keeps far-date jumps and zoom-out anchors clear of native right-edge clamping", () => {
    const day = dayIndex("2030-06-15");
    const range = { start: dayIndex("2026-01-01"), end: dayIndex("2027-01-01") };
    const jumped = rangeForAnchor(range, day, 28, 1200, 5000);
    if (!jumped) throw new Error("Expected a supported jump");
    expect((jumped.end - day) * 28 + TITLE_WIDTH).toBeGreaterThanOrEqual(1200);
    const zoomed = rangeForAnchor(jumped, day, 10, 1200, 5000);
    if (!zoomed) throw new Error("Expected supported zoom");
    expect((zoomed.end - day) * 10 + TITLE_WIDTH).toBeGreaterThanOrEqual(1200);
    expect(rangeForAnchor(range, AFTER_LAST_DAY - 1, 48, 1200, 5000)).toBeUndefined();
});
