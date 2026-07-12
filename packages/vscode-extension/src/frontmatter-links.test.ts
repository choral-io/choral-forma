import { describe, expect, it } from "vitest";

import { frontmatterLinks, frontmatterReferenceValues } from "./frontmatter-links.ts";

describe("frontmatter reference links", () => {
    it("uses Core-resolved list references and their original metadata values", () => {
        expect(
            frontmatterLinks({
                path: "tasks/one.md",
                space: "tasks",
                metadata: { owners: ["members/noah-kim", "members/ava-patel"] },
                refs: [
                    {
                        source: "frontmatter",
                        field: "owners",
                        targetPath: "members/noah-kim.md",
                        intent: "reference",
                    },
                    {
                        source: "frontmatter",
                        field: "owners",
                        targetPath: "members/ava-patel.md",
                        intent: "reference",
                    },
                ],
                renderable: true,
            }),
        ).toEqual([
            { field: "owners", value: "members/noah-kim", targetPath: "members/noah-kim.md" },
            { field: "owners", value: "members/ava-patel", targetPath: "members/ava-patel.md" },
        ]);
    });

    it("ignores body references and values not backed by Core metadata", () => {
        expect(
            frontmatterLinks({
                path: "notes/one.md",
                space: "notes",
                metadata: { owner: "looks/like-a-path" },
                refs: [
                    { source: "body", targetPath: "looks/like-a-path.md", intent: "link" },
                    {
                        source: "frontmatter",
                        field: "owner",
                        targetPath: "members/noah-kim.md",
                        intent: "reference",
                    },
                ],
                renderable: true,
            }),
        ).toEqual([]);
    });

    it("keeps unresolved schema references semantic without treating tags as references", () => {
        expect(
            frontmatterReferenceValues({
                schemaVersion: 1,
                operation: "inspect",
                status: "failed",
                workspace: { root: ".", name: "Workspace" },
                summary: { errors: 1, warnings: 0, infos: 0 },
                diagnostics: [
                    {
                        severity: "error",
                        code: "entryRef.unresolved",
                        message: "Reference cannot be resolved.",
                        path: "notes/one.md",
                        location: { kind: "frontmatter", field: "owners", index: 0 },
                        actual: "members/missing",
                    },
                ],
                entry: {
                    path: "notes/one.md",
                    space: "notes",
                    metadata: { owners: ["members/missing"], tags: ["vscode-extension"] },
                    refs: [],
                    renderable: true,
                },
            }),
        ).toEqual([{ field: "owners", value: "members/missing" }]);
    });
});
