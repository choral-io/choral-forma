import { performance } from "node:perf_hooks";

export const warmSampleCount = 50;
export const warmP95BudgetMs = 100;

export type DurationStatistics = {
    minimumMs: number;
    medianMs: number;
    p95Ms: number;
    maximumMs: number;
};

export type WarmPerformanceMeasurement = {
    measurement: DurationStatistics;
    attempts: DurationStatistics[];
    passed: boolean;
};

export type SampleDurations = (samples: number, operation: () => Promise<void>) => Promise<number[]>;

export type WarmPerformanceGateOptions = {
    sampleDurations?: SampleDurations;
    sampleCount?: number;
    p95BudgetMs?: number;
};

export async function measureWarmPerformance(
    operation: () => Promise<void>,
    {
        sampleDurations: collectSamples = sampleDurations,
        sampleCount = warmSampleCount,
        p95BudgetMs = warmP95BudgetMs,
    }: WarmPerformanceGateOptions = {},
): Promise<WarmPerformanceMeasurement> {
    assertValidConfiguration(sampleCount, p95BudgetMs);
    const collectDistribution = async (): Promise<DurationStatistics> => {
        const samples = await collectSamples(sampleCount, operation);
        if (samples.length !== sampleCount) {
            throw new Error(
                `Warm performance sampling requires a complete ${String(sampleCount)}-sample distribution; received ${String(samples.length)}.`,
            );
        }
        return statistics(samples);
    };
    const firstAttempt = await collectDistribution();
    const attempts = [firstAttempt];
    if (firstAttempt.p95Ms > p95BudgetMs) {
        attempts.push(await collectDistribution());
    }
    const measurement = attempts.at(-1);
    if (!measurement) throw new Error("Warm performance measurement did not produce a distribution.");
    return {
        measurement,
        attempts,
        passed: measurement.p95Ms <= p95BudgetMs,
    };
}

export function statistics(values: readonly number[]): DurationStatistics {
    if (values.length === 0) throw new Error("Performance statistics require at least one sample.");
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new Error("Performance statistics require finite, non-negative samples.");
    }
    const sorted = [...values].sort((left, right) => left - right);
    const minimum = sorted[0];
    if (minimum === undefined) throw new Error("Performance statistics require at least one sample.");
    const percentile = (fraction: number): number => {
        const value = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
        if (value === undefined) throw new Error("Performance percentile could not be calculated.");
        return value;
    };
    return {
        minimumMs: round(minimum),
        medianMs: round(percentile(0.5)),
        p95Ms: round(percentile(0.95)),
        maximumMs: round(sorted.at(-1) ?? 0),
    };
}

async function sampleDurations(samples: number, operation: () => Promise<void>): Promise<number[]> {
    const durations: number[] = [];
    for (let index = 0; index < samples; index += 1) {
        durations.push((await timed(operation)).durationMs);
    }
    return durations;
}

async function timed<T>(operation: () => Promise<T>): Promise<{ durationMs: number; result: T }> {
    const started = performance.now();
    const result = await operation();
    return { durationMs: performance.now() - started, result };
}

function assertValidConfiguration(sampleCount: number, p95BudgetMs: number): void {
    if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
        throw new Error("Warm performance sample count must be a positive integer.");
    }
    if (!Number.isFinite(p95BudgetMs) || p95BudgetMs < 0) {
        throw new Error("Warm performance p95 budget must be a finite, non-negative number.");
    }
}

function round(value: number): number {
    return Number(value.toFixed(3));
}
