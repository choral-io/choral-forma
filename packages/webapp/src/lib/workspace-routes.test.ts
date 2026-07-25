import { describe, expect, it } from "vitest";

import { taxonomyRoutePath, taxonomyTermRoutePath, viewRoutePath } from "./workspace-routes";

describe("workspace route paths", () => {
    it("keeps configured view path segments while encoding each segment", () => {
        expect(viewRoutePath("planning/release scope")).toBe("/views/planning/release%20scope");
    });

    it("encodes configured taxonomy and term identifiers", () => {
        expect(taxonomyRoutePath("work areas")).toBe("/work%20areas");
        expect(taxonomyTermRoutePath("work areas", "release/readiness")).toBe("/work%20areas/release%2Freadiness");
    });
});
