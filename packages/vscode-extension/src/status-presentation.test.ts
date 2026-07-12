import { describe, expect, it } from "vitest";

import type { FormaRuntimeState } from "./runtime.ts";
import { statusText } from "./status-presentation.ts";

describe("status bar presentation", () => {
    it.each([
        [{ kind: "ready", label: "Forma: Ready", root: "/workspace" }, "$(pass-filled) Forma"],
        [{ kind: "checking", label: "Forma: Checking…" }, "$(sync~spin) Forma"],
        [{ kind: "warning", label: "Forma: Warnings", root: "/workspace" }, "$(warning) Forma"],
        [{ kind: "restricted", label: "Forma: Restricted" }, "$(lock) Forma"],
        [{ kind: "failed", label: "Forma: Failed", detail: "failed" }, "$(error) Forma"],
        [
            { kind: "configuredWorkspaceMissing", label: "Forma: Workspace not found", detail: "docs/.forma.md" },
            "$(error) Forma",
        ],
        [{ kind: "noWorkspace", label: "Forma: No workspace" }, "$(circle-slash) Forma"],
    ] satisfies [FormaRuntimeState, string][])(
        'renders "$kind" as a compact icon and product name',
        (state, expected) => {
            expect(statusText(state)).toBe(expected);
        },
    );
});
