// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { positionMonthLabels } from "./gantt-month-labels";

describe("month label DOM positioning", () => {
    it("does not rewrite unchanged geometry on duplicate updates or vertical scrolling", () => {
        const scroller = document.createElement("div");
        Object.defineProperty(scroller, "clientWidth", { value: 1200 });
        const label = document.createElement("span");
        label.dataset.ganttMonthStart = "0";
        label.dataset.ganttMonthEnd = "448";
        scroller.append(label);
        positionMonthLabels(scroller);
        const writes = ["transform", "width", "visibility"].map((property) =>
            vi.spyOn(label.style, property as "transform" | "width" | "visibility", "set"),
        );
        positionMonthLabels(scroller);
        scroller.scrollTop = 300;
        positionMonthLabels(scroller);
        const counts = writes.map((write) => write.mock.calls.length);
        for (const write of writes) write.mockRestore();
        expect(counts).toEqual([0, 0, 0]);
    });

    it("centers in the visible intersection and preserves it across left extension", () => {
        const scroller = document.createElement("div");
        Object.defineProperty(scroller, "clientWidth", { value: 1200 });
        const label = document.createElement("span");
        scroller.append(label);
        label.dataset.ganttMonthStart = "0";
        label.dataset.ganttMonthEnd = "448";
        positionMonthLabels(scroller);
        expect(label.style.transform).toBe("translateX(0px)");
        expect(label.style.width).toBe("448px");

        // The same visible dates after the track grows by 90 days.
        scroller.scrollLeft = 2520;
        label.dataset.ganttMonthStart = "2100";
        label.dataset.ganttMonthEnd = "2968";
        positionMonthLabels(scroller);
        expect(label.style.transform).toBe("translateX(420px)");
        expect(label.style.width).toBe("448px");
        expect(2100 - scroller.scrollLeft + 420).toBe(0);
    });

    it("clips the trailing month and hides labels outside the timeline viewport", () => {
        const scroller = document.createElement("div");
        Object.defineProperty(scroller, "clientWidth", { value: 1200 });
        const label = document.createElement("span");
        scroller.append(label);
        label.dataset.ganttMonthStart = "448";
        label.dataset.ganttMonthEnd = "1288";
        positionMonthLabels(scroller);
        expect(label.style.width).toBe("532px");
        expect(label.style.visibility).toBe("visible");
        scroller.scrollLeft = 1300;
        positionMonthLabels(scroller);
        expect(label.style.width).toBe("0px");
        expect(label.style.visibility).toBe("hidden");
    });
});
