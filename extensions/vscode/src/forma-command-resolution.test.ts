import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
    formaCommandSourceLabel,
    formatFormaCommandProbe,
    resolveRuntimeFormaCommand,
} from "./forma-command-resolution.ts";

describe("Forma runtime command resolution", () => {
    it("keeps an explicit machine path authoritative", async () => {
        const isFile = vi.fn(async () => true);
        await expect(
            resolveRuntimeFormaCommand(" /opt/forma/bin/forma ", "/storage", "0.1.0-alpha.17", isFile, "darwin"),
        ).resolves.toEqual({ command: "/opt/forma/bin/forma", source: "explicit" });
        expect(isFile).not.toHaveBeenCalled();
    });

    it("prefers a release-aligned managed binary over PATH", async () => {
        const isFile = vi.fn(async () => true);
        await expect(
            resolveRuntimeFormaCommand(undefined, "/storage", "0.1.0-alpha.17", isFile, "darwin"),
        ).resolves.toEqual({
            command: join("/storage", "cli", "0.1.0-alpha.17", "forma"),
            source: "managed",
        });
    });

    it("falls back to the Extension Host PATH", async () => {
        await expect(
            resolveRuntimeFormaCommand(undefined, "/storage", "0.1.0-alpha.17", async () => false, "darwin"),
        ).resolves.toEqual({ command: "forma", source: "path" });
    });

    it.each([
        ["explicit", "forma.path"],
        ["managed", "managed extension storage"],
        ["path", "Extension Host PATH"],
    ] as const)("describes the %s source", (source, label) => {
        expect(formaCommandSourceLabel(source)).toBe(label);
    });

    it("logs a bounded single-line probe record", () => {
        const command = `/tmp/${"nested ".repeat(80)}\nforma`;
        const formatted = formatFormaCommandProbe(
            { command, source: "managed" },
            "0.1.0-alpha.17",
            "missing",
            `failed\n${"x".repeat(3_000)}`,
        );

        expect(formatted).toContain("source=managed");
        expect(formatted).toContain("expected=0.1.0-alpha.17 actual=missing");
        expect(formatted).toContain('error="failed ');
        expect(formatted).not.toContain("\n");
        expect(formatted.length).toBeLessThanOrEqual(2_340);
    });
});
