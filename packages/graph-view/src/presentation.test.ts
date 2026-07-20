import { describe, expect, it } from "vitest";

import { graphExpandPresentation, graphSummaryPresentation } from "./presentation.ts";

describe("shared graph presentation", () => {
    it("uses the same page-local expansion labels in every Host", () => {
        expect(graphExpandPresentation(false)).toEqual({ ariaLabel: "Expand graph", title: "Expand graph" });
        expect(graphExpandPresentation(true)).toEqual({
            ariaLabel: "Exit expanded graph",
            title: "Exit expanded graph",
        });
    });

    it("produces a stable accessible selection summary", () => {
        const first = graphSummaryPresentation({ path: "notes/one.md", title: "One" }, 3);
        const repeated = graphSummaryPresentation({ path: "notes/one.md", title: "One" }, 3);
        const changed = graphSummaryPresentation({ path: "notes/one.md", title: "One" }, 4);

        expect(first?.fingerprint).toBe(repeated?.fingerprint);
        expect(changed?.fingerprint).not.toBe(first?.fingerprint);
        expect(graphSummaryPresentation(undefined, 0)).toBeUndefined();
    });
});
