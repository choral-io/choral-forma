import { expect, it } from "vitest";
import { calendarEventLabel, type CalendarEvent, type CalendarProjection } from "./calendar";
import fixture from "./fixtures/calendar-core.json";

it("consumes mixed civil and timed events from real Core output", () => {
    const projection = fixture as CalendarProjection;
    expect(projection.events).toHaveLength(projection.counts.scheduled);
    expect(projection.unscheduled).toHaveLength(projection.counts.unscheduled);
    const labels = projection.events.map((event) => calendarEventLabel(event, projection.timeZone, "en-US"));
    expect(labels[0]).toBe("2028-02-28 – 2028-03-01 · All day");
    expect(labels[2]).toContain("Mar 2, 2028, 11:00 PM");
    expect(labels[2]).toContain("Mar 3, 2028, 12:00 AM");
    expect(labels[2]).toContain("end exclusive");
    expect(labels[3]).toBe("Mar 3, 2028, 12:30 AM (Asia/Kuala_Lumpur)");
});

it("shows inclusive authored all-day ends and explicit timed endpoints", () => {
    const event: CalendarEvent = {
        path: "x.md",
        title: "X",
        firstDate: "2028-02-28",
        afterLastDate: "2028-03-02",
        temporal: { kind: "date", start: "2028-02-28", endExclusive: "2028-03-02" },
    };
    expect(calendarEventLabel(event, "America/Los_Angeles")).toBe("2028-02-28 – 2028-03-01 · All day");
    expect(
        calendarEventLabel(
            { ...event, temporal: { kind: "date", start: "2028-02-29", endExclusive: "2028-03-01" } },
            "Asia/Shanghai",
        ),
    ).toBe("2028-02-29 · All day");
    const timed = {
        ...event,
        temporal: { kind: "datetime" as const, start: "2026-09-20T16:30:00Z", endExclusive: null },
    };
    expect(calendarEventLabel(timed, "Asia/Shanghai", "en-US")).toContain("Sep 21, 2026");
});
