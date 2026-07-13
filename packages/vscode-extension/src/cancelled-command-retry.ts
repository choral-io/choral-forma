import { FormaCommandError } from "./forma-client.ts";

const defaultStabilityDelayMs = 100;
const defaultMaxStabilityChecks = 5;

export async function retryCancelledCommandAfterGenerationStabilizes<T>(
    operation: () => Promise<T>,
    generation: () => number,
    canRetry: () => boolean,
    wait: (delayMs: number) => Promise<void> = delay,
    stabilityDelayMs = defaultStabilityDelayMs,
    maxStabilityChecks = defaultMaxStabilityChecks,
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (!(error instanceof FormaCommandError) || error.kind !== "cancelled") throw error;
    }

    let observedGeneration = generation();
    for (let check = 0; check < maxStabilityChecks; check += 1) {
        await wait(stabilityDelayMs);
        const currentGeneration = generation();
        if (currentGeneration === observedGeneration) break;
        observedGeneration = currentGeneration;
    }
    if (!canRetry()) throw new FormaCommandError("Forma command was cancelled.", "cancelled");
    return await operation();
}

async function delay(delayMs: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
