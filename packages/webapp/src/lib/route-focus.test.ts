// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { claimRouteContentFocus, requestRouteContentFocus, resetRouteContentFocus } from "./route-focus";

function createHeading() {
    const heading = document.createElement("h1");
    heading.tabIndex = -1;
    document.body.append(heading);
    return heading;
}

describe("route content focus", () => {
    afterEach(() => {
        resetRouteContentFocus();
        document.body.replaceChildren();
    });

    it("leaves focus alone for the first route of a session", () => {
        const heading = createHeading();

        claimRouteContentFocus(heading, "/");

        expect(document.activeElement).toBe(document.body);
    });

    it("focuses the heading of the route navigated to", () => {
        claimRouteContentFocus(createHeading(), "/");

        const next = createHeading();
        claimRouteContentFocus(next, "/health");

        expect(document.activeElement).toBe(next);
    });

    it("focuses a heading that mounts only after the route content loads", () => {
        claimRouteContentFocus(createHeading(), "/");

        // The lazy route is still suspended, so no heading is mounted yet.
        claimRouteContentFocus(null, "/health");
        expect(document.activeElement).toBe(document.body);

        const next = createHeading();
        claimRouteContentFocus(next, "/health");
        expect(document.activeElement).toBe(next);
    });

    it("focuses a reused heading element when only the route changed", () => {
        const heading = createHeading();
        claimRouteContentFocus(heading, "/pages/one");

        claimRouteContentFocus(heading, "/pages/two");

        expect(document.activeElement).toBe(heading);
    });

    it("does not steal focus when the same route renders again", () => {
        const heading = createHeading();
        claimRouteContentFocus(heading, "/");
        claimRouteContentFocus(heading, "/health");
        heading.blur();

        claimRouteContentFocus(heading, "/health");

        expect(document.activeElement).toBe(document.body);
    });

    it("focuses the current heading on an explicit request without a route change", () => {
        const heading = createHeading();
        claimRouteContentFocus(heading, "/");

        requestRouteContentFocus();

        expect(document.activeElement).toBe(heading);
    });

    it("ignores an explicit request when the heading has left the document", () => {
        const heading = createHeading();
        claimRouteContentFocus(heading, "/");
        heading.remove();

        requestRouteContentFocus();

        expect(document.activeElement).toBe(document.body);
    });
});

describe("route content focus after a route without a heading", () => {
    afterEach(() => {
        resetRouteContentFocus();
        document.body.replaceChildren();
    });

    it("refocuses a route returned to after an error boundary rendered", () => {
        claimRouteContentFocus(createHeading(), "/");

        const health = createHeading();
        claimRouteContentFocus(health, "/health");
        expect(document.activeElement).toBe(health);

        // The next route throws, so its boundary renders and no heading claims focus.
        health.remove();
        claimRouteContentFocus(null, "/views");

        // Returning to /health mounts a new heading for the same path.
        const restored = createHeading();
        claimRouteContentFocus(restored, "/health");

        expect(document.activeElement).toBe(restored);
    });
});
