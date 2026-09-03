import { describe, expect, it } from "vitest";

import { createWorkspaceDashboardContext, latestUpdatedAt, type DashboardEntry } from "./workspace-client";

function entry(id: string, updatedAt?: string): DashboardEntry {
    return {
        id,
        path: `${id}.md`,
        routePath: `/pages/${id}`,
        title: id,
        omitLeadingTitle: false,
        summary: "",
        space: "notes",
        updatedAt,
        updatedLabel: "",
        status: "healthy",
        body: [],
        relations: { outgoing: [], backlinks: [] },
        variants: [],
    };
}

describe("latestUpdatedAt", () => {
    it("returns the most recent timestamp regardless of entry order", () => {
        const entries = [entry("a", "2026-01-01T00:00:00Z"), entry("b", "2026-03-01T00:00:00Z")];

        expect(latestUpdatedAt(entries)).toBe("2026-03-01T00:00:00Z");
        expect(latestUpdatedAt([...entries].reverse())).toBe("2026-03-01T00:00:00Z");
    });

    it("compares instants rather than text across UTC offsets", () => {
        // 2026-01-01T02:00+02:00 is midnight UTC, so it precedes the later instant
        // even though it sorts after it as a string.
        const entries = [entry("a", "2026-01-01T02:00:00+02:00"), entry("b", "2026-01-01T01:00:00Z")];

        expect(latestUpdatedAt(entries)).toBe("2026-01-01T01:00:00Z");
    });

    it("skips entries without a usable timestamp", () => {
        expect(latestUpdatedAt([entry("a"), entry("b", "not a date"), entry("c", "2026-02-01T00:00:00Z")])).toBe(
            "2026-02-01T00:00:00Z",
        );
        expect(latestUpdatedAt([entry("a")])).toBeUndefined();
        expect(latestUpdatedAt([])).toBeUndefined();
    });
});

describe("createWorkspaceDashboardContext", () => {
    it("indexes entries by id and by path", () => {
        const entries = [entry("one"), entry("two")];
        const context = createWorkspaceDashboardContext({
            workspaceName: "Fixture",
            tagline: "",
            status: "healthy",
            taxonomies: [],
            spaces: [],
            entries,
            diagnostics: [],
            health: { status: "healthy", diagnostics: [], findings: [] },
            views: [],
        });

        expect(context.entriesById.get("one")).toBe(entries[0]);
        expect(context.entriesByPath.get("two.md")).toBe(entries[1]);
        expect(context.dashboard.entries).toBe(entries);
    });
});
