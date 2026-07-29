import { describe, expect, it, vi } from "vitest";

import {
    measureWarmPerformance,
    statistics,
    warmP95BudgetMs,
    warmSampleCount,
    type SampleDurations,
} from "./performance-gate.ts";

const passingDistribution = Array.from({ length: warmSampleCount }, () => warmP95BudgetMs);
const failingDistribution = Array.from({ length: warmSampleCount }, () => warmP95BudgetMs + 1);

describe("measureWarmPerformance", () => {
    it("passes after one within-budget complete distribution", async () => {
        const sampleDurations = vi.fn<SampleDurations>().mockResolvedValue(passingDistribution);

        const result = await measureWarmPerformance(async () => undefined, { sampleDurations });

        expect(sampleDurations).toHaveBeenCalledTimes(1);
        expect(sampleDurations).toHaveBeenCalledWith(warmSampleCount, expect.any(Function));
        expect(result).toMatchObject({
            passed: true,
            measurement: { p95Ms: warmP95BudgetMs },
            attempts: [{ p95Ms: warmP95BudgetMs }],
        });
    });

    it("retries one full distribution after an initial breach and accepts the second result", async () => {
        const sampleDurations = vi
            .fn<SampleDurations>()
            .mockResolvedValueOnce(failingDistribution)
            .mockResolvedValueOnce(passingDistribution);

        const result = await measureWarmPerformance(async () => undefined, { sampleDurations });

        expect(sampleDurations).toHaveBeenCalledTimes(2);
        expect(result.passed).toBe(true);
        expect(result.measurement.p95Ms).toBe(warmP95BudgetMs);
        expect(result.attempts.map(({ p95Ms }) => p95Ms)).toEqual([warmP95BudgetMs + 1, warmP95BudgetMs]);
    });

    it("fails when both complete distributions breach the p95 budget", async () => {
        const sampleDurations = vi.fn<SampleDurations>().mockResolvedValue(failingDistribution);

        const result = await measureWarmPerformance(async () => undefined, { sampleDurations });

        expect(sampleDurations).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({
            passed: false,
            measurement: { p95Ms: warmP95BudgetMs + 1 },
            attempts: [{ p95Ms: warmP95BudgetMs + 1 }, { p95Ms: warmP95BudgetMs + 1 }],
        });
    });
});

describe("statistics", () => {
    it("uses nearest-rank percentile boundaries and rounds results", () => {
        const values = Array.from({ length: 20 }, (_, index) => index + 0.1234);

        expect(statistics(values)).toEqual({
            minimumMs: 0.123,
            medianMs: 9.123,
            p95Ms: 18.123,
            maximumMs: 19.123,
        });
    });

    it("rejects empty or invalid sample distributions", () => {
        expect(() => statistics([])).toThrow("at least one sample");
        expect(() => statistics([1, Number.NaN])).toThrow("finite, non-negative samples");
        expect(() => statistics([-1])).toThrow("finite, non-negative samples");
    });

    it("rejects invalid gate configuration before sampling", async () => {
        const sampleDurations = vi.fn<SampleDurations>();

        await expect(
            measureWarmPerformance(async () => undefined, { sampleDurations, sampleCount: 0 }),
        ).rejects.toThrow("positive integer");
        await expect(
            measureWarmPerformance(async () => undefined, { sampleDurations, p95BudgetMs: Number.POSITIVE_INFINITY }),
        ).rejects.toThrow("finite, non-negative");
        expect(sampleDurations).not.toHaveBeenCalled();
    });

    it.each([1, warmSampleCount - 1, warmSampleCount + 1])(
        "rejects an incomplete or oversized %i-sample distribution",
        async (returnedSamples) => {
            const sampleDurations = vi
                .fn<SampleDurations>()
                .mockResolvedValue(Array.from({ length: returnedSamples }, () => 1));

            await expect(measureWarmPerformance(async () => undefined, { sampleDurations })).rejects.toThrow(
                `complete ${String(warmSampleCount)}-sample distribution`,
            );
        },
    );
});
