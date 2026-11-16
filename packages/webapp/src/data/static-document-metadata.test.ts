// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { resolveStaticDocumentMetadata, syncStaticDocumentMetadata } from "./static-document-metadata";
import { clearStaticRuntimeConfig, setStaticRuntimeConfig } from "./static-runtime.test-support";
import type { WorkspaceDashboard } from "./workspace-client";

const dashboard = {
    workspaceName: "Forma",
    entries: [
        {
            id: "workspace-root",
            path: ".forma.md",
            routePath: "/",
            title: "Forma",
            summary: "Markdown-backed workspace content.",
            variants: [],
        },
        {
            id: "notes--home",
            path: "notes/home.md",
            routePath: "/notes/home",
            title: "Home",
            summary: "Home summary.",
            variants: [],
        },
        {
            id: "notes--encoded",
            path: "notes/with space.md",
            routePath: "/notes/with%20space",
            title: "Encoded",
            summary: "Encoded summary.",
            variants: [],
        },
    ],
    taxonomies: [],
    views: [
        {
            id: "notes",
            title: "Notes",
            description: "",
            kind: "table",
        },
    ],
} as unknown as WorkspaceDashboard;

describe("static document metadata", () => {
    afterEach(() => {
        clearStaticRuntimeConfig();
        document.head.innerHTML = "";
    });

    it("titles a directory page by its name and leaves unknown paths not found", () => {
        expect(resolveStaticDocumentMetadata(dashboard, "/notes")).toEqual({
            canonicalPath: "/notes",
            description: "Pages the workspace includes under notes/.",
            title: "notes",
        });
        expect(resolveStaticDocumentMetadata(dashboard, "/-/notes")).toMatchObject({ title: "Not found" });
        expect(resolveStaticDocumentMetadata(dashboard, "/missing")).toMatchObject({ title: "Not found" });
    });

    it("resolves homepage, encoded entry, and View metadata from local dashboard data", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });

        expect(resolveStaticDocumentMetadata(dashboard, "/preview/")).toEqual({
            canonicalPath: "/",
            description: "Markdown-backed workspace content.",
            title: "Forma",
        });
        expect(resolveStaticDocumentMetadata(dashboard, "/preview/notes/with%20space/")).toEqual({
            canonicalPath: "/notes/with%20space",
            description: "Encoded summary.",
            title: "Encoded",
        });
        expect(resolveStaticDocumentMetadata(dashboard, "/preview/-/views/notes")).toEqual({
            canonicalPath: "/-/views/notes",
            description: "table workspace View.",
            title: "Notes",
        });
    });

    it("synchronizes the static document head after client navigation", () => {
        document.head.innerHTML = `
            <title>Forma</title>
            <meta name="description" content="old">
            <link rel="canonical" href="https://example.test/preview/">
            <meta property="og:title" content="old">
            <meta property="og:description" content="old">
            <meta property="og:url" content="https://example.test/preview/">
            <meta name="twitter:title" content="old">
            <meta name="twitter:description" content="old">
        `;
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });

        syncStaticDocumentMetadata(dashboard, "/preview/notes/with%20space");

        expect(document.title).toBe("Encoded · Forma");
        expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Encoded summary.");
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
            "https://example.test/preview/notes/with%20space",
        );
        expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe("Encoded · Forma");

        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/data",
            rootPath: "/",
        });
        syncStaticDocumentMetadata(dashboard, "//evil.example");
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
            "https://example.test//evil.example",
        );
    });
});
