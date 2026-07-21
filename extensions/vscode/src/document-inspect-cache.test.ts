import { describe, expect, it, vi } from "vitest";

import { DocumentInspectCache } from "./document-inspect-cache.ts";

describe("DocumentInspectCache", () => {
    it("deduplicates concurrent document analysis and reuses the result", async () => {
        const cache = new DocumentInspectCache<number>();
        const load = vi.fn(async () => 42);

        await expect(Promise.all(Array.from({ length: 25 }, () => cache.get("document@1", load)))).resolves.toEqual(
            Array.from({ length: 25 }, () => 42),
        );
        await expect(cache.get("document@1", load)).resolves.toBe(42);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("allows one subscriber to cancel without cancelling shared analysis", async () => {
        const cache = new DocumentInspectCache<number>();
        let complete: ((value: number) => void) | undefined;
        const load = vi.fn(async () => await new Promise<number>((resolve) => (complete = resolve)));
        const controller = new AbortController();

        const cancelled = cache.get("document@1", load, controller.signal);
        const active = cache.get("document@1", load);
        controller.abort();
        complete?.(42);

        await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
        await expect(active).resolves.toBe(42);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("does not restore a stale result after the cache is cleared", async () => {
        const cache = new DocumentInspectCache<number>();
        let complete: ((value: number) => void) | undefined;
        const stale = cache.get("document@1", async () => await new Promise<number>((resolve) => (complete = resolve)));
        cache.clear();
        complete?.(1);
        await stale;

        const load = vi.fn(async () => 2);
        await expect(cache.get("document@1", load)).resolves.toBe(2);
        expect(load).toHaveBeenCalledTimes(1);
    });
});
