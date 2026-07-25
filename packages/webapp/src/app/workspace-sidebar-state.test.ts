import { describe, expect, it } from "vitest";

import { resolveDesktopSidebarOpen } from "./workspace-sidebar-state";

describe("resolveDesktopSidebarOpen", () => {
    it("uses the responsive default until the user changes the sidebar", () => {
        expect(
            resolveDesktopSidebarOpen({
                currentOpen: false,
                hasManualOverride: false,
                isWideViewport: true,
            }),
        ).toBe(true);
        expect(
            resolveDesktopSidebarOpen({
                currentOpen: true,
                hasManualOverride: false,
                isWideViewport: false,
            }),
        ).toBe(false);
    });

    it("preserves the current session choice after a manual change", () => {
        expect(
            resolveDesktopSidebarOpen({
                currentOpen: true,
                hasManualOverride: true,
                isWideViewport: false,
            }),
        ).toBe(true);
        expect(
            resolveDesktopSidebarOpen({
                currentOpen: false,
                hasManualOverride: true,
                isWideViewport: true,
            }),
        ).toBe(false);
    });
});
