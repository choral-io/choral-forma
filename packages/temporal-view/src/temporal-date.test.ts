import { expect, it } from "vitest";
import { civilDate, dateInZone, dateKey } from "./temporal-date";

it.each(["0001-01-01", "0099-12-31", "2028-02-29", "9999-12-31"])("round-trips civil date %s literally", (value) => {
    expect(dateKey(civilDate(value))).toBe(value);
});

it("preserves extended year keys used by calendar boundary cells", () => {
    expect(dateKey(civilDate("0000-12-31"))).toBe("0000-12-31");
    const next = civilDate("9999-12-31");
    next.setUTCDate(next.getUTCDate() + 1);
    expect(dateKey(next)).toBe("+010000-01-01");
});

it("places instants using the workspace timezone rather than the browser timezone", () => {
    const instant = new Date("2026-09-20T16:30:00Z");
    expect(dateInZone(instant, "Asia/Shanghai")).toBe("2026-09-21");
    expect(dateInZone(instant, "America/Los_Angeles")).toBe("2026-09-20");
    expect(dateInZone(new Date("0001-01-01T12:00:00Z"), "UTC")).toBe("0001-01-01");
});
