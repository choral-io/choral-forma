import { describe, expect, it } from "vitest";

import { workspaceExplorerMessage } from "./workspace-tree-message.ts";

describe("workspaceExplorerMessage", () => {
    it("distinguishes Explorer load failures from an inactive workspace", () => {
        expect(workspaceExplorerMessage(false, true, "ready")).toBe(
            "Unable to load Forma Explorer. See Forma output for details.",
        );
        expect(workspaceExplorerMessage(false, false, "noWorkspace")).toBe("No active Forma workspace.");
        expect(workspaceExplorerMessage(true, false, "ready")).toBe("");
    });

    it("explains runtime states that prevent Explorer loading", () => {
        expect(workspaceExplorerMessage(false, false, "binaryMissing")).toBe(
            "Forma CLI is unavailable. Use the Forma status menu for recovery.",
        );
        expect(workspaceExplorerMessage(false, false, "restricted")).toBe(
            "Trust this workspace to load Forma Explorer.",
        );
        expect(workspaceExplorerMessage(false, false, "failed")).toBe(
            "Forma is unavailable. See Forma output for details.",
        );
    });
});
