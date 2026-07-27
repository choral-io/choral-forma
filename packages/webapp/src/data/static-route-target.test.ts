import { describe, expect, it } from "vitest";

import { resolveDashboardEntryTarget } from "./static-route-target";
import type { WorkspaceDashboard } from "./workspace-client";

const canonical = {
    id: "notes--one",
    path: "notes/one.md",
    routePath: "/pages/notes/one",
    rawPath: "notes/one.md",
    title: "One",
    omitLeadingTitle: false,
    summary: "Canonical",
    space: "notes",
    updatedLabel: "",
    status: "healthy" as const,
    variants: [
        {
            id: "notes--one.zh-hans",
            language: "zh-Hans",
            path: "notes/one.zh-Hans.md",
            routePath: "/pages/notes/one.zh-Hans",
            rawPath: "notes/one.zh-Hans.md",
            title: "一",
            omitLeadingTitle: true,
            summary: "本地化",
        },
    ],
    body: [],
    diagnostics: [],
    relations: { outgoing: [], backlinks: [] },
};
const dashboard = { entries: [canonical] } as unknown as WorkspaceDashboard;

describe("resolveDashboardEntryTarget", () => {
    it("matches canonical entry routes", () => {
        expect(resolveDashboardEntryTarget(dashboard, "/pages/notes/one")).toMatchObject({
            entryId: "notes--one",
            summary: { title: "One" },
        });
    });

    it("matches localized variant routes without replacing their identity", () => {
        expect(resolveDashboardEntryTarget(dashboard, "/pages/notes/one.zh-Hans")).toMatchObject({
            entryId: "notes--one.zh-hans",
            summary: {
                id: "notes--one.zh-hans",
                path: "notes/one.zh-Hans.md",
                routePath: "/pages/notes/one.zh-Hans",
                title: "一",
                omitLeadingTitle: true,
            },
        });
    });

    it("does not make an unknown static route look canonical", () => {
        expect(resolveDashboardEntryTarget(dashboard, "/pages/notes/missing")).toBeUndefined();
    });
});
