import type { InspectResult } from "@choral-forma/shared";
import { describe, expect, it } from "vitest";

import { documentReferenceDiagnostics, previewBodyLinks } from "./document-analysis.ts";

describe("document analysis projections", () => {
    it("builds resolved wikilinks from one inspect result", () => {
        const text = "[[notes/alpha]] [[notes/beta#Goals|Roadmap]]";
        const inspected = result({
            refs: [
                {
                    source: "body",
                    rawTarget: "notes/alpha",
                    targetPath: "notes/alpha.md",
                    resolvedTitle: "Alpha",
                    intent: "link",
                },
                {
                    source: "body",
                    rawTarget: "notes/beta#Goals",
                    targetPath: "notes/beta.md",
                    fragment: "Goals",
                    resolvedTitle: "Beta",
                    intent: "link",
                },
            ],
        });

        expect(previewBodyLinks(text, inspected)).toEqual([
            { raw: "[[notes/alpha]]", label: "Alpha", targetPath: "notes/alpha.md" },
            {
                raw: "[[notes/beta#Goals|Roadmap]]",
                label: "Roadmap",
                targetPath: "notes/beta.md",
                fragment: "Goals",
            },
        ]);
    });

    it("maps inspect reference diagnostics back to source token ranges", () => {
        const text = "Resolved [[notes/alpha]] and broken [[notes/missing]].";
        const inspected = result({
            diagnostics: [
                {
                    severity: "error",
                    code: "entryRef.unresolved",
                    message: "Reference cannot be resolved.",
                    location: { kind: "body", line: 1, column: 38 },
                    actual: "notes/missing",
                },
            ],
        });

        expect(documentReferenceDiagnostics(text, inspected)).toEqual([
            {
                start: text.indexOf("notes/missing"),
                end: text.indexOf("notes/missing") + "notes/missing".length,
                code: "entryRef.unresolved",
                message: "Reference cannot be resolved.",
            },
        ]);
    });
});

function result({
    refs = [],
    diagnostics = [],
}: {
    refs?: InspectResult["entry"]["refs"];
    diagnostics?: NonNullable<InspectResult["diagnostics"]>;
}): InspectResult {
    return {
        schemaVersion: 1,
        operation: "inspect",
        status: diagnostics.length > 0 ? "failed" : "passed",
        summary: { errors: diagnostics.length, warnings: 0, infos: 0 },
        diagnostics,
        workspace: { root: ".", name: "Fixture" },
        entry: { path: "notes/source.md", refs, renderable: true },
    };
}
