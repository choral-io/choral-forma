import { describe, expect, it } from "vitest";

import { shouldRevealProjectionStickyHeader } from "./projection-sticky-boundary";

describe("projection sticky header boundary", () => {
    it("stays hidden while the authoritative header remains above the sticky threshold", () => {
        expect(
            shouldRevealProjectionStickyHeader({
                boundaryBottom: 900,
                sourceBottom: 113,
                stickyHeight: 38,
                stickyTop: 112,
            }),
        ).toBe(false);
    });

    it("reveals after the authoritative header crosses the sticky threshold", () => {
        expect(
            shouldRevealProjectionStickyHeader({
                boundaryBottom: 900,
                sourceBottom: 112,
                stickyHeight: 38,
                stickyTop: 112,
            }),
        ).toBe(true);
    });

    it("hides before the sticky header can cross the projection boundary", () => {
        expect(
            shouldRevealProjectionStickyHeader({
                boundaryBottom: 150,
                sourceBottom: -200,
                stickyHeight: 38,
                stickyTop: 112,
            }),
        ).toBe(false);
    });
});
