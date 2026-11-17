import { describe, expect, it } from "vitest";

import { browseRoutePath, encodeRouteSegment, isSystemRoutePath, viewsRoutePath } from "./workspace-routes";

describe("workspace route paths", () => {
    it("keeps the two reserved namespaces distinct from content", () => {
        expect(browseRoutePath).toBe("/~");
        expect(viewsRoutePath).toBe("/-/views");
        for (const pathname of ["/-", "/-/", "/-/views", "/~", "/~/topic"]) {
            expect(isSystemRoutePath(pathname)).toBe(true);
        }
        for (const pathname of ["/", "/-notes", "/-.md", "/~.md", "/views"]) {
            expect(isSystemRoutePath(pathname)).toBe(false);
        }
    });

    it("encodes reserved characters and a logical slash as part of one segment", () => {
        expect(encodeRouteSegment("wow!'()*")).toBe("wow%21%27%28%29%2A");
        expect(encodeRouteSegment("release/readiness")).toBe("release%2Freadiness");
    });
});
