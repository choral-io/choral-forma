// @vitest-environment jsdom

import { expect, it } from "vitest";
import { clipConnectors } from "./gantt-connector-clip";
import { HEADER_HEIGHT } from "./gantt-layout";

function scroller(left: number, top: number) {
    const element = document.createElement("div");
    element.innerHTML = '<div><svg data-gantt-connectors=""></svg></div>';
    Object.defineProperty(element, "scrollLeft", { configurable: true, value: left });
    Object.defineProperty(element, "scrollTop", { configurable: true, value: top });
    return element;
}
function clipOf(element: HTMLElement) {
    return element.querySelector<SVGElement>("svg")?.style.clipPath;
}

it("hides the part of the connector layer that lies behind each sticky edge", () => {
    const element = scroller(640, 120);
    clipConnectors(element);
    // The layer shares the track's origin, so the left inset is the scroll offset
    // itself, and the top inset also clears the header the layer extends under.
    expect(clipOf(element)).toBe(`inset(${String(120 + HEADER_HEIGHT)}px 0 0 640px)`);
});

it("clips nothing away at the origin except the header band", () => {
    const element = scroller(0, 0);
    clipConnectors(element);
    expect(clipOf(element)).toBe(`inset(${String(HEADER_HEIGHT)}px 0 0 0px)`);
});

it("ignores overscroll rather than inverting the clip", () => {
    const element = scroller(-40, -30);
    clipConnectors(element);
    expect(clipOf(element)).toBe(`inset(${String(HEADER_HEIGHT)}px 0 0 0px)`);
});

it("leaves a timeline without a connector layer alone", () => {
    const element = document.createElement("div");
    element.innerHTML = "<div></div>";
    expect(() => {
        clipConnectors(element);
    }).not.toThrow();
});
