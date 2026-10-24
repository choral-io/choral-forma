// @vitest-environment jsdom
import { expect, it } from "vitest";
import { mediaWheelZoomFactor } from "./media-viewer-gestures";

it("matches Flows modifier, wheel-unit and event-splitting semantics", () => {
    const wheel = (options: WheelEventInit) => mediaWheelZoomFactor(new WheelEvent("wheel", options), 600);
    expect(wheel({ deltaY: -10 })).toBeUndefined();
    expect(wheel({ ctrlKey: true, deltaY: 0 })).toBeUndefined();
    expect(
        mediaWheelZoomFactor({ ctrlKey: true, deltaMode: 0, deltaY: NaN, deltaX: 0 } as WheelEvent, 600),
    ).toBeUndefined();
    expect(wheel({ ctrlKey: true, deltaY: -10 })).toBeCloseTo(Math.exp(0.2));
    expect(wheel({ metaKey: true, deltaY: -10 })).toBeCloseTo(Math.exp(0.2));
    expect(wheel({ metaKey: true, deltaX: -10 })).toBeCloseTo(Math.exp(0.2));
    expect(wheel({ ctrlKey: true, deltaMode: 1, deltaY: -1 })).toBeCloseTo(Math.exp(0.32));
    expect(wheel({ ctrlKey: true, deltaMode: 2, deltaY: -1 })).toBeCloseTo(Math.exp(12));
    expect(wheel({ ctrlKey: true, deltaY: -50 })).toBeCloseTo((wheel({ ctrlKey: true, deltaY: -10 }) ?? 0) ** 5);
});
