import { describe, expect, it, vi } from "vitest";

import { retryCancelledCommandAfterGenerationStabilizes } from "./cancelled-command-retry.ts";
import { FormaCommandError } from "./forma-client.ts";

describe("retryCancelledCommandAfterGenerationStabilizes", () => {
    it("retries a cancelled command once after the analysis generation stabilizes", async () => {
        const operation = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new FormaCommandError("cancelled", "cancelled"))
            .mockResolvedValueOnce("inspected");
        const generations = [1, 2, 2];
        let generationIndex = 0;
        const wait = vi.fn(async () => {
            generationIndex += 1;
        });

        await expect(
            retryCancelledCommandAfterGenerationStabilizes(
                operation,
                () => generations[generationIndex] ?? 2,
                () => true,
                wait,
                100,
                5,
            ),
        ).resolves.toBe("inspected");

        expect(operation).toHaveBeenCalledTimes(2);
        expect(wait).toHaveBeenCalledTimes(2);
        expect(wait).toHaveBeenCalledWith(100);
    });

    it("does not retry other failures", async () => {
        const operation = vi.fn<() => Promise<never>>().mockRejectedValue(new Error("failed"));
        const wait = vi.fn(async () => undefined);

        await expect(
            retryCancelledCommandAfterGenerationStabilizes(
                operation,
                () => 1,
                () => true,
                wait,
            ),
        ).rejects.toThrow("failed");

        expect(operation).toHaveBeenCalledTimes(1);
        expect(wait).not.toHaveBeenCalled();
    });

    it("does not retry a second cancellation", async () => {
        const operation = vi
            .fn<() => Promise<never>>()
            .mockRejectedValue(new FormaCommandError("cancelled", "cancelled"));

        await expect(
            retryCancelledCommandAfterGenerationStabilizes(
                operation,
                () => 1,
                () => true,
                async () => undefined,
            ),
        ).rejects.toMatchObject({ kind: "cancelled" });

        expect(operation).toHaveBeenCalledTimes(2);
    });

    it("bounds the stability wait before retrying", async () => {
        const operation = vi
            .fn<() => Promise<string>>()
            .mockRejectedValueOnce(new FormaCommandError("cancelled", "cancelled"))
            .mockResolvedValueOnce("inspected");
        let currentGeneration = 0;
        const wait = vi.fn(async () => {
            currentGeneration += 1;
        });

        await expect(
            retryCancelledCommandAfterGenerationStabilizes(
                operation,
                () => currentGeneration,
                () => true,
                wait,
                100,
                3,
            ),
        ).resolves.toBe("inspected");

        expect(wait).toHaveBeenCalledTimes(3);
        expect(operation).toHaveBeenCalledTimes(2);
    });

    it("does not retry after the caller becomes ineligible", async () => {
        const operation = vi
            .fn<() => Promise<never>>()
            .mockRejectedValue(new FormaCommandError("cancelled", "cancelled"));

        await expect(
            retryCancelledCommandAfterGenerationStabilizes(
                operation,
                () => 1,
                () => false,
                async () => undefined,
            ),
        ).rejects.toMatchObject({ kind: "cancelled" });

        expect(operation).toHaveBeenCalledTimes(1);
    });
});
