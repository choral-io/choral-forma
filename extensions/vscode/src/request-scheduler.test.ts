import { describe, expect, it, vi } from "vitest";

import { RequestScheduler } from "./request-scheduler.ts";

describe("RequestScheduler", () => {
    it("deduplicates identical in-flight requests", async () => {
        const scheduler = new RequestScheduler<number>(2);
        const task = vi.fn(async () => 42);

        await expect(Promise.all(Array.from({ length: 10 }, () => scheduler.schedule("same", task)))).resolves.toEqual(
            Array.from({ length: 10 }, () => 42),
        );
        expect(task).toHaveBeenCalledTimes(1);
    });

    it("bounds concurrency across distinct requests", async () => {
        const scheduler = new RequestScheduler<number>(2);
        let active = 0;
        let maximum = 0;
        const task = async (): Promise<number> => {
            active += 1;
            maximum = Math.max(maximum, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
            return active;
        };

        await Promise.all(Array.from({ length: 8 }, (_, index) => scheduler.schedule(String(index), task)));
        expect(maximum).toBe(2);
    });

    it("keeps shared work alive until every subscriber cancels", async () => {
        const scheduler = new RequestScheduler<number>(2);
        let underlyingSignal: AbortSignal | undefined;
        let complete: ((value: number) => void) | undefined;
        let markStarted: (() => void) | undefined;
        const started = new Promise<void>((resolve) => (markStarted = resolve));
        const task = vi.fn(
            async (signal: AbortSignal) =>
                await new Promise<number>((resolve) => {
                    underlyingSignal = signal;
                    complete = resolve;
                    markStarted?.();
                }),
        );
        const first = new AbortController();
        const second = new AbortController();
        const cancelled = scheduler.schedule("same", task, first.signal);
        const active = scheduler.schedule("same", task, second.signal);
        const cancelledExpectation = expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
        await started;
        first.abort();
        expect(underlyingSignal?.aborted).toBe(false);
        complete?.(42);

        await cancelledExpectation;
        await expect(active).resolves.toBe(42);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it("aborts current requests when invalidated", async () => {
        const scheduler = new RequestScheduler<number>(1);
        const task = async (signal: AbortSignal): Promise<number> =>
            await new Promise<number>((_resolve, reject) => {
                signal.addEventListener(
                    "abort",
                    () => {
                        reject(new DOMException("cancelled", "AbortError"));
                    },
                    { once: true },
                );
            });
        const result = scheduler.schedule("request", task);
        scheduler.invalidate();
        await expect(result).rejects.toMatchObject({ name: "AbortError" });
    });
});
