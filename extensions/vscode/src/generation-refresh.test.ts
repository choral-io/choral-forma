import { describe, expect, it, vi } from "vitest";

import { GenerationRefresh } from "./generation-refresh.ts";

describe("GenerationRefresh", () => {
    it("joins equivalent refreshes from the same generation", async () => {
        const refreshes = new GenerationRefresh();
        const refresh = vi.fn(async () => undefined);
        await Promise.all(Array.from({ length: 10 }, () => refreshes.run(1, refresh)));
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("performs one follow-up when a newer generation arrives", async () => {
        const refreshes = new GenerationRefresh();
        let complete: (() => void) | undefined;
        const refresh = vi.fn(async () => {
            if (refresh.mock.calls.length === 1) await new Promise<void>((resolve) => (complete = resolve));
        });
        const first = refreshes.run(1, refresh);
        const second = refreshes.run(2, refresh);
        const third = refreshes.run(3, refresh);
        complete?.();
        await Promise.all([first, second, third]);
        expect(refresh).toHaveBeenCalledTimes(2);
    });
});
