import { expect, it } from "vitest";
import { connectorPath } from "./gantt-layout";

it("uses the assigned lane when the direct corridor has room", () => {
    expect(connectorPath({ x: 100, y: 82 }, { x: 200, y: 118 }, 5)).toBe("M 100 82 H 123 V 118 H 200");
});

it("clamps lanes while preserving an eight-pixel successor approach", () => {
    expect(connectorPath({ x: 100, y: 82 }, { x: 116, y: 118 }, 5)).toBe("M 100 82 H 108 V 118 H 116");
    expect(connectorPath({ x: 100, y: 82 }, { x: 124, y: 118 }, 5)).toBe("M 100 82 H 114 V 118 H 124");
});

it("routes overlaps via the base riser and the row gap in either direction", () => {
    expect(connectorPath({ x: 100, y: 82 }, { x: 90, y: 154 }, 5)).toBe("M 100 82 H 108 V 136 H 82 V 154 H 90");
    expect(connectorPath({ x: 100, y: 154 }, { x: 90, y: 82 }, 5)).toBe("M 100 154 H 108 V 100 H 82 V 82 H 90");
});

it("keeps offscreen and fractional coordinates without viewport-dependent rounding", () => {
    expect(connectorPath({ x: -40.5, y: 82 }, { x: 20.5, y: 118 }, 1)).toBe("M -40.5 82 H -29.5 V 118 H 20.5");
});
