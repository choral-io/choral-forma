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
        {
            id: "preview--notes--home",
            path: "preview/notes/home.md",
            routePath: "/preview/notes/home",
            title: "Mounted document",
            summary: "Mounted summary.",
            variants: [],
        },
    ],
    taxonomies: [{ id: "topics", title: "Topics", terms: [{ id: "wow!", title: "Punctuation term" }] }],
    views: [
        { id: "wow!", title: "Punctuation View", description: "", kind: "table" },
        {
            id: "notes",
            title: "Notes",
            description: "",
            kind: "table",
        },
    ],
} as unknown as WorkspaceDashboard;

describe("static document metadata", () => {
    it.each(["/-/views/wow%21/", "/-/views/wow!"])("resolves canonical View metadata from %s", (pathname) => {
        expect(resolveStaticDocumentMetadata(dashboard, pathname)).toMatchObject({
            canonicalPath: "/-/views/wow%21",
            title: "Punctuation View",
        });
    });
    afterEach(() => {
        clearStaticRuntimeConfig();
        document.head.innerHTML = "";
    });

    it.each(["/-/browse/topics/wow%21/", "/-/browse/topics/wow!"])(
        "resolves term metadata with the same canonical path from %s",
        (pathname) => {
            expect(resolveStaticDocumentMetadata(dashboard, pathname)).toMatchObject({
                canonicalPath: "/-/browse/topics/wow%21",
                title: "Punctuation term",
            });
        },
    );

    it("titles a directory page by its name and leaves unknown paths not found", () => {
        expect(resolveStaticDocumentMetadata(dashboard, "/notes")).toEqual({
            canonicalPath: "/notes",
            description: "Pages the workspace includes under notes/.",
            title: "notes",
        });
        expect(resolveStaticDocumentMetadata(dashboard, "/-/notes")).toMatchObject({ title: "Not found" });
        expect(resolveStaticDocumentMetadata(dashboard, "/missing")).toMatchObject({ title: "Not found" });
        expect(resolveStaticDocumentMetadata(dashboard, "/-/health")).toMatchObject({ title: "Health" });
    });

    it("resolves homepage, encoded entry, and View metadata from local dashboard data", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });

        expect(resolveStaticDocumentMetadata(dashboard, "/")).toEqual({
            canonicalPath: "/",
            description: "Markdown-backed workspace content.",
            title: "Forma",
        });
        expect(resolveStaticDocumentMetadata(dashboard, "/notes/with%20space/")).toEqual({
            canonicalPath: "/notes/with%20space",
            description: "Encoded summary.",
            title: "Encoded",
        });
        expect(resolveStaticDocumentMetadata(dashboard, "/-/views/notes")).toEqual({
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

        syncStaticDocumentMetadata(dashboard, "/notes/with%20space");

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

    it("keeps a basename-like content segment in router metadata and adds the deployment prefix", () => {
        document.head.innerHTML = '<link rel="canonical">';
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/-/data",
            rootPath: "/preview",
        });

        syncStaticDocumentMetadata(dashboard, "/preview/notes/home/");

        expect(document.title).toBe("Mounted document · Forma");
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
            "https://example.test/preview/preview/notes/home",
        );
    });
});
