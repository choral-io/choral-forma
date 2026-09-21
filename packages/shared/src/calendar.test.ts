import { expect, it } from "vitest";
import { calendarEventLabel, type CalendarEvent } from "./calendar";

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
