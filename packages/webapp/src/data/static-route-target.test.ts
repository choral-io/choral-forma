// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { canonicalRoutePath, resolveDashboardEntryTarget } from "./static-route-target";
import { logicalPathname } from "./static-runtime";
import { clearStaticRuntimeConfig, setStaticRuntimeConfig } from "./static-runtime.test-support";
import type { WorkspaceDashboard } from "./workspace-client";

const canonical = {
    id: "notes--one",
    path: "notes/one.md",
    routePath: "/notes/one",
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
            routePath: "/notes/one.zh-Hans",
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
    afterEach(() => {
        clearStaticRuntimeConfig();
    });

    it("matches canonical entry routes", () => {
        expect(resolveDashboardEntryTarget(dashboard, "/notes/one")).toMatchObject({
            entryId: "notes--one",
            summary: { title: "One" },
        });
    });

    it("matches localized variant routes without replacing their identity", () => {
        expect(resolveDashboardEntryTarget(dashboard, "/notes/one.zh-Hans")).toMatchObject({
            entryId: "notes--one.zh-hans",
            summary: {
                id: "notes--one.zh-hans",
                path: "notes/one.zh-Hans.md",
                routePath: "/notes/one.zh-Hans",
                title: "一",
                omitLeadingTitle: true,
            },
        });
    });

    it("does not make an unknown static route look canonical", () => {
        expect(resolveDashboardEntryTarget(dashboard, "/notes/missing")).toBeUndefined();
    });

    it.each([
        ["/preview/notes/with%20space", "/notes/with%20space", "notes--with-space"],
        ["/preview/notes/with%20space/", "/notes/with%20space", "notes--with-space"],
        ["/preview/notes/%E4%BD%A0%E5%A5%BD", "/notes/%E4%BD%A0%E5%A5%BD", "notes--unicode"],
        ["/preview/notes/%E4%BD%A0%E5%A5%BD/", "/notes/%E4%BD%A0%E5%A5%BD", "notes--unicode"],
        ["/preview/notes/100%25", "/notes/100%25", "notes--percent"],
        ["/preview/notes/100%25/", "/notes/100%25", "notes--percent"],
    ])("matches an encoded direct load from %s", (pathname, routePath, entryId) => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });
        const encodedEntries = [
            {
                ...canonical,
                id: "notes--with-space",
                path: "notes/with space.md",
                routePath: "/notes/with%20space",
                variants: [],
            },
            {
                ...canonical,
                id: "notes--unicode",
                path: "notes/你好.md",
                routePath: "/notes/%E4%BD%A0%E5%A5%BD",
                variants: [],
            },
            {
                ...canonical,
                id: "notes--percent",
                path: "notes/100%.md",
                routePath: "/notes/100%25",
                variants: [],
            },
        ];
        const encodedDashboard = { entries: encodedEntries } as unknown as WorkspaceDashboard;

        const canonicalPath = canonicalRoutePath(logicalPathname(pathname));

        expect(canonicalPath).toBe(routePath);
        expect(resolveDashboardEntryTarget(encodedDashboard, canonicalPath)?.entryId).toBe(entryId);
    });
});
