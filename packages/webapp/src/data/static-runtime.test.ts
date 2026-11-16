// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
    isStaticRawHref,
    logicalHref,
    logicalPathname,
    parseStaticRuntimeConfig,
    readStaticRuntimeConfig,
    rootAwareHref,
    staticRouterBasename,
} from "./static-runtime";
import { clearStaticRuntimeConfig, setStaticRuntimeConfig } from "./static-runtime.test-support";

describe("static runtime URL helpers", () => {
    afterEach(() => {
        clearStaticRuntimeConfig();
    });

    it("parses the generated inert JSON configuration", () => {
        expect(
            parseStaticRuntimeConfig(
                '{"baseUrl":"https://example.test","dataBaseUrl":"/preview/data","rootPath":"/preview"}',
            ),
        ).toEqual({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });
        expect(parseStaticRuntimeConfig('{"baseUrl":true}')).toBeUndefined();
        expect(parseStaticRuntimeConfig("not JSON")).toBeUndefined();
        expect(readStaticRuntimeConfig()).toBeUndefined();
    });

    it("accepts the legacy config script without interpreting a heading as runtime configuration", () => {
        const heading = document.createElement("h2");
        const config = {
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        };
        heading.id = "forma-static-workspace";
        heading.textContent = JSON.stringify(config);
        document.body.append(heading);
        const legacyConfig = document.createElement("script");
        legacyConfig.id = heading.id;
        legacyConfig.type = "application/json";
        legacyConfig.textContent = JSON.stringify(config);
        try {
            expect(readStaticRuntimeConfig()).toBeUndefined();
            document.head.append(legacyConfig);
            expect(readStaticRuntimeConfig()).toEqual(config);
        } finally {
            heading.remove();
            legacyConfig.remove();
        }
    });

    it("uses the generated root path as the router basename", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });

        expect(staticRouterBasename()).toBe("/preview");
        expect(rootAwareHref("/notes/one#scope")).toBe("/preview/notes/one#scope");
        expect(rootAwareHref("/preview/notes/one#scope")).toBe("/preview/preview/notes/one#scope");
        expect(logicalHref("/preview/notes/one#scope")).toBe("/notes/one#scope");
        expect(logicalHref("/previewer/notes/one")).toBe("/previewer/notes/one");
        expect(logicalPathname("/preview/-/views/notes/")).toBe("/-/views/notes");
        expect(isStaticRawHref("/preview/-/raw/notes/image.png")).toBe(true);
    });

    it("takes the root path from the base href a local server injects", () => {
        const base = document.createElement("base");
        base.setAttribute("href", "/forma/");
        document.head.append(base);
        try {
            expect(staticRouterBasename()).toBe("/forma");
            expect(rootAwareHref("/-/rpc")).toBe("/forma/-/rpc");
            expect(logicalPathname("/forma/notes/one/")).toBe("/notes/one");
            base.setAttribute("href", "/");
            expect(staticRouterBasename()).toBe("/");
            expect(rootAwareHref("/-/rpc")).toBe("/-/rpc");
        } finally {
            base.remove();
        }
        expect(staticRouterBasename()).toBe("/");
    });

    it("does not rewrite external, protocol, fragment, or rootless targets", () => {
        setStaticRuntimeConfig({
            baseUrl: "https://example.test",
            dataBaseUrl: "/preview/data",
            rootPath: "/preview",
        });

        expect(rootAwareHref("https://example.com/docs")).toBe("https://example.com/docs");
        expect(rootAwareHref("//example.com/docs")).toBe("//example.com/docs");
        expect(rootAwareHref("mailto:team@example.com")).toBe("mailto:team@example.com");
        expect(rootAwareHref("#scope")).toBe("#scope");
        expect(rootAwareHref("notes/file.md")).toBe("notes/file.md");
    });

    it("keeps RPC builds rooted at the origin", () => {
        expect(staticRouterBasename()).toBe("/");
        expect(rootAwareHref("/notes/one")).toBe("/notes/one");
        expect(logicalPathname("/")).toBe("/");
    });
});
