import { describe, expect, it } from "vitest";

import { activeHeadingId } from "./reading-position";

describe("activeHeadingId", () => {
    const ids = ["intro", "setup", "usage"];

    it("is undefined before the first heading reaches the reading line", () => {
        expect(activeHeadingId(ids, [120, 600, 900], 96)).toBeUndefined();
    });

    it("picks the last heading at or above the reading line", () => {
        expect(activeHeadingId(ids, [-400, 96, 500], 96)).toBe("setup");
        expect(activeHeadingId(ids, [-900, -400, -10], 96)).toBe("usage");
    });

    it("skips headings that are not rendered", () => {
        expect(activeHeadingId(ids, [-400, undefined, 500], 96)).toBe("intro");
        expect(activeHeadingId(ids, [undefined, undefined, undefined], 96)).toBeUndefined();
    });
});
