import { afterEach, describe, expect, it, vi } from "vitest";

import { mermaidPolicy, validateMermaidSource } from "./policy";
import { createMermaidRenderScope } from "./scope";

describe("createMermaidRenderScope", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("shares diagram and structural budgets across independent readers", () => {
        const scope = createMermaidRenderScope("visible-document");
        const diagram = validated("flowchart LR\nA --> B");
        const reservations = Array.from({ length: mermaidPolicy.scope.maxDiagrams }, () => scope.reserve(diagram));

        expect(reservations.every(Boolean)).toBe(true);
        expect(scope.reserve(diagram)).toBeUndefined();
        expect(new Set(reservations.map((reservation) => reservation?.diagramId)).size).toBe(
            mermaidPolicy.scope.maxDiagrams,
        );

        scope.dispose();
    });

    it("does not let separate readers reset aggregate structural work", () => {
        const scope = createMermaidRenderScope("visible-document");
        const diagram = validated(
            `flowchart LR\n${Array.from(
                { length: mermaidPolicy.diagram.maxStructuralNodes },
                (_, index) => `Node${String(index)}`,
            ).join("\n")}`,
        );

        expect(
            Array.from(
                { length: mermaidPolicy.scope.maxStructuralNodes / mermaidPolicy.diagram.maxStructuralNodes },
                () => scope.reserve(diagram),
            ).every(Boolean),
        ).toBe(true);
        expect(scope.reserve(diagram)).toBeUndefined();

        scope.dispose();
    });

    it("caps aggregate output across reservations", () => {
        const scope = createMermaidRenderScope("visible-document");
        const diagram = validated("flowchart LR\nA --> B");
        const first = scope.reserve(diagram);
        const second = scope.reserve(diagram);

        expect(first && scope.acceptOutput(first, mermaidPolicy.scope.maxOutputBytes)).toBe(true);
        expect(second && scope.acceptOutput(second, 1)).toBe(false);

        scope.dispose();
    });

    it("revalidates reservations and rejects invalid output accounting", () => {
        const scope = createMermaidRenderScope("visible-document");
        const diagram = validated("flowchart LR\nA --> B");
        const reservation = scope.reserve(diagram);

        expect(scope.reserve({ ...diagram, source: "flowchart LR\nA --> B trailing" })).toBeUndefined();
        expect(reservation && scope.acceptOutput(reservation, -1)).toBe(false);
        expect(reservation && scope.acceptOutput(reservation, Number.NaN)).toBe(false);

        scope.dispose();
    });

    it("aborts the whole visible scope after its aggregate deadline", async () => {
        vi.useFakeTimers();
        const scope = createMermaidRenderScope("visible-document");
        scope.reserve(validated("flowchart LR\nA --> B"));

        await vi.advanceTimersByTimeAsync(mermaidPolicy.scope.timeoutMs);

        expect(scope.signal.aborted).toBe(true);
        expect(scope.reserve(validated("flowchart LR\nC --> D"))).toBeUndefined();
    });
});

function validated(source: string) {
    const result = validateMermaidSource(source);
    if (!result.ok) {
        throw new Error(result.diagnostic.message);
    }
    return result.diagram;
}
