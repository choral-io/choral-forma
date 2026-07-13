import { describe, expect, it } from "vitest";

import { currentRefreshValue, isCurrentRefresh } from "./refresh-lifecycle.ts";

describe("runtime refresh lifecycle", () => {
    it("accepts only the current non-aborted refresh", () => {
        const current = new AbortController();
        const stale = new AbortController();

        expect(isCurrentRefresh(current, current)).toBe(true);
        expect(isCurrentRefresh(stale, current)).toBe(false);
        current.abort();
        expect(isCurrentRefresh(current, current)).toBe(false);
    });

    it("exposes an async result only to the refresh that is still current", () => {
        const current = new AbortController();
        const stale = new AbortController();
        const discovery = { roots: ["/workspace"] };

        expect(currentRefreshValue(current, current, discovery)).toBe(discovery);
        expect(currentRefreshValue(stale, current, discovery)).toBeUndefined();
        current.abort();
        expect(currentRefreshValue(current, current, discovery)).toBeUndefined();
    });
});
